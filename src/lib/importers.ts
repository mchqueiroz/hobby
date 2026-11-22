import type { AniListEntry, Imported } from "./anilist";
import type { Entry, Item, Status } from "./types";

/* ------------------------------ MyAnimeList (XML) ------------------------------ */

export interface MalEntry {
  malId: number;
  status: AniListEntry["status"];
  score: number;
}

const MAL_STATUS: Record<string, AniListEntry["status"]> = {
  completed: "COMPLETED",
  watching: "CURRENT",
  "plan to watch": "PLANNING",
  dropped: "DROPPED",
  "on-hold": "PAUSED",
  // o export às vezes traz o código numérico
  "1": "CURRENT",
  "2": "COMPLETED",
  "3": "PAUSED",
  "4": "DROPPED",
  "6": "PLANNING",
};

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`));
  return m?.[1].trim();
}

/** Lê o export oficial do MyAnimeList (animelist.xml). Ignora mangá e entradas inválidas. */
export function parseMalXml(xml: string): MalEntry[] {
  const out: MalEntry[] = [];
  const seen = new Set<number>();
  for (const m of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const block = m[1];
    const id = Number(tag(block, "series_animedb_id"));
    const status = MAL_STATUS[(tag(block, "my_status") ?? "").toLowerCase()];
    if (!Number.isInteger(id) || id <= 0 || !status || seen.has(id)) continue;
    seen.add(id);
    const score = Number(tag(block, "my_score"));
    out.push({ malId: id, status, score: Number.isFinite(score) ? Math.min(10, Math.max(0, score)) : 0 });
  }
  return out;
}

/* --------------------------------- Letterboxd (CSV) --------------------------------- */

/** CSV simples (RFC 4180): aspas, vírgulas e quebras de linha dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export interface Film {
  title: string;
  year?: number;
  status: Status;
  rating?: number;
}

export const MAX_FILMS = 150;

function rowsAsObjects(text: string): Record<string, string>[] {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/**
 * Junta ratings.csv, watched.csv e watchlist.csv do export do Letterboxd.
 * Com nota ou assistido: concluído. Na watchlist: quero ver. Fica no máximo MAX_FILMS, dando prioridade aos avaliados.
 */
export function parseLetterboxd(files: { name: string; text: string }[]): { films: Film[]; total: number } {
  const map = new Map<string, Film>();
  const key = (t: string, y?: number) => `${t.toLowerCase()}|${y ?? ""}`;
  const put = (r: Record<string, string>, status: Status) => {
    const title = r["name"];
    if (!title) return;
    const year = Number(r["year"]) || undefined;
    const rating = r["rating"] ? Number(r["rating"]) : undefined;
    const k = key(title, year);
    const prev = map.get(k);
    const valid = rating !== undefined && rating >= 0.5 && rating <= 5 ? Math.round(rating * 2) / 2 : undefined;
    if (!prev) map.set(k, { title, year, status, rating: valid });
    else if (status === "concluido") map.set(k, { ...prev, status, rating: valid ?? prev.rating });
  };
  for (const f of files) {
    const n = f.name.toLowerCase();
    const rows = rowsAsObjects(f.text);
    if (n.includes("watchlist")) rows.forEach((r) => put(r, "quero"));
    else if (n.includes("ratings") || n.includes("watched") || n.includes("diary")) rows.forEach((r) => put(r, "concluido"));
  }
  const all = [...map.values()];
  const rank = (f: Film) => (f.rating !== undefined ? 0 : f.status === "concluido" ? 1 : 2);
  const films = all.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_FILMS);
  return { films, total: all.length };
}

/** Monta o resultado de importação a partir dos filmes e dos itens que o TMDB reconheceu (mesma ordem, null = não achou). */
export function buildFilmImport(films: Film[], found: (Item | null)[], now = Date.now()): Imported & { missing: number } {
  const items: Item[] = [];
  const entries: Entry[] = [];
  const counts: Record<Status, number> = { quero: 0, andamento: 0, concluido: 0, abandonei: 0, pausei: 0 };
  const seen = new Set<string>();
  let withoutVibes = 0;
  let missing = 0;
  films.forEach((f, i) => {
    const it = found[i];
    if (!it) {
      missing++;
      return;
    }
    if (seen.has(it.id)) return;
    seen.add(it.id);
    if (it.vibes.length === 0) withoutVibes++;
    items.push(it);
    entries.push({ itemId: it.id, status: f.status, rating: f.rating, at: now });
    counts[f.status]++;
  });
  return { items, entries, counts, withoutVibes, missing };
}
