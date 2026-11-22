import { SEED, norm, titleKey } from "./catalog";
import type { Item, Library } from "./types";

/**
 * Busca no catálogo local (base + itens importados). Quando TMDB e IGDB forem
 * ligados, esta função passa a consultar também as APIs.
 * Se o mesmo título existe nas duas fontes, vale o da biblioteca do usuário.
 */
export function searchItems(lib: Library, query: string, limit = 8): Item[] {
  const q = norm(query);
  if (!q) return [];
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const it of [...Object.values(lib.items), ...SEED]) {
    const key = titleKey(it);
    if (seen.has(key)) continue;
    if (!norm(it.title).includes(q)) continue;
    seen.add(key);
    out.push(it);
  }
  out.sort((a, b) => {
    const as = norm(a.title).startsWith(q) ? 0 : 1;
    const bs = norm(b.title).startsWith(q) ? 0 : 1;
    return as - bs || a.title.localeCompare(b.title);
  });
  return out.slice(0, limit);
}

/** Junta resultados locais e remotos. Local vence quando o título e a mídia coincidem. */
export function mergeResults(local: Item[], remote: Item[], limit = 8): Item[] {
  const seen = new Set(local.map((i) => `${i.media}:${norm(i.title)}`));
  const out = [...local];
  for (const r of remote) {
    const key = `${r.media}:${norm(r.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.slice(0, limit);
}

/** Pool de candidatos da recomendação: catálogo base primeiro, remotos sem duplicar. */
export function buildPool(remote: Item[]): Item[] {
  return mergeResults(SEED, remote, Number.MAX_SAFE_INTEGER);
}

/** "Dark, Persona 5 e Kafka à beira-mar" → ["Dark", "Persona 5", "Kafka à beira-mar"]. No máximo `max` termos. */
export function splitFavorites(text: string, max = 5): string[] {
  const seen = new Set<string>();
  return text
    .split(/[,;\n]| e (?=[A-ZÀ-Ý0-9])/)
    .map((t) => t.trim().replace(/^e\s+/i, ""))
    .filter((t) => t.length >= 2 && t.length <= 80 && !seen.has(norm(t)) && !!seen.add(norm(t)))
    .slice(0, max);
}

/** O resultado que mais parece ser o que a pessoa escreveu: título igual, depois começando igual, depois o primeiro com vibes. */
export function pickBest(term: string, items: Item[]): Item | null {
  const q = norm(term);
  return (
    items.find((i) => norm(i.title) === q) ??
    items.find((i) => norm(i.title).startsWith(q) && i.vibes.length > 0) ??
    items.find((i) => i.vibes.length > 0) ??
    items[0] ??
    null
  );
}
