import { getItem } from "./recommend";
import { MEDIAS, type Entry, type Item, type Library, type Media, type Status } from "./types";

/** Filtros da Biblioteca: tudo puro, para testar. Cada filtro é uma "faceta" com contagem própria. */

export type Sort = "recentes" | "nota" | "titulo" | "ano";
export interface Filters {
  status: Status;
  media: Media | "tudo";
  /** chave da época ("1990", "pre1970", "semano") ou "tudo" */
  era: string;
  /** estilos marcados: o item precisa ter todos */
  vibes: string[];
  q: string;
  sort: Sort;
}
export interface Row {
  e: Entry;
  item: Item;
}
export const DEFAULT_FILTERS: Filters = { status: "concluido", media: "tudo", era: "tudo", vibes: [], q: "", sort: "recentes" };

export const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const PRE = "pre1970";
export const NO_YEAR = "semano";

/** Época do item: década a partir de 1970, "antes de 1970" e "sem ano". */
export function eraOf(year: number | undefined): string {
  if (!year || year < 1000 || year > 3000) return NO_YEAR;
  if (year < 1970) return PRE;
  return String(Math.floor(year / 10) * 10);
}
export function eraLabel(key: string): string {
  if (key === PRE) return "Antes de 1970";
  if (key === NO_YEAR) return "Sem ano";
  return `${key}s`;
}
/** Ordem de exibição: da mais recente para a mais antiga, "sem ano" por último. */
const eraRank = (k: string) => (k === NO_YEAR ? -2 : k === PRE ? -1 : Number(k));

export function allRows(lib: Library): Row[] {
  const out: Row[] = [];
  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (item) out.push({ e, item });
  }
  return out;
}

type Facet = "status" | "media" | "era";

/** Aplica todos os filtros, menos o da faceta `skip` (usado para contar o que cada chip traria). */
function match(r: Row, f: Filters, skip?: Facet): boolean {
  if (skip !== "status" && r.e.status !== f.status) return false;
  if (skip !== "media" && f.media !== "tudo" && r.item.media !== f.media) return false;
  if (skip !== "era" && f.era !== "tudo" && eraOf(r.item.year) !== f.era) return false;
  if (f.vibes.length && !f.vibes.every((v) => r.item.vibes.includes(v))) return false;
  const q = norm(f.q.trim());
  if (q && !norm(r.item.title).includes(q) && !norm(r.item.author ?? "").includes(q)) return false;
  return true;
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter((r) => match(r, f)).sort((a, b) => {
    const byTitle = a.item.title.localeCompare(b.item.title);
    if (f.sort === "titulo") return byTitle;
    if (f.sort === "nota") return (b.e.rating ?? -1) - (a.e.rating ?? -1) || byTitle;
    if (f.sort === "ano") return (b.item.year ?? 0) - (a.item.year ?? 0) || byTitle;
    return b.e.at - a.e.at || byTitle;
  });
}

export interface Facets {
  status: Record<Status, number>;
  media: Record<Media | "tudo", number>;
  eras: { key: string; label: string; count: number }[];
  vibes: { vibe: string; count: number }[];
}

/** Contagem de cada opção considerando os outros filtros ativos (não o da própria faceta). */
export function facets(rows: Row[], f: Filters): Facets {
  const status: Record<Status, number> = { quero: 0, andamento: 0, concluido: 0, abandonei: 0 };
  for (const r of rows) if (match(r, f, "status")) status[r.e.status]++;

  const media = { tudo: 0 } as Record<Media | "tudo", number>;
  for (const m of MEDIAS) media[m] = 0;
  for (const r of rows) if (match(r, f, "media")) { media[r.item.media]++; media.tudo++; }

  const eraCount = new Map<string, number>();
  for (const r of rows) if (match(r, f, "era")) eraCount.set(eraOf(r.item.year), (eraCount.get(eraOf(r.item.year)) ?? 0) + 1);
  if (f.era !== "tudo" && !eraCount.has(f.era)) eraCount.set(f.era, 0); // a época marcada nunca some
  const eras = [...eraCount].map(([key, count]) => ({ key, label: eraLabel(key), count })).sort((a, b) => eraRank(b.key) - eraRank(a.key));

  const vibeCount = new Map<string, number>();
  // estilos são "todos marcados": só sobram os que ainda aparecem junto com os já escolhidos
  for (const r of rows) if (match(r, f)) for (const v of new Set(r.item.vibes)) vibeCount.set(v, (vibeCount.get(v) ?? 0) + 1);
  for (const v of f.vibes) if (!vibeCount.has(v)) vibeCount.set(v, 0);
  const vibes = [...vibeCount].map(([vibe, count]) => ({ vibe, count })).sort((a, b) => b.count - a.count || a.vibe.localeCompare(b.vibe));

  return { status, media, eras, vibes };
}

export const isFiltered = (f: Filters) => f.media !== "tudo" || f.era !== "tudo" || f.vibes.length > 0 || f.q.trim() !== "";
