import { legacyRank } from "./legacy";
import { EMPTY_LIBRARY, type Item, type Library } from "../types";
import { buildContext, DEFAULT_PARAMS, rankV2, type Context, type Interaction, type Params } from "./engine";
import { diversity, hitRate, mediaSpread, ndcg, novelty } from "./metrics";
import { buildWorld, mulberry32, trueUtility, type SynthUser, type World, type WorldConfig } from "./synth";

export interface RankInput {
  history: Interaction[];
  candidates: Item[];
  ctx: Context;
  /** catálogo inteiro do mundo (para quem precisa montar o próprio contexto) */
  catalog: Item[];
  now: number;
  /** fração de pessoas que viram cada candidato, só com dados de treino */
  popularity: number[];
  rng: () => number;
}
export type Ranker = (x: RankInput) => number[];

export const random: Ranker = ({ candidates, rng }) => {
  const idx = candidates.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
};

export const popular: Ranker = ({ candidates, popularity }) =>
  candidates.map((_, i) => i).sort((a, b) => popularity[b] - popularity[a] || a - b);

/** O método antigo (v1), congelado em legacy.ts, para comparar. Ranqueia tudo; o que ele não consegue pontuar fica no fim. */
export const v1: Ranker = ({ history, candidates }) => {
  const lib: Library = { ...EMPTY_LIBRARY, items: {}, entries: {}, dismissed: [], lists: {} };
  for (const h of history) {
    if (h.status === "dismissed") {
      lib.dismissed.push(h.item.id);
      continue;
    }
    lib.items[h.item.id] = h.item;
    lib.entries[h.item.id] = { itemId: h.item.id, status: h.status, rating: h.rating, at: Math.round(h.day * 86_400_000) };
  }
  const pos = new Map(candidates.map((c, i) => [c.id, i]));
  const ranked = legacyRank(lib, candidates).map((id) => pos.get(id)!);
  const seen = new Set(ranked);
  return [...ranked, ...candidates.map((_, i) => i).filter((i) => !seen.has(i))];
};

/** Padroniza (média 0, desvio 1). Na produção, o equivalente é a nota pública da obra (TMDB, IGDB, AniList). */
export function zscore(xs: number[]): number[] {
  const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1)) || 1;
  return xs.map((x) => (x - m) / sd);
}

export const v2 = (over: Partial<Params> = {}): Ranker => {
  const p = { ...DEFAULT_PARAMS, ...over };
  const own = new WeakMap<Item[], Context>();
  return ({ history, candidates, ctx, catalog, now, popularity }) => rankV2(history, candidates, p.idf ? ctx : (own.get(catalog) ?? (own.set(catalog, buildContext(catalog, false)), own.get(catalog)!)), p, now, p.priorWeight ? zscore(popularity.map((x) => Math.log(x + 0.01))) : undefined);
};

export interface UserResult {
  trainSize: number;
  /** NDCG@10 contra a verdade de referência do mundo, no catálogo inteiro que a pessoa não viu */
  oracle: number;
  /** fração do top 10 que está entre os 10% melhores da pessoa */
  oracleP10: number;
  /** NDCG@10 contra a verdade, só na cauda: sem os 20% de obras mais populares */
  oracleTail: number;
  /** NDCG@10 e acerto@10 contra o que a pessoa realmente viu e gostou depois (nota 4 ou mais), com viés de seleção */
  logged: number;
  hit: number;
  /** acerto@10 só nos itens relevantes de mídias fora da principal da pessoa (undefined se não houver) */
  crossHit?: number;
  diversity: number;
  novelty: number;
  spread: number;
}

export interface Experiment {
  world: World;
  results: Record<string, UserResult[]>;
}

export function splitUser(u: SynthUser, frac = 0.7) {
  const n = Math.floor(u.events.length * frac);
  return { train: u.events.slice(0, n), test: u.events.slice(n) };
}

export function run(cfg: WorldConfig, methods: Record<string, Ranker>, opts: { frac?: number } = {}): Experiment {
  const world = buildWorld(cfg);
  const ctx = buildContext(world.items);
  const { items } = world;

  const seenBy = new Array<number>(items.length).fill(0);
  const splits = world.users.map((u) => splitUser(u, opts.frac));
  for (const { train } of splits) for (const e of new Set(train.map((t) => world.index.get(t.item.id)!))) seenBy[e]++;
  const popularity = seenBy.map((c) => c / world.users.length);

  const results: Record<string, UserResult[]> = {};
  for (const name of Object.keys(methods)) results[name] = [];

  world.users.forEach((u, ui) => {
    const { train, test } = splits[ui];
    if (train.length < 3 || test.length === 0) return;
    const trainIds = new Set(train.map((t) => t.item.id));
    const candIdx = items.map((_, i) => i).filter((i) => !trainIds.has(items[i].id));
    const candidates = candIdx.map((i) => items[i]);
    const now = train[train.length - 1].day;
    const truth = trueUtility(world, u);
    const tu = candIdx.map((i) => truth[i]);
    const oracleGain = tu.map((x) => Math.exp(x));
    const sorted = [...tu].sort((a, b) => b - a);
    const top10 = new Set(tu.map((x, i) => [x, i] as const).filter(([x]) => x >= sorted[Math.floor(tu.length * 0.1)]).map(([, i]) => i));

    const pos = new Map(candidates.map((c, i) => [c.id, i]));
    const relevant = new Set<number>();
    const crossRel = new Set<number>();
    const gain = new Map<number, number>();
    for (const t of test) {
      const i = pos.get(t.item.id);
      if (i === undefined || t.status !== "concluido" || t.rating === undefined || t.rating < 4) continue;
      relevant.add(i);
      gain.set(i, 1);
      if (t.item.media !== u.home) crossRel.add(i);
    }

    const popC = candIdx.map((i) => popularity[i]);
    const cut = [...popC].sort((a, b) => b - a)[Math.floor(popC.length * 0.2)];
    const tail = new Set(popC.map((x, i) => [x, i] as const).filter(([x]) => x < cut).map(([, i]) => i));
    const tailGain = new Map([...tail].map((i) => [i, oracleGain[i]] as const));
    const tailNdcg = (ranked: number[]) => ndcg(ranked.filter((i) => tail.has(i)), tailGain, 10);

    const mk = (name: string, ranker: Ranker) => {
      const ranked = ranker({ history: train, candidates, ctx, catalog: items, now, popularity: candIdx.map((i) => popularity[i]), rng: mulberry32(1000 + ui) });
      const r: UserResult = {
        trainSize: train.length,
        oracle: ndcg(ranked, oracleGain, 10),
        oracleTail: tailNdcg(ranked),
        oracleP10: ranked.slice(0, 10).filter((i) => top10.has(i)).length / 10,
        logged: ndcg(ranked, gain, 10),
        hit: hitRate(ranked, relevant, 10),
        crossHit: crossRel.size ? hitRate(ranked, crossRel, 10) : undefined,
        diversity: diversity(ranked, candidates, ctx, 10),
        novelty: novelty(ranked, candIdx.map((i) => popularity[i]), 10),
        spread: mediaSpread(ranked, candidates, 10),
      };
      results[name].push(r);
    };
    for (const [name, ranker] of Object.entries(methods)) mk(name, ranker);
  });
  return { world, results };
}
