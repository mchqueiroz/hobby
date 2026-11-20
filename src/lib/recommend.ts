import { SEED, SEED_BY_ID, titleKey } from "./catalog";
import { DEFAULT_PARAMS, rankWithDiversity, scoreAll, buildContext, type Interaction, type Params } from "./rec/engine";
import type { Entry, Item, Library, Media } from "./types";

export interface Recommendation {
  item: Item;
  score: number;
  /** item da biblioteca que mais pesou na sugestão */
  anchor?: { item: Item; rating?: number };
  shared: string[];
  reason: string;
}

export interface RecommendOptions {
  /** de onde vêm os candidatos. Por padrão, o catálogo base. */
  pool?: Item[];
  count?: number;
  /** máximo de sugestões da mesma mídia (ignorado quando há filtro de mídia) */
  perMedia?: number;
  media?: Media;
  /** só candidatos que tenham alguma dessas vibes; quem tem mais delas sobe */
  moodVibes?: readonly string[];
  /** sugere a partir do que já está em "quero ver" em vez de itens novos */
  fromWatchlist?: boolean;
}

export function getItem(lib: Library, id: string): Item | undefined {
  return lib.items[id] ?? SEED_BY_ID[id];
}

/**
 * Peso de uma entrada no gosto do usuário.
 * Nota 3 é neutra; acima soma, abaixo subtrai. Sem nota, concluído conta pouco a favor.
 * "Quero ver" é só intenção e não entra no gosto.
 */
export function entryWeight(e: Entry): number {
  switch (e.status) {
    case "abandonei":
      return -1;
    case "quero":
      return 0;
    case "andamento":
      return e.rating !== undefined ? e.rating - 3 : 0.25;
    case "concluido":
      return e.rating !== undefined ? e.rating - 3 : 0.5;
  }
}

/** Soma das vibes dos itens avaliados, ponderada pelas notas, menos os "não é pra mim". */
export function tasteProfile(lib: Library): Record<string, number> {
  const taste: Record<string, number> = {};
  const add = (vibes: string[], w: number) => {
    for (const v of vibes) taste[v] = (taste[v] ?? 0) + w;
  };
  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (item) add(item.vibes, entryWeight(e));
  }
  for (const id of lib.dismissed) {
    const item = getItem(lib, id);
    if (item) add(item.vibes, -1);
  }
  return taste;
}

export function topVibes(lib: Library, n = 5): string[] {
  return Object.entries(tasteProfile(lib))
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([v]) => v);
}

const MEDIA_WORD: Record<Media, string> = {
  anime: "anime",
  manga: "mangá",
  jogo: "jogo",
  filme: "filme ou série",
  livro: "livro",
  musica: "álbum",
};

export function fmtRating(r: number): string {
  return String(r).replace(".", ",");
}

function listPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}

/**
 * Parâmetros do v2, escolhidos no laboratório de avaliação (scripts/eval-full.ts, mundos de validação) e
 * conferidos em mundos de teste diferentes. Ver docs/recomendacao.md.
 */
export const PROD_PARAMS: Params = {
  ...DEFAULT_PARAMS,
  priorStrength: 8,
  halfLife: 720,
  vibeShrink: 4,
  idf: false,
  knnWeight: 0.25,
  mediaWeight: 0.5,
  mmrLambda: 0.8,
  priorWeight: 0.35,
};

const DAY = 86_400_000;

/** Histórico da biblioteca no formato do motor. Entrada sem data (importada) conta como de um ano atrás. */
export function interactions(lib: Library, now = Date.now()): Interaction[] {
  const out: Interaction[] = [];
  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (!item) continue;
    const t = e.date ?? (e.at > 0 ? e.at : now - 365 * DAY);
    out.push({ item, status: e.status, rating: e.rating, day: t / DAY });
  }
  for (const id of lib.dismissed) {
    const item = getItem(lib, id);
    if (item) out.push({ item, status: "dismissed", day: now / DAY });
  }
  return out;
}

/** Nota pública padronizada por mídia no conjunto de candidatos. Sem nota suficiente, 0 (neutro). */
export function qualityPrior(candidates: Item[]): number[] {
  const by: Partial<Record<Media, number[]>> = {};
  for (const c of candidates) if (c.quality !== undefined) (by[c.media] ??= []).push(c.quality);
  const stats = new Map<Media, { m: number; sd: number }>();
  for (const [media, xs] of Object.entries(by) as [Media, number[]][]) {
    if (xs.length < 8) continue;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    if (sd > 0.05) stats.set(media, { m, sd });
  }
  return candidates.map((c) => {
    const st = stats.get(c.media);
    return c.quality !== undefined && st ? Math.max(-2.5, Math.min(2.5, (c.quality - st.m) / st.sd)) : 0;
  });
}

/** Títulos (normalizados) que o usuário já tem, venham de qual fonte vierem. */
export function ownedTitles(lib: Library): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(lib.entries)) {
    const it = getItem(lib, id);
    if (it) out.add(titleKey(it));
  }
  return out;
}

export function recommend(lib: Library, opts: RecommendOptions = {}): Recommendation[] {
  const { pool: givenPool = SEED, count = 5, perMedia = 2, media, moodVibes, fromWatchlist = false } = opts;
  const pool = fromWatchlist
    ? Object.values(lib.entries).filter((e) => e.status === "quero").map((e) => getItem(lib, e.itemId)).filter((i): i is Item => !!i)
    : givenPool;
  const taste = tasteProfile(lib);

  // na lista de "quero ver" o item já está na biblioteca de propósito; só o que já foi visto/abandonado fica de fora
  const known = new Set<string>(Object.values(lib.entries).filter((e) => !fromWatchlist || e.status !== "quero").map((e) => e.itemId));
  const knownTitles = fromWatchlist ? new Set<string>() : ownedTitles(lib);
  const dismissed = new Set(lib.dismissed);

  const cands = pool.filter((c) => {
    if (media && c.media !== media) return false;
    if (known.has(c.id) || dismissed.has(c.id) || knownTitles.has(titleKey(c))) return false;
    if (c.vibes.length === 0) return false;
    if (moodVibes && !c.vibes.some((v) => moodVibes.includes(v))) return false;
    return true;
  });
  if (cands.length === 0) return [];
  // empates se resolvem em ordem alfabética, para o resultado ser sempre o mesmo
  cands.sort((x, y) => x.title.localeCompare(y.title));

  const p = PROD_PARAMS;
  const ctx = buildContext([], false);
  const now = Date.now();
  const hist = interactions(lib, now);
  const day = now / DAY;
  const personal = scoreAll(hist, cands, ctx, { ...p, priorWeight: 0 }, day);
  const prior = qualityPrior(cands);

  const rows: { c: Item; score: number; anchor?: Item; anchorRating?: number }[] = [];
  cands.forEach((c, i) => {
    const pers = personal[i];
    // na lista de quero ver, itens sem informação de gosto ainda entram; fora dela, só quem combina com algo que a pessoa gostou
    if (!fromWatchlist && !(pers.anchor && pers.score > 0)) return;
    let score = pers.score + p.priorWeight * prior[i];
    if (moodVibes) {
      const hits = c.vibes.filter((v) => moodVibes.includes(v)).length;
      score += 0.3 * (hits / c.vibes.length);
    }
    const a = pers.anchor?.item;
    rows.push({ c, score, anchor: a, anchorRating: a ? lib.entries[a.id]?.rating : undefined });
  });
  if (rows.length === 0) return [];

  // reordena por diversidade: troca um pouco de relevância por variedade no topo
  const order = rankWithDiversity(rows.map((r) => r.score), rows.map((r) => r.c), ctx, p);
  const scored: Recommendation[] = order.map((ri) => {
    const r = rows[ri];
    const shared = r.anchor
      ? r.c.vibes.filter((v) => r.anchor!.vibes.includes(v)).sort((x, y) => (taste[y] ?? 0) - (taste[x] ?? 0)).slice(0, 3)
      : r.c.vibes.filter((v) => (taste[v] ?? 0) > 0).slice(0, 3);
    const reason = r.anchor
      ? `Porque você ${
          r.anchorRating !== undefined ? `deu ${fmtRating(r.anchorRating)}★ a` : "concluiu"
        } ${r.anchor.title} (${MEDIA_WORD[r.anchor.media]}): os dois são ${listPt(shared.length ? shared : r.c.vibes.slice(0, 2))}.`
      : fromWatchlist
        ? "Já está na sua lista de quero ver."
        : `Combina com o que você mais gosta: ${listPt(shared)}.`;
    return { item: r.c, score: r.score, anchor: r.anchor && { item: r.anchor, rating: r.anchorRating }, shared, reason };
  });

  // variedade: no máximo `perMedia` por mídia, a menos que o usuário filtre uma só
  const cap = media ? count : perMedia;
  const out: Recommendation[] = [];
  const per: Record<string, number> = {};
  for (const r of scored) {
    if (out.length >= count) break;
    if ((per[r.item.media] ?? 0) >= cap) continue;
    per[r.item.media] = (per[r.item.media] ?? 0) + 1;
    out.push(r);
  }
  return out;
}

export type Source = "novos" | "quero";

export interface TonightOptions {
  pool?: Item[];
  media?: Media;
  moodVibes?: readonly string[];
  source?: Source;
  /** devolve um número em [0, 1); injetável para testes */
  rng?: () => number;
}

/** Uma sugestão para agora, sorteada entre as melhores (as mais bem pontuadas têm mais chance), e duas alternativas. */
export function tonight(lib: Library, opts: TonightOptions = {}): { pick?: Recommendation; others: Recommendation[] } {
  const { pool, media, moodVibes, source = "novos", rng = Math.random } = opts;
  const top = recommend(lib, { pool, media, moodVibes, fromWatchlist: source === "quero", count: 6, perMedia: media ? 6 : 3 });
  if (top.length === 0) return { others: [] };
  const best = top.slice(0, 5);
  const w = (r: Recommendation) => Math.max(0.05, r.score);
  const total = best.reduce((a, r) => a + w(r), 0);
  let t = rng() * total;
  let pick = best[best.length - 1];
  for (const r of best) {
    t -= w(r);
    if (t < 0) {
      pick = r;
      break;
    }
  }
  return { pick, others: top.filter((r) => r !== pick).slice(0, 2) };
}
