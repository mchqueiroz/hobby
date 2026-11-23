import { MEDIAS, type Item, type Media } from "./types";

/**
 * Lista compartilhada por link, sem servidor: a lista vai no fragmento (#d=...) do endereço, que o navegador não envia
 * a ninguém. Quem abre vê as obras e pode salvar uma cópia. Como o link vem de outra pessoa, tudo é validado ao ler.
 */
export const MAX_SHARED = 100;

type Row = [id: string, title: string, media: Media, year?: number | null, author?: string | null, cover?: string | null];
const SOURCES = new Set<string>(["seed", "anilist", "tmdb", "igdb", "steam", "openlibrary", "musicbrainz", "deezer"]);

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export function encodeList(name: string, items: Item[]): string {
  const rows: Row[] = items.slice(0, MAX_SHARED).map((i) => [i.id, i.title, i.media, i.year ?? null, i.author ?? null, i.cover ?? null]);
  return b64url(JSON.stringify({ v: 1, n: name.slice(0, 60), i: rows }));
}

const str = (x: unknown, max: number) => (typeof x === "string" && x.trim() && x.length <= max ? x.trim() : undefined);

/** Devolve null para qualquer coisa que não seja uma lista válida. Capa só https; fonte só das conhecidas. */
export function decodeList(data: string): { name: string; items: Item[] } | null {
  try {
    const o = JSON.parse(unb64url(data)) as { v?: number; n?: unknown; i?: unknown };
    const name = str(o.n, 60);
    if (o.v !== 1 || !name || !Array.isArray(o.i)) return null;
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const r of o.i.slice(0, MAX_SHARED)) {
      if (!Array.isArray(r)) continue;
      const [id, title, media, year, author, cover] = r as unknown[];
      const sid = str(id, 120);
      const st = str(title, 200);
      const source = sid?.split(":")[0] ?? "";
      if (!sid || !st || !MEDIAS.includes(media as Media) || !SOURCES.has(source) || seen.has(sid)) continue;
      seen.add(sid);
      const c = str(cover, 400);
      items.push({
        id: sid,
        title: st,
        media: media as Media,
        year: typeof year === "number" && Number.isInteger(year) && year > 0 && year < 3000 ? year : undefined,
        author: str(author, 120),
        cover: c && /^https:\/\//.test(c) ? c : undefined,
        vibes: [],
        source: source as Item["source"],
      });
    }
    return items.length ? { name, items } : null;
  } catch {
    return null;
  }
}
