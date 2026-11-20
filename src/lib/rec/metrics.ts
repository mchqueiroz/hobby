import type { Item } from "../types";
import { similarity, type Context } from "./engine";

/** NDCG@k com ganhos graduados. `ranked` são índices; `gain[i]` é o ganho do item i (>= 0). */
export function ndcg(ranked: number[], gain: Map<number, number> | number[], k: number): number {
  const g = (i: number) => (gain instanceof Map ? (gain.get(i) ?? 0) : (gain[i] ?? 0));
  let dcg = 0;
  for (let r = 0; r < Math.min(k, ranked.length); r++) dcg += g(ranked[r]) / Math.log2(r + 2);
  const ideal = (gain instanceof Map ? [...gain.values()] : [...gain]).sort((a, b) => b - a).slice(0, k);
  const idcg = ideal.reduce((s, x, r) => s + x / Math.log2(r + 2), 0);
  return idcg > 0 ? dcg / idcg : 0;
}

export function hitRate(ranked: number[], relevant: Set<number>, k: number): number {
  if (relevant.size === 0) return 0;
  return ranked.slice(0, k).some((i) => relevant.has(i)) ? 1 : 0;
}

export function recallAt(ranked: number[], relevant: Set<number>, k: number): number {
  if (relevant.size === 0) return 0;
  let h = 0;
  for (const i of ranked.slice(0, k)) if (relevant.has(i)) h++;
  return h / relevant.size;
}

/** Diversidade da lista: 1 − similaridade média entre os pares. */
export function diversity(ranked: number[], items: Item[], ctx: Context, k: number): number {
  const top = ranked.slice(0, k);
  if (top.length < 2) return 0;
  let s = 0;
  let n = 0;
  for (let a = 0; a < top.length; a++) {
    for (let b = a + 1; b < top.length; b++) {
      s += similarity(ctx, items[top[a]], items[top[b]]);
      n++;
    }
  }
  return 1 - s / n;
}

/** Novidade: média de −log2 da popularidade (fração de pessoas que viram). Maior = menos óbvio. */
export function novelty(ranked: number[], popularity: number[], k: number): number {
  const top = ranked.slice(0, k);
  return top.reduce((s, i) => s - Math.log2(Math.max(popularity[i], 1e-4)), 0) / (top.length || 1);
}

/** Quantas mídias diferentes aparecem no topo. */
export function mediaSpread(ranked: number[], items: Item[], k: number): number {
  return new Set(ranked.slice(0, k).map((i) => items[i].media)).size;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Intervalo de confiança de 95% por bootstrap da média de diferenças pareadas. */
export function pairedCI(a: number[], b: number[], seed = 7, B = 600): { diff: number; lo: number; hi: number } {
  const d = a.map((x, i) => x - b[i]);
  let st = seed >>> 0;
  const rnd = () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 4294967296;
  };
  const means: number[] = [];
  for (let k = 0; k < B; k++) {
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[Math.floor(rnd() * d.length)];
    means.push(s / d.length);
  }
  means.sort((x, y) => x - y);
  return { diff: mean(d), lo: means[Math.floor(0.025 * B)], hi: means[Math.floor(0.975 * B)] };
}
