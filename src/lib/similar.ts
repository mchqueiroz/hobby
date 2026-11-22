import { SEED, titleKey } from "./catalog";
import { indexFranchises, inKnownFranchise } from "./franchise";
import { getItem } from "./recommend";
import type { Item, Library } from "./types";

export interface Similar {
  item: Item;
  shared: string[];
}

/**
 * "Parecidos com esta": obras de qualquer mídia que dividem vibes com a obra aberta.
 * Pontua por Jaccard das vibes (compartilhadas / total das duas) e exige pelo menos 2 em comum.
 * Tira o que a pessoa já registrou ou dispensou, e continuações do que ela tem ou da própria obra aberta (a ideia é descobrir),
 * e limita a 3 por mídia, para não virar só mais do mesmo.
 * Não usa o gosto da pessoa: é parecido com a OBRA. Quem recomenda para a pessoa é a aba Descobrir.
 */
export function similarTo(lib: Library, item: Item, n = 6): Similar[] {
  const mine = new Set(item.vibes);
  const self = titleKey(item);
  const dismissed = new Set(lib.dismissed);
  const franchises = indexFranchises([item, ...Object.keys(lib.entries).flatMap((id) => getItem(lib, id) ?? [])]);
  const seen = new Set<string>();
  const out: (Similar & { score: number })[] = [];
  for (const c of [...SEED, ...Object.values(lib.items)]) {
    if (c.id === item.id || seen.has(c.id) || lib.entries[c.id] || dismissed.has(c.id) || titleKey(c) === self || inKnownFranchise(franchises, c)) continue;
    seen.add(c.id);
    const shared = c.vibes.filter((v) => mine.has(v));
    if (shared.length < 2) continue;
    const union = new Set([...item.vibes, ...c.vibes]).size;
    out.push({ item: c, shared, score: shared.length / union });
  }
  out.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "pt-BR"));
  const perMedia: Record<string, number> = {};
  const picked: Similar[] = [];
  for (const r of out) {
    if ((perMedia[r.item.media] ?? 0) >= 3) continue;
    perMedia[r.item.media] = (perMedia[r.item.media] ?? 0) + 1;
    picked.push({ item: r.item, shared: r.shared });
    if (picked.length === n) break;
  }
  return picked;
}
