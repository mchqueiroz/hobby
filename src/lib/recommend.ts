import { SEED, SEED_BY_ID, norm, titleKey } from "./catalog";
import { indexFranchises, inKnownFranchise } from "./franchise";
import { DEFAULT_PARAMS, rankWithDiversity, scoreAll, buildContext, type Interaction, type Params } from "./rec/engine";
import type { Entry, Item, Library, Media } from "./types";

export interface Recommendation {
  item: Item;
  score: number;
  /** item da biblioteca que mais pesou na sugestão */
  anchor?: { item: Item; rating?: number };
  /** segunda obra que também puxou, quando pesou quase tanto quanto a primeira */
  also?: { item: Item; rating?: number };
  shared: string[];
  reason: string;
  /** aposta: combina com o gosto, mas foge do que a pessoa costuma ver */
  bet?: boolean;
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
  /** troca a última sugestão por uma aposta fora do trilho de sempre (precisa de 4 ou mais sugestões) */
  bet?: boolean;
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
    case "pausei":
      return e.rating !== undefined ? e.rating - 3 : 0;
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

/** "Elis Regina e Tom Jobim" vira ["elisregina", "tomjobim"]. Autor genérico ("Vários artistas") não conta. */
function authorKeys(author?: string): string[] {
  if (!author) return [];
  return author
    .split(/,|&| e | and |;/i)
    .map((a) => norm(a))
    .filter((a) => a.length > 2 && !a.startsWith("varios"));
}

interface AuthorTaste {
  sum: number;
  n: number;
  best?: { item: Item; w: number; rating?: number };
}

/** O que a pessoa pensa de cada autor/artista: soma dos pesos das entradas, e a obra que mais pesou. */
function authorTaste(lib: Library): Map<string, AuthorTaste> {
  const out = new Map<string, AuthorTaste>();
  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (!item?.author) continue;
    const w = Math.max(-2, Math.min(2, entryWeight(e)));
    if (e.status === "quero" || (w === 0 && e.rating === undefined)) continue;
    for (const k of authorKeys(item.author)) {
      const t = out.get(k) ?? { sum: 0, n: 0 };
      t.sum += w;
      t.n++;
      if (w > 0 && (!t.best || w > t.best.w)) t.best = { item, w, rating: e.rating };
      out.set(k, t);
    }
  }
  return out;
}

/** Quanto o autor do candidato pesa a favor ou contra (encolhido: um único registro vale pouco), e a obra que justifica. */
function authorBoost(c: Item, taste: Map<string, AuthorTaste>): { boost: number; from?: { item: Item; rating?: number } } {
  let boost = 0;
  let from: { item: Item; rating?: number } | undefined;
  for (const k of authorKeys(c.author)) {
    const t = taste.get(k);
    if (!t) continue;
    const b = 0.18 * (t.sum / (t.n + 1));
    if (Math.abs(b) > Math.abs(boost)) {
      boost = b;
      from = t.best && b > 0 ? { item: t.best.item, rating: t.best.rating } : undefined;
    }
  }
  return { boost, from };
}

export function recommend(lib: Library, opts: RecommendOptions = {}): Recommendation[] {
  const { pool: givenPool = SEED, count = 5, perMedia = 2, media, moodVibes, fromWatchlist = false, bet = false } = opts;
  const pool = fromWatchlist
    ? Object.values(lib.entries).filter((e) => e.status === "quero").map((e) => getItem(lib, e.itemId)).filter((i): i is Item => !!i)
    : givenPool;
  const taste = tasteProfile(lib);

  // na lista de "quero ver" o item já está na biblioteca de propósito; só o que já foi visto/abandonado fica de fora
  const known = new Set<string>(Object.values(lib.entries).filter((e) => !fromWatchlist || e.status !== "quero").map((e) => e.itemId));
  const knownTitles = fromWatchlist ? new Set<string>() : ownedTitles(lib);
  const dismissed = new Set(lib.dismissed);
  // continuação de algo que a pessoa já tem não é descoberta: "Segunda temporada" fica de fora
  const franchises = fromWatchlist ? undefined : indexFranchises(Object.keys(lib.entries).flatMap((id) => getItem(lib, id) ?? []));

  const cands = pool.filter((c) => {
    if (media && c.media !== media) return false;
    if (known.has(c.id) || dismissed.has(c.id) || knownTitles.has(titleKey(c))) return false;
    if (franchises && inKnownFranchise(franchises, c)) return false;
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

  const authors = fromWatchlist ? new Map<string, AuthorTaste>() : authorTaste(lib);
  interface Row {
    c: Item;
    score: number;
    anchor?: Item;
    also?: Item;
    /** o motivo é o mesmo autor/artista */
    byAuthor?: boolean;
  }
  const rows: Row[] = [];
  cands.forEach((c, i) => {
    const pers = personal[i];
    const au = authorBoost(c, authors);
    // na lista de quero ver, itens sem informação de gosto ainda entram; fora dela, só quem combina com algo que a pessoa gostou
    if (!fromWatchlist && !((pers.anchor || au.from) && pers.score + au.boost > 0)) return;
    let score = pers.score + au.boost + p.priorWeight * prior[i];
    if (moodVibes) {
      const hits = c.vibes.filter((v) => moodVibes.includes(v)).length;
      score += 0.3 * (hits / c.vibes.length);
    }
    const [first, second] = pers.anchors ?? [];
    // o mesmo autor é o motivo mais concreto que existe; só vale quando puxa a favor
    const byAuthor = !!au.from && au.boost >= 0.1;
    const anchor = byAuthor ? au.from!.item : pers.anchor?.item;
    // segunda obra só entra quando pesou quase tanto quanto a primeira e divide ao menos 2 vibes com a sugestão
    const also =
      !byAuthor && first && second && second.pts >= 0.7 * first.pts && c.vibes.filter((v) => second.g.item.vibes.includes(v)).length >= 2
        ? second.g.item
        : undefined;
    rows.push({ c, score, anchor, also, byAuthor });
  });
  if (rows.length === 0) return [];

  const ratingOf = (it?: Item) => (it ? lib.entries[it.id]?.rating : undefined);
  /** "deu 5★ a X (anime)"; na segunda menção do mesmo tipo o verbo não repete: "e 4,5★ a Y (jogo)" */
  const said = (it: Item, again = false) => {
    const r = ratingOf(it);
    if (r !== undefined) return `${again ? "" : "deu "}${fmtRating(r)}★ a ${it.title} (${MEDIA_WORD[it.media]})`;
    const st = lib.entries[it.id]?.status;
    return `${st === "andamento" ? "está acompanhando" : "concluiu"} ${it.title} (${MEDIA_WORD[it.media]})`;
  };

  // reordena por diversidade: troca um pouco de relevância por variedade no topo
  const order = rankWithDiversity(rows.map((r) => r.score), rows.map((r) => r.c), ctx, p);
  const scored: Recommendation[] = order.map((ri) => {
    const r = rows[ri];
    const anchors = [r.anchor, r.also].filter((x): x is Item => !!x);
    const shared = anchors.length
      ? r.c.vibes.filter((v) => anchors.some((a) => a.vibes.includes(v))).sort((x, y) => (taste[y] ?? 0) - (taste[x] ?? 0)).slice(0, 3)
      : r.c.vibes.filter((v) => (taste[v] ?? 0) > 0).slice(0, 3);
    const vibesText = listPt(shared.length ? shared : r.c.vibes.slice(0, 2));
    let reason: string;
    if (r.byAuthor && r.anchor) {
      reason = `Porque você ${said(r.anchor)}, ${r.c.media === "musica" ? "do mesmo artista" : "do mesmo autor"}.`;
    } else if (r.anchor && r.also) {
      reason = `Porque você ${said(r.anchor)} e ${said(r.also, ratingOf(r.anchor) !== undefined)}: este também é ${vibesText}.`;
    } else if (r.anchor) {
      reason = `Porque você ${said(r.anchor)}: os dois são ${vibesText}.`;
    } else if (fromWatchlist) {
      reason = "Já está na sua lista de quero ver.";
    } else {
      reason = `Combina com o que você mais gosta: ${listPt(shared)}.`;
    }
    return {
      item: r.c,
      score: r.score,
      anchor: r.anchor && { item: r.anchor, rating: ratingOf(r.anchor) },
      also: r.also && { item: r.also, rating: ratingOf(r.also) },
      shared,
      reason,
    };
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

  if (bet && out.length >= 4) {
    const wanted = pickBet(scored, out, topVibes(lib, 8), cap, per);
    if (wanted) out[out.length - 1] = { ...wanted, bet: true };
  }
  return out;
}

/**
 * A aposta: entre o que sobrou, a sugestão acima da média que mais foge das vibes de sempre da pessoa.
 * Sem aposta decente, a lista fica como está. Só vale a pena se já passou pelo filtro de gosto (ter um motivo real).
 */
function pickBet(scored: Recommendation[], out: Recommendation[], favorite: string[], cap: number, per: Record<string, number>): Recommendation | undefined {
  const chosen = new Set(out.map((r) => r.item.id));
  const mean = scored.reduce((a, r) => a + r.score, 0) / scored.length;
  const top = new Set(favorite);
  const dropped = out[out.length - 1].item.media;
  let best: Recommendation | undefined;
  let bestValue = -Infinity;
  for (const r of scored) {
    if (chosen.has(r.item.id) || r.score < mean) continue;
    // tirar a última libera uma vaga da mídia dela; as demais respeitam o teto
    if ((per[r.item.media] ?? 0) - (r.item.media === dropped ? 1 : 0) >= cap) continue;
    const novelty = 1 - r.item.vibes.filter((v) => top.has(v)).length / r.item.vibes.length;
    if (novelty < 0.5) continue;
    const value = r.score + 0.4 * novelty;
    if (value > bestValue) {
      bestValue = value;
      best = r;
    }
  }
  return best;
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

/**
 * Vibes para escolher algo a dois: primeiro as que as duas pessoas têm entre as mais fortes;
 * se forem poucas, completa com as 2 melhores de cada uma, para ninguém ficar de fora.
 */
export function jointVibes(mine: readonly string[], theirs: readonly string[]): { vibes: string[]; shared: string[] } {
  const shared = mine.filter((v) => theirs.includes(v));
  const vibes = [...shared];
  if (shared.length < 2) for (const v of [...mine.slice(0, 2), ...theirs.slice(0, 2)]) if (!vibes.includes(v)) vibes.push(v);
  return { vibes, shared };
}
