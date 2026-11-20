import { ANILIST_GENRES, ANILIST_TAGS, IGDB_TERMS, TMDB_GENRES, collect, mbVibes, olVibes, type Vibe } from "./vibes";
import type { Item, Media } from "./types";

/* ---------- mapeadores puros: resposta da API -> Item ---------- */

const yearOf = (d?: string | null) => {
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 1800 ? y : undefined;
};

export const tmdbPoster = (path?: string | null) =>
  path && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/w342${path}` : undefined;
export const igdbCover = (imageId?: string | null) =>
  imageId && /^[a-z0-9]+$/i.test(imageId) ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : undefined;
export const anilistCover = (url?: string | null) =>
  url && /^https:\/\/s\d+\.anilist\.co\//.test(url) ? url : undefined;

/** Nota pública de 0 a 10, só quando há votos suficientes para não ser ruído. */
export function publicScore(score: number | null | undefined, votes: number | undefined, minVotes: number): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0 || score > 10) return undefined;
  if (votes !== undefined && votes < minVotes) return undefined;
  return Math.round(score * 10) / 10;
}

export interface TmdbResult {
  poster_path?: string | null;
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  origin_country?: string[];
  vote_average?: number;
  vote_count?: number;
}

export function mapTmdb(r: TmdbResult, fallbackType?: "movie" | "tv"): Item | null {
  const type = r.media_type ?? fallbackType;
  if (type !== "movie" && type !== "tv") return null;
  const title = (type === "movie" ? r.title : r.name) ?? r.title ?? r.name;
  if (!title || typeof r.id !== "number") return null;
  const table: Record<string, Vibe[]> = {};
  for (const [k, v] of Object.entries(TMDB_GENRES)) table[k] = v;
  const vibes = collect((r.genre_ids ?? []).map(String), table);
  return {
    id: `tmdb:${type}:${r.id}`,
    title,
    media: "filme",
    year: yearOf(type === "movie" ? r.release_date : r.first_air_date),
    vibes,
    brazil: r.origin_country?.includes("BR") || undefined,
    source: "tmdb",
    cover: tmdbPoster(r.poster_path),
    quality: publicScore(r.vote_average, r.vote_count, 50),
  };
}

export interface IgdbGame {
  id: number;
  name?: string;
  first_release_date?: number;
  genres?: { name: string }[];
  themes?: { name: string }[];
  keywords?: { name: string }[];
  cover?: { image_id?: string };
  total_rating?: number;
  total_rating_count?: number;
}

export function mapIgdb(g: IgdbGame): Item | null {
  if (!g.name || typeof g.id !== "number") return null;
  const terms = [...(g.genres ?? []), ...(g.themes ?? [])].map((x) => x.name);
  return {
    id: `igdb:${g.id}`,
    title: g.name,
    media: "jogo",
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    vibes: collect(terms, IGDB_TERMS),
    source: "igdb",
    cover: igdbCover(g.cover?.image_id),
    quality: publicScore(g.total_rating === undefined ? undefined : g.total_rating / 10, g.total_rating_count, 10),
  };
}

export interface AniListMedia {
  id: number;
  seasonYear?: number | null;
  countryOfOrigin?: string | null;
  title: { romaji?: string | null; english?: string | null };
  genres?: string[] | null;
  tags?: { name: string; rank?: number | null }[] | null;
  coverImage?: { large?: string | null } | null;
  averageScore?: number | null;
}

export function mapAniListMedia(m: AniListMedia, media: "anime" | "manga" = "anime"): Item | null {
  const title = m.title?.english || m.title?.romaji;
  if (!title || typeof m.id !== "number") return null;
  const terms = [
    ...collect(m.genres ?? [], ANILIST_GENRES, 6),
  ];
  const tagVibes = collect(
    (m.tags ?? []).filter((t) => (t.rank ?? 0) >= 50).map((t) => t.name),
    ANILIST_TAGS,
    6,
  );
  return {
    // anime e mangá têm numerações separadas no AniList: o mangá leva o tipo no id
    id: media === "manga" ? `anilist:manga:${m.id}` : `anilist:${m.id}`,
    title,
    media,
    year: m.seasonYear ?? undefined,
    vibes: Array.from(new Set([...terms, ...tagVibes])).slice(0, 6),
    source: "anilist",
    cover: anilistCover(m.coverImage?.large),
    quality: publicScore(m.averageScore === null || m.averageScore === undefined ? undefined : m.averageScore / 10, undefined, 0),
  };
}

/* ---------- genres inversos para o "descobrir" ---------- */

/** Para cada vibe, os termos de cada API que a produzem. */
export function termsFor<T extends string | number>(table: Record<T, Vibe[]>, vibe: string): T[] {
  return (Object.keys(table) as unknown as T[]).filter((k) => table[k].includes(vibe as Vibe));
}
export function tmdbGenreIdsFor(vibe: string): number[] {
  return Object.entries(TMDB_GENRES)
    .filter(([, v]) => v.includes(vibe as Vibe))
    .map(([k]) => Number(k));
}

export const MEDIA_ORDER: Media[] = ["anime", "manga", "livro", "jogo", "filme"];

export type SourceState = "ok" | "error" | "off";
export interface RemoteResult {
  items: Item[];
  sources: { tmdb: SourceState; igdb: SourceState; anilist: SourceState; openlibrary: SourceState; musicbrainz: SourceState };
}

/* ---------- Open Library (livros) ---------- */

export const olCover = (id?: number) => (typeof id === "number" && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : undefined);

export interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  cover_i?: number;
  ratings_average?: number;
  ratings_count?: number;
}

export function mapOpenLibrary(d: OpenLibraryDoc): Item | null {
  const m = /^\/works\/(OL\d+W)$/.exec(d.key ?? "");
  if (!m || !d.title) return null;
  return {
    id: `openlibrary:${m[1]}`,
    title: d.title,
    media: "livro",
    year: d.first_publish_year && d.first_publish_year > 0 ? d.first_publish_year : undefined,
    vibes: olVibes(d.subject ?? []),
    source: "openlibrary",
    cover: olCover(d.cover_i),
    author: d.author_name?.[0],
    // a nota do Open Library é de 0 a 5; só vale com votos suficientes
    quality: publicScore(d.ratings_average === undefined ? undefined : d.ratings_average * 2, d.ratings_count, 20),
  };
}

/* ---------- MusicBrainz (álbuns) + Cover Art Archive ---------- */

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isMbid = (s: string | undefined): s is string => !!s && MBID.test(s);
export const mbCover = (id: string) => (isMbid(id) ? `https://coverartarchive.org/release-group/${id.toLowerCase()}/front-250` : undefined);

export interface MusicBrainzGroup {
  id?: string;
  title?: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[] | null;
  "first-release-date"?: string | null;
  "artist-credit"?: { name?: string; artist?: { name?: string } }[] | null;
  tags?: { name: string; count?: number }[] | null;
}

/** Ao vivo, coletânea, remix e afins ficam de fora: o registro é do álbum de estúdio (trilha sonora entra). */
const NOT_STUDIO = /^(live|compilation|remix|demo|dj-mix|mixtape\/street|interview|spokenword|audiobook|audio drama|field recording)$/i;

export function artistOf(g: MusicBrainzGroup): string | undefined {
  const names = (g["artist-credit"] ?? []).map((a) => a.name || a.artist?.name).filter((n): n is string => !!n);
  return names.length ? names.join(" e ").slice(0, 80) : undefined;
}

export function mapMusicBrainz(g: MusicBrainzGroup): Item | null {
  if (!isMbid(g.id) || !g.title || g["primary-type"]?.toLowerCase() !== "album") return null;
  if ((g["secondary-types"] ?? []).some((t) => NOT_STUDIO.test(t))) return null;
  return {
    id: `musicbrainz:${g.id.toLowerCase()}`,
    title: g.title,
    media: "musica",
    year: yearOf(g["first-release-date"]),
    vibes: mbVibes(g.tags ?? []),
    source: "musicbrainz",
    cover: mbCover(g.id),
    author: artistOf(g),
  };
}
