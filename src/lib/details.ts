/** Detalhes de uma obra (sinopse, elenco, trailer, onde assistir). Mapeadores puros, um por fonte. */
export interface Details {
  synopsis?: string;
  cast?: string[];
  /** diretor, criador, estúdio ou desenvolvedora */
  makers?: string[];
  trailer?: string;
  providers?: string[];
  /** nota da própria fonte, já em 0 a 10 */
  score?: { value: number; source: string };
  facts: string[];
  similar?: string[];
}

const YT = /^[\w-]{6,15}$/;
const ytUrl = (key?: string | null) => (key && YT.test(key) ? `https://www.youtube.com/watch?v=${key}` : undefined);
const uniq = (xs: (string | undefined | null)[], max: number) =>
  Array.from(new Set(xs.filter((x): x is string => !!x && x.trim() !== ""))).slice(0, max);

/** Tira marcas HTML que o AniList deixa na sinopse. */
export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&#x27;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clip = (s: string | undefined, n = 900) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

/* ------------------------------- TMDB ------------------------------- */

export interface TmdbDetailsRaw {
  overview?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  vote_count?: number;
  genres?: { name: string }[];
  created_by?: { name: string }[];
  credits?: { cast?: { name: string }[]; crew?: { name: string; job: string }[] };
  videos?: { results?: { site: string; type: string; key: string; official?: boolean }[] };
  "watch/providers"?: { results?: Record<string, { flatrate?: { provider_name: string }[] }> };
}

export function mapTmdbDetails(r: TmdbDetailsRaw, tv: boolean): Details {
  const facts: string[] = [];
  if (!tv && r.runtime) facts.push(r.runtime >= 60 ? `${Math.floor(r.runtime / 60)}h ${String(r.runtime % 60).padStart(2, "0")}min` : `${r.runtime}min`);
  if (tv && r.number_of_seasons) {
    facts.push(r.number_of_seasons === 1 ? "1 temporada" : `${r.number_of_seasons} temporadas`);
    if (r.number_of_episodes) facts.push(`${r.number_of_episodes} episódios`);
  }
  facts.push(...uniq((r.genres ?? []).map((g) => g.name), 3));
  const vids = (r.videos?.results ?? []).filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  const best = vids.find((v) => v.type === "Trailer" && v.official) ?? vids.find((v) => v.type === "Trailer") ?? vids[0];
  const directors = (r.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
  return {
    synopsis: clip(r.overview?.trim() || undefined),
    cast: uniq((r.credits?.cast ?? []).map((c) => c.name), 6),
    makers: uniq(tv ? (r.created_by ?? []).map((c) => c.name) : directors, 3),
    trailer: ytUrl(best?.key),
    providers: uniq((r["watch/providers"]?.results?.BR?.flatrate ?? []).map((p) => p.provider_name), 6),
    score: r.vote_average && (r.vote_count ?? 0) >= 20 ? { value: Math.round(r.vote_average * 10) / 10, source: "TMDB" } : undefined,
    facts,
  };
}

/* ------------------------------- IGDB ------------------------------- */

export interface IgdbDetailsRaw {
  summary?: string;
  total_rating?: number;
  total_rating_count?: number;
  genres?: { name: string }[];
  platforms?: { name: string }[];
  involved_companies?: { developer?: boolean; company?: { name: string } }[];
  videos?: { video_id: string }[];
  similar_games?: { name: string }[];
}

export function mapIgdbDetails(g: IgdbDetailsRaw): Details {
  const facts = [...uniq((g.platforms ?? []).map((p) => p.name), 4), ...uniq((g.genres ?? []).map((x) => x.name), 2)];
  return {
    synopsis: clip(g.summary?.trim() || undefined),
    makers: uniq((g.involved_companies ?? []).filter((c) => c.developer).map((c) => c.company?.name), 3),
    trailer: ytUrl(g.videos?.[0]?.video_id),
    score: g.total_rating && (g.total_rating_count ?? 0) >= 5 ? { value: Math.round(g.total_rating) / 10, source: "IGDB" } : undefined,
    facts,
    similar: uniq((g.similar_games ?? []).map((s) => s.name), 5),
  };
}

/* ------------------------------ AniList ------------------------------ */

export interface AniListDetailsRaw {
  description?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  format?: string | null;
  averageScore?: number | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  studios?: { nodes?: { name: string; isAnimationStudio?: boolean }[] } | null;
  staff?: { edges?: { role?: string; node?: { name?: { full?: string } } }[] } | null;
  recommendations?: { nodes?: { mediaRecommendation?: { title?: { english?: string | null; romaji?: string | null } } | null }[] } | null;
}

export function mapAniListDetails(m: AniListDetailsRaw): Details {
  const facts: string[] = [];
  if (m.format) facts.push(m.format.replace(/_/g, " "));
  if (m.episodes) facts.push(m.episodes === 1 ? "1 episódio" : `${m.episodes} episódios`);
  if (m.chapters) facts.push(`${m.chapters} capítulos`);
  if (m.volumes) facts.push(m.volumes === 1 ? "1 volume" : `${m.volumes} volumes`);
  const studios = (m.studios?.nodes ?? []).filter((s) => s.isAnimationStudio !== false).map((s) => s.name);
  const authors = (m.staff?.edges ?? []).filter((e) => /story|art/i.test(e.role ?? "")).map((e) => e.node?.name?.full);
  return {
    synopsis: clip(m.description ? stripHtml(m.description) : undefined),
    makers: uniq([...studios, ...authors], 3),
    trailer: m.trailer?.site?.toLowerCase() === "youtube" ? ytUrl(m.trailer.id) : undefined,
    score: m.averageScore ? { value: Math.round(m.averageScore) / 10, source: "AniList" } : undefined,
    facts,
    similar: uniq((m.recommendations?.nodes ?? []).map((n) => n.mediaRecommendation?.title?.english || n.mediaRecommendation?.title?.romaji), 5),
  };
}

/* --------------------------- Open Library --------------------------- */

export interface OpenLibraryWorkRaw {
  description?: string | { value?: string } | null;
  subjects?: string[];
  first_publish_date?: string;
  covers?: number[];
}

export function mapOpenLibraryDetails(w: OpenLibraryWorkRaw, author?: string): Details {
  const raw = typeof w.description === "string" ? w.description : w.description?.value;
  // o Open Library costuma colar links e separadores no fim do texto
  const text = raw?.split(/\r?\n-{3,}|\r?\n\s*\(\[source\]/i)[0].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
  const subjects = uniq((w.subjects ?? []).filter((s) => s.length < 32 && !/^(accessible|protected|large type|open library|reading level)/i.test(s)), 4);
  return {
    synopsis: clip(text || undefined),
    makers: uniq([author], 1),
    facts: subjects,
  };
}

/* ----------------------------- MusicBrainz ----------------------------- */

export interface MusicBrainzDetailsRaw {
  "primary-type"?: string | null;
  "secondary-types"?: string[] | null;
  "first-release-date"?: string | null;
  disambiguation?: string | null;
  "artist-credit"?: { name?: string; artist?: { name?: string } }[] | null;
  tags?: { name: string; count?: number }[] | null;
  releases?: unknown[] | null;
}

export function mapMusicBrainzDetails(g: MusicBrainzDetailsRaw): Details {
  const facts: string[] = [];
  const year = g["first-release-date"]?.slice(0, 4);
  if (g["primary-type"]) facts.push(g["primary-type"] === "Album" ? "Álbum" : g["primary-type"]);
  if (year && /^\d{4}$/.test(year)) facts.push(year);
  // as tags mais votadas são o retrato do gênero que a comunidade dá ao álbum
  facts.push(...uniq((g.tags ?? []).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).map((t) => t.name), 3));
  const makers = uniq((g["artist-credit"] ?? []).map((a) => a.name || a.artist?.name), 3);
  return { synopsis: clip(g.disambiguation?.trim() || undefined), makers, facts };
}
