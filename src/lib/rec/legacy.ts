import { entryWeight, getItem, tasteProfile } from "../recommend";
import type { Entry, Item, Library } from "../types";

/**
 * O recomendador antigo (v1), congelado só como baseline do laboratório de avaliação.
 * Não é usado pelo app. Soma das vibes ponderada por (nota − 3), dividida por √n, e bônus fixo de 15% entre mídias.
 * Devolve os ids dos candidatos que ele conseguiria sugerir, do melhor ao pior (quem tem pontuação ≤ 0 fica de fora).
 */
export function legacyRank(lib: Library, pool: Item[]): string[] {
  const CROSS_BONUS = 1.15;
  const taste = tasteProfile(lib);
  const known = new Set(Object.keys(lib.entries));
  const dismissed = new Set(lib.dismissed);
  const anchors = Object.values(lib.entries)
    .map((e) => ({ e, w: entryWeight(e), item: getItem(lib, e.itemId) }))
    .filter((a): a is { e: Entry; w: number; item: Item } => !!a.item && a.w > 0);

  const scored: { id: string; title: string; score: number }[] = [];
  for (const c of pool) {
    if (known.has(c.id) || dismissed.has(c.id) || c.vibes.length === 0) continue;
    let raw = 0;
    for (const v of c.vibes) raw += taste[v] ?? 0;
    let score = raw / Math.sqrt(c.vibes.length);
    if (score <= 0) continue;
    let best: { item: Item; pts: number } | undefined;
    for (const a of anchors) {
      const shared = c.vibes.filter((v) => a.item.vibes.includes(v));
      if (shared.length === 0) continue;
      const pts = a.w * shared.length * (a.item.media !== c.media ? CROSS_BONUS : 1);
      if (!best || pts > best.pts || (pts === best.pts && a.item.title < best.item.title)) best = { item: a.item, pts };
    }
    if (best && best.item.media !== c.media) score *= CROSS_BONUS;
    scored.push({ id: c.id, title: c.title, score });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.map((s) => s.id);
}
