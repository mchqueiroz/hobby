import type { Item, Media, Status } from "../types";

/**
 * Motor de recomendação v2 (conteúdo + sinais de comportamento).
 *
 * Ideias, e de onde vêm:
 *  - nota relativa ao próprio usuário, com encolhimento (viés de usuário, Koren e Bell): quem dá 4 em tudo não tem tudo "positivo";
 *  - afinidade por vibe como média encolhida, não soma: poucas evidências valem pouco;
 *  - vizinhança por conteúdo (kNN sobre vibes ponderadas por IDF): captura combinações que a soma por vibe não vê;
 *  - decaimento no tempo: gosto muda;
 *  - sinais negativos (abandonei, não é pra mim);
 *  - afinidade por mídia aprendida por pessoa, no lugar de um bônus fixo entre mídias (transferência negativa, survey de CDR 2025);
 *  - reordenação por diversidade (MMR).
 * Tudo aqui é puro e determinístico para poder ser avaliado no laboratório.
 */

export interface Interaction {
  item: Item;
  /** "dismissed" = "não é pra mim" */
  status: Status | "dismissed";
  rating?: number;
  /** dia (qualquer origem fixa, em dias) em que aconteceu */
  day: number;
}

export interface Params {
  /** média e dispersão a priori das notas, e o peso dessa crença (em notas) */
  priorMean: number;
  priorSpread: number;
  priorStrength: number;
  /** false = usa (nota − 3), como o método antigo; true = nota relativa à própria pessoa */
  userNorm: boolean;
  /** meia-vida do gosto em dias; Infinity desliga o decaimento */
  halfLife: number;
  /** encolhimento da afinidade por vibe (em "peso de evidência") */
  vibeShrink: number;
  idf: boolean;
  /** 0 = só soma por vibe, 1 = só vizinhança */
  knnWeight: number;
  knnK: number;
  knnPower: number;
  knnShrink: number;
  /** "none", "fixed" (bônus para a mídia menos usada) ou "learned" (afinidade média por mídia) */
  media: "none" | "fixed" | "learned";
  mediaWeight: number;
  mediaShrink: number;
  crossBonus: number;
  negAbandon: number;
  negDismiss: number;
  unratedDone: number;
  unratedGoing: number;
  /** 1 desliga a diversidade; abaixo disso troca um pouco de relevância por variedade */
  mmrLambda: number;
  mmrDepth: number;
  /** peso do prior de qualidade da obra (nota pública ou popularidade, em desvios) somado ao gosto pessoal */
  priorWeight: number;
}

export const DEFAULT_PARAMS: Params = {
  priorMean: 3.5,
  priorSpread: 0.9,
  priorStrength: 4,
  userNorm: true,
  halfLife: 365,
  vibeShrink: 2,
  idf: true,
  knnWeight: 0.5,
  knnK: 20,
  knnPower: 2,
  knnShrink: 1,
  media: "learned",
  mediaWeight: 0.3,
  mediaShrink: 3,
  crossBonus: 0.15,
  negAbandon: -0.8,
  negDismiss: -0.5,
  unratedDone: 0.3,
  unratedGoing: 0.1,
  mmrLambda: 0.85,
  mmrDepth: 30,
  priorWeight: 0.5,
};

export interface Context {
  idf: Map<string, number>;
  /** vetor esparso (vibe → peso) e norma de cada item visto, em cache */
  vec: (item: Item) => { w: Map<string, number>; norm: number };
}

export function buildContext(catalog: Item[], useIdf = true): Context {
  const df = new Map<string, number>();
  for (const it of catalog) for (const v of new Set(it.vibes)) df.set(v, (df.get(v) ?? 0) + 1);
  const n = catalog.length;
  const raw = new Map<string, number>();
  let sum = 0;
  for (const [v, d] of df) {
    const x = useIdf ? Math.log((n + 1) / (d + 1)) + 1 : 1;
    raw.set(v, x);
    sum += x;
  }
  const mean = df.size ? sum / df.size : 1;
  const idf = new Map<string, number>();
  for (const [v, x] of raw) idf.set(v, x / mean); // média 1, para o encolhimento não depender do catálogo
  const cache = new Map<string, { w: Map<string, number>; norm: number }>();
  const vec = (item: Item) => {
    let c = cache.get(item.id);
    if (!c) {
      const w = new Map<string, number>();
      let s2 = 0;
      for (const v of new Set(item.vibes)) {
        const x = idf.get(v) ?? 1;
        w.set(v, x);
        s2 += x * x;
      }
      c = { w, norm: Math.sqrt(s2) || 1 };
      cache.set(item.id, c);
    }
    return c;
  };
  return { idf, vec };
}

export function similarity(ctx: Context, a: Item, b: Item): number {
  const A = ctx.vec(a);
  const B = ctx.vec(b);
  const [small, big] = A.w.size <= B.w.size ? [A, B] : [B, A];
  let dot = 0;
  for (const [v, x] of small.w) {
    const y = big.w.get(v);
    if (y !== undefined) dot += x * y;
  }
  return dot / (A.norm * B.norm);
}

export interface Signal {
  item: Item;
  /** peso por idade */
  w: number;
  /** sinal de gosto, em desvios da própria pessoa: positivo gosta, negativo não gosta */
  s: number;
}

/** Converte o histórico em sinais de gosto relativos à própria pessoa. */
export function userSignals(history: Interaction[], now: number, p: Params): Signal[] {
  const rated = history.filter((h) => h.rating !== undefined && (h.status === "concluido" || h.status === "andamento"));
  const n = rated.length;
  const sumR = rated.reduce((a, h) => a + h.rating!, 0);
  const mu = (sumR + p.priorStrength * p.priorMean) / (n + p.priorStrength);
  const ss = rated.reduce((a, h) => a + (h.rating! - mu) ** 2, 0);
  const sigma = Math.max(0.5, Math.sqrt((ss + p.priorStrength * p.priorSpread ** 2) / (n + p.priorStrength)));

  const out: Signal[] = [];
  for (const h of history) {
    let s: number;
    if (h.status === "quero") continue;
    if (h.status === "pausei" && h.rating === undefined) continue;
    if (h.status === "dismissed") s = p.negDismiss;
    else if (h.status === "abandonei") s = p.negAbandon;
    else if (h.rating !== undefined && !p.userNorm) s = Math.max(-2.5, Math.min(2.5, h.rating - 3));
    else if (h.rating !== undefined) s = Math.max(-2.5, Math.min(2.5, (h.rating - mu) / sigma));
    else s = h.status === "concluido" ? p.unratedDone : p.unratedGoing;
    const age = Math.max(0, now - h.day);
    const w = Number.isFinite(p.halfLife) ? Math.pow(0.5, age / p.halfLife) : 1;
    out.push({ item: h.item, w, s });
  }
  return out;
}

export interface Scored {
  score: number;
  /** sinal do histórico que mais puxou este candidato (para explicar) */
  anchor?: Signal;
  /** os dois que mais puxaram (com a força de cada um), o primeiro igual a `anchor` */
  anchors?: Pulled[];
}

export interface Pulled {
  g: Signal;
  pts: number;
}

/** Pontua todos os candidatos. Maior é melhor. */
export function scoreAll(
  history: Interaction[],
  candidates: Item[],
  ctx: Context,
  p: Params,
  now: number,
  /** qualidade pública de cada candidato, já padronizada (média 0, desvio 1); opcional */
  prior?: number[],
): Scored[] {
  const sig = userSignals(history, now, p);
  const pr = (i: number) => (prior ? p.priorWeight * (prior[i] ?? 0) : 0);
  if (sig.length === 0) return candidates.map((_, i) => ({ score: pr(i) }));

  // afinidade por vibe: média encolhida do sinal, ponderada pela idade
  const num = new Map<string, number>();
  const den = new Map<string, number>();
  for (const g of sig) {
    for (const v of new Set(g.item.vibes)) {
      num.set(v, (num.get(v) ?? 0) + g.w * g.s);
      den.set(v, (den.get(v) ?? 0) + g.w);
    }
  }
  const aff = (v: string) => (num.get(v) ?? 0) / ((den.get(v) ?? 0) + p.vibeShrink);

  // afinidade por mídia: média encolhida do sinal; e a mídia mais usada, para o bônus fixo
  const mNum = new Map<Media, number>();
  const mDen = new Map<Media, number>();
  for (const g of sig) {
    mNum.set(g.item.media, (mNum.get(g.item.media) ?? 0) + g.w * g.s);
    mDen.set(g.item.media, (mDen.get(g.item.media) ?? 0) + g.w);
  }
  let home: Media | undefined;
  let homeN = -1;
  for (const [m, d] of mDen) {
    if (d > homeN) {
      home = m;
      homeN = d;
    }
  }

  const kw = p.knnWeight;
  return candidates.map((c, ci) => {
    let add = 0;
    if (kw < 1) {
      const cv = ctx.vec(c);
      for (const [v, x] of cv.w) add += x * aff(v);
      add /= Math.sqrt(Math.max(1, cv.w.size));
    }

    let knn = 0;
    let anchor: Signal | undefined;
    const pulled: Pulled[] = [];
    if (kw > 0) {
      const sims: { g: Signal; sim: number }[] = [];
      for (const g of sig) {
        const sim = similarity(ctx, c, g.item);
        if (sim > 0) sims.push({ g, sim });
      }
      sims.sort((a, b) => b.sim - a.sim);
      let nn = 0;
      let dd = 0;
      for (const { g, sim } of sims.slice(0, p.knnK)) {
        const k = g.w * Math.pow(sim, p.knnPower);
        nn += k * g.s;
        dd += k;
        if (g.s > 0) pulled.push({ g, pts: k * g.s });
      }
      knn = nn / (dd + p.knnShrink);
      pulled.sort((a, b) => b.pts - a.pts);
      anchor = pulled[0]?.g;
    }

    let score = (1 - kw) * add + kw * knn;
    if (p.media === "learned") {
      const d = mDen.get(c.media) ?? 0;
      score += p.mediaWeight * ((mNum.get(c.media) ?? 0) / (d + p.mediaShrink));
    } else if (p.media === "fixed" && home && c.media !== home) {
      score += p.crossBonus;
    }
    return { score: score + pr(ci), anchor, anchors: pulled.slice(0, 2) };
  });
}

/** Reordena o topo trocando um pouco de relevância por variedade (MMR). Devolve índices, do primeiro ao último. */
export function rankWithDiversity(scores: number[], candidates: Item[], ctx: Context, p: Params): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  if (p.mmrLambda >= 1) return order;
  const depth = Math.min(p.mmrDepth, order.length);
  const pool = order.slice(0, depth);
  const lo = Math.min(...pool.map((i) => scores[i]));
  const hi = Math.max(...pool.map((i) => scores[i]));
  const span = hi - lo || 1;
  const chosen: number[] = [];
  while (pool.length) {
    let bi = 0;
    let bv = -Infinity;
    for (let k = 0; k < pool.length; k++) {
      const i = pool[k];
      const rel = (scores[i] - lo) / span;
      let red = 0;
      for (const j of chosen) red = Math.max(red, similarity(ctx, candidates[i], candidates[j]));
      const v = p.mmrLambda * rel - (1 - p.mmrLambda) * red;
      if (v > bv) {
        bv = v;
        bi = k;
      }
    }
    chosen.push(pool.splice(bi, 1)[0]);
  }
  return [...chosen, ...order.slice(depth)];
}

/** Ranking completo do catálogo candidato. */
export function rankV2(history: Interaction[], candidates: Item[], ctx: Context, p: Params, now: number, prior?: number[]): number[] {
  const s = scoreAll(history, candidates, ctx, p, now, prior).map((x) => x.score);
  return rankWithDiversity(s, candidates, ctx, p);
}
