import { ANILIST_GENRES, IGDB_TERMS, MB_DISCOVER, OL_DISCOVER } from "./vibes";
import {
  mapAniListMedia,
  isMbid,
  mapIgdb,
  mapMusicBrainz,
  mapOpenLibrary,
  mapTmdb,
  termsFor,
  tmdbGenreIdsFor,
  type AniListMedia,
  type IgdbGame,
  type MusicBrainzGroup,
  type OpenLibraryDoc,
  type RemoteResult,
  type SourceState,
  type TmdbResult,
} from "./remote";
import { ANILIST_URL } from "./anilist";
import type { Item, Media } from "./types";

/** APIs abertas (Open Library, MusicBrainz) pedem um contato no User-Agent. Defina CONTACT_URL (site ou e-mail) no .env.local; o padrão é a página do projeto. */
const USER_AGENT = `Hobby/1.0 (app de estudo; ${process.env.CONTACT_URL || "https://github.com/mchqueiroz/hobby"})`;
import {
  mapAniListDetails,
  mapIgdbDetails,
  mapMusicBrainzDetails,
  mapOpenLibraryDetails,
  mapTmdbDetails,
  type AniListDetailsRaw,
  type Details,
  type IgdbDetailsRaw,
  type MusicBrainzDetailsRaw,
  type OpenLibraryWorkRaw,
  type TmdbDetailsRaw,
} from "./details";

/**
 * Consultas às APIs externas. Só roda no servidor (chaves em variáveis de ambiente).
 * Os *_BASE são para testes com servidor simulado; em produção ficam vazios.
 */
const env = (k: string) => process.env[k] || undefined;
const TMDB_BASE = () => env("TMDB_BASE") ?? "https://api.themoviedb.org";
const IGDB_BASE = () => env("IGDB_BASE") ?? "https://api.igdb.com";
const TWITCH_TOKEN_URL = () => env("TWITCH_TOKEN_URL") ?? "https://id.twitch.tv/oauth2/token";
const ANILIST = () => env("ANILIST_URL") ?? ANILIST_URL;
const MUSICBRAINZ = () => env("MUSICBRAINZ_BASE") ?? "https://musicbrainz.org";
const OPENLIB = () => env("OPENLIB_BASE") ?? "https://openlibrary.org";

const TIMEOUT = 8_000;

export const configured = () => ({
  tmdb: !!env("TMDB_READ_TOKEN"),
  igdb: !!env("IGDB_CLIENT_ID") && !!env("IGDB_CLIENT_SECRET"),
});

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/* ------------------------------ TMDB ------------------------------ */

function tmdbGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(TMDB_BASE() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url, {
    headers: { Authorization: `Bearer ${env("TMDB_READ_TOKEN")}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  }).then((r) => json<T>(r));
}

export async function tmdbSearch(q: string): Promise<Item[]> {
  const body = await tmdbGet<{ results?: TmdbResult[] }>("/3/search/multi", {
    query: q,
    language: "pt-BR",
    include_adult: "false",
  });
  return (body.results ?? []).map((r) => mapTmdb(r)).filter((i): i is Item => !!i).slice(0, 8);
}

/** Acha um filme pelo título e ano (usado na importação do Letterboxd). */
export async function tmdbFindMovie(title: string, year?: number): Promise<Item | null> {
  const params: Record<string, string> = { query: title, language: "pt-BR", include_adult: "false" };
  if (year) params.year = String(year);
  const body = await tmdbGet<{ results?: TmdbResult[] }>("/3/search/movie", params);
  const first = body.results?.[0];
  return first ? mapTmdb(first, "movie") : null;
}

/** Cada fonte devolve 20 por página; `page` (a partir de 1) deixa a Descobrir pedir mais quando as primeiras acabam. */
export async function tmdbDiscover(vibes: string[], page = 1): Promise<Item[]> {
  const ids = Array.from(new Set(vibes.flatMap(tmdbGenreIdsFor)));
  if (ids.length === 0) return [];
  const params = {
    with_genres: ids.join("|"),
    sort_by: "popularity.desc",
    "vote_count.gte": "300",
    language: "pt-BR",
    include_adult: "false",
    page: String(page),
  };
  // se só uma das duas buscas falhar, a outra ainda vale
  const [movies, shows] = await Promise.allSettled([
    tmdbGet<{ results?: TmdbResult[] }>("/3/discover/movie", params),
    tmdbGet<{ results?: TmdbResult[] }>("/3/discover/tv", params),
  ]);
  if (movies.status === "rejected" && shows.status === "rejected") throw movies.reason;
  const list = (r: typeof movies, kind: "movie" | "tv") => (r.status === "fulfilled" ? (r.value.results ?? []).map((x) => mapTmdb(x, kind)) : []);
  return [...list(movies, "movie"), ...list(shows, "tv")].filter((i): i is Item => !!i);
}

/* ------------------------------ IGDB ------------------------------ */

let token: { value: string; exp: number } | null = null;

async function igdbToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const url = new URL(TWITCH_TOKEN_URL());
  url.searchParams.set("client_id", env("IGDB_CLIENT_ID")!);
  url.searchParams.set("client_secret", env("IGDB_CLIENT_SECRET")!);
  url.searchParams.set("grant_type", "client_credentials");
  const body = await json<{ access_token: string; expires_in: number }>(
    await fetch(url, { method: "POST", signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" }),
  );
  token = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function igdbQuery(apicalypse: string): Promise<IgdbGame[]> {
  const res = await fetch(IGDB_BASE() + "/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env("IGDB_CLIENT_ID")!,
      Authorization: `Bearer ${await igdbToken()}`,
      Accept: "application/json",
    },
    body: apicalypse,
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (res.status === 401) token = null;
  return json<IgdbGame[]>(res);
}

const IGDB_FIELDS = "fields name, first_release_date, genres.name, themes.name, cover.image_id, total_rating, total_rating_count;";

export async function igdbSearch(q: string): Promise<Item[]> {
  const safe = q.replace(/["\\]/g, " ");
  const games = await igdbQuery(`search "${safe}"; ${IGDB_FIELDS} where version_parent = null; limit 8;`);
  return games.map(mapIgdb).filter((i): i is Item => !!i);
}

export async function igdbDiscover(vibes: string[], page = 1): Promise<Item[]> {
  const names = Array.from(new Set(vibes.flatMap((v) => termsFor(IGDB_TERMS, v))));
  if (names.length === 0) return [];
  const list = names.map((n) => `"${n}"`).join(",");
  const games = await igdbQuery(
    `${IGDB_FIELDS} where (genres.name = (${list}) | themes.name = (${list})) & total_rating_count > 100 & version_parent = null; sort total_rating_count desc; limit 20; offset ${(page - 1) * 20};`,
  );
  return games.map(mapIgdb).filter((i): i is Item => !!i);
}

/* ----------------------------- AniList ----------------------------- */

const MEDIA_FIELDS = `id seasonYear countryOfOrigin title { romaji english } genres tags { name rank } coverImage { large } averageScore`;

async function anilist(query: string, variables: Record<string, unknown>): Promise<AniListMedia[]> {
  const res = await fetch(ANILIST(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const body = await json<{ data?: { Page?: { media?: AniListMedia[] } } }>(res);
  return body.data?.Page?.media ?? [];
}

export async function anilistSearch(q: string, media: "anime" | "manga" = "anime"): Promise<Item[]> {
  const type = media === "manga" ? "MANGA" : "ANIME";
  const found = await anilist(
    `query ($q: String) { Page(perPage: 8) { media(search: $q, type: ${type}, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} } } }`,
    { q },
  );
  return found.map((m) => mapAniListMedia(m, media)).filter((i): i is Item => !!i);
}

export async function anilistDiscover(vibes: string[], media: "anime" | "manga" = "anime", page = 1): Promise<Item[]> {
  const genres = Array.from(new Set(vibes.flatMap((v) => termsFor(ANILIST_GENRES, v))));
  if (genres.length === 0) return [];
  const type = media === "manga" ? "MANGA" : "ANIME";
  const found = await anilist(
    `query ($g: [String], $p: Int) { Page(page: $p, perPage: 20) { media(type: ${type}, genre_in: $g, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} } } }`,
    { g: genres, p: page },
  );
  return found.map((m) => mapAniListMedia(m, media)).filter((i): i is Item => !!i);
}

/* --------------------------- Open Library --------------------------- */

const OL_FIELDS = "key,title,author_name,first_publish_year,subject,cover_i,ratings_average,ratings_count";

async function olGet<T>(url: URL): Promise<T> {
  return json<T>(
    await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    }),
  );
}

export async function openLibrarySearch(q: string): Promise<Item[]> {
  const url = new URL(OPENLIB() + "/search.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", OL_FIELDS);
  const body = await olGet<{ docs?: OpenLibraryDoc[] }>(url);
  return (body.docs ?? []).map(mapOpenLibrary).filter((i): i is Item => !!i);
}

export async function openLibraryDiscover(vibes: string[], page = 1): Promise<Item[]> {
  const subjects = Array.from(new Set(vibes.map((v) => OL_DISCOVER[v as keyof typeof OL_DISCOVER]).filter((s): s is string => !!s))).slice(0, 4);
  if (subjects.length === 0) return [];
  const url = new URL(OPENLIB() + "/search.json");
  url.searchParams.set("q", subjects.map((s) => `subject:"${s}"`).join(" OR "));
  url.searchParams.set("sort", "rating");
  url.searchParams.set("limit", "20");
  url.searchParams.set("page", String(page));
  url.searchParams.set("fields", OL_FIELDS);
  const body = await olGet<{ docs?: OpenLibraryDoc[] }>(url);
  return (body.docs ?? []).map(mapOpenLibrary).filter((i): i is Item => !!i && i.vibes.length > 0);
}

/* ----------------------------- MusicBrainz ----------------------------- */

// o MusicBrainz exige um User-Agent identificável e aceita cerca de 1 pedido por segundo por IP
const MB_UA = USER_AGENT;

async function mbGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(MUSICBRAINZ() + path);
  url.searchParams.set("fmt", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const get = () =>
    fetch(url, { headers: { Accept: "application/json", "User-Agent": MB_UA }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  let res = await get();
  // 503 = limite de ~1 pedido/s por IP ou servidor ocupado: tenta mais uma vez depois de 1,1 s
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 1_100));
    res = await get();
  }
  return json<T>(res);
}

/** Tira os caracteres que a busca do MusicBrainz (Lucene) trata como operador. */
export const lucene = (s: string) => s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();

const ALBUM_ONLY = "primarytype:album AND NOT secondarytype:live AND NOT secondarytype:compilation";

/** Busca de álbuns. Com `artist`, procura aquele título daquele artista (usado para achar capa e detalhes do catálogo base). */
export async function musicBrainzSearch(q: string, artist?: string): Promise<Item[]> {
  const t = lucene(q);
  if (!t) return [];
  // artista composto ("Elis Regina e Tom Jobim") procura pelo primeiro; "Vários artistas" não filtra por artista
  const a = artist && !/^vários/i.test(artist) ? lucene(artist.split(/ e | & |, | and /)[0]) : "";
  const query = a ? `releasegroup:"${t}" AND artist:"${a}" AND ${ALBUM_ONLY}` : `(releasegroup:(${t}) OR artist:(${t})) AND ${ALBUM_ONLY}`;
  const body = await mbGet<{ "release-groups"?: MusicBrainzGroup[] }>("/ws/2/release-group", { query, limit: "12" });
  return (body["release-groups"] ?? []).map(mapMusicBrainz).filter((i): i is Item => !!i).slice(0, 8);
}

export async function musicBrainzDiscover(vibes: string[], page = 1): Promise<Item[]> {
  const tags = Array.from(new Set(vibes.map((v) => MB_DISCOVER[v as keyof typeof MB_DISCOVER]).filter((s): s is string => !!s))).slice(0, 3);
  if (tags.length === 0) return [];
  const query = `(${tags.map((t) => `tag:"${lucene(t)}"`).join(" OR ")}) AND ${ALBUM_ONLY}`;
  const body = await mbGet<{ "release-groups"?: MusicBrainzGroup[] }>("/ws/2/release-group", { query, limit: "25", offset: String((page - 1) * 25) });
  // só álbum com tag votada por várias pessoas: o MusicBrainz não ordena por popularidade, e isto afasta os obscuros
  return (body["release-groups"] ?? [])
    .filter((g) => (g.tags ?? []).some((t) => (t.count ?? 0) >= 3))
    .map(mapMusicBrainz)
    .filter((i): i is Item => !!i && i.vibes.length >= 2);
}

/* ------------------- junta tolerando falha por fonte ------------------- */

async function settle(
  name: string,
  on: boolean,
  run: () => Promise<Item[]>,
): Promise<{ items: Item[]; state: SourceState }> {
  if (!on) return { items: [], state: "off" };
  try {
    return { items: await run(), state: "ok" };
  } catch (e) {
    // aparece no log da Vercel; sem a consulta, que pode ter o que a pessoa digitou
    console.warn("[hobby-fonte]", name, e instanceof Error ? e.message : String(e));
    return { items: [], state: "error" };
  }
}

/** Cache de borda: resposta com fonte em erro fica pouco tempo, para a próxima pessoa não herdar a falha. */
export const cacheFor = (r: RemoteResult, sMaxAge: number, swr: number) =>
  Object.values(r.sources).includes("error")
    ? "public, max-age=0, s-maxage=30"
    : `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;

function merge(
  t: { items: Item[]; state: SourceState },
  g: { items: Item[]; state: SourceState },
  a: { items: Item[]; state: SourceState },
  m: { items: Item[]; state: SourceState },
  o: { items: Item[]; state: SourceState },
  u: { items: Item[]; state: SourceState },
): RemoteResult {
  return {
    items: [...a.items, ...m.items, ...o.items, ...u.items, ...g.items, ...t.items],
    sources: {
      tmdb: t.state,
      igdb: g.state,
      anilist: a.state === "ok" || m.state === "ok" ? "ok" : a.state,
      openlibrary: o.state,
      musicbrainz: u.state,
    },
  };
}

export async function searchAll(q: string): Promise<RemoteResult> {
  const c = configured();
  const [t, g, a, m, o, u] = await Promise.all([
    settle("tmdb", c.tmdb, () => tmdbSearch(q)),
    settle("igdb", c.igdb, () => igdbSearch(q)),
    settle("anilist", true, () => anilistSearch(q, "anime")),
    settle("anilist-manga", true, () => anilistSearch(q, "manga")),
    settle("openlibrary", true, () => openLibrarySearch(q)),
    settle("musicbrainz", true, () => musicBrainzSearch(q)),
  ]);
  return merge(t, g, a, m, o, u);
}

export async function discoverAll(vibes: string[], page = 1): Promise<RemoteResult> {
  const c = configured();
  const [t, g, a, m, o, u] = await Promise.all([
    settle("tmdb", c.tmdb, () => tmdbDiscover(vibes, page)),
    settle("igdb", c.igdb, () => igdbDiscover(vibes, page)),
    settle("anilist", true, () => anilistDiscover(vibes, "anime", page)),
    settle("anilist-manga", true, () => anilistDiscover(vibes, "manga", page)),
    settle("openlibrary", true, () => openLibraryDiscover(vibes, page)),
    settle("musicbrainz", true, () => musicBrainzDiscover(vibes, page)),
  ]);
  return merge(t, g, a, m, o, u);
}

/* --------------- capa de um título conhecido (catálogo base) --------------- */

export async function findCover(title: string, media: Media, year?: number, artist?: string): Promise<string | null> {
  const c = configured();
  if (media === "musica") {
    const found = await musicBrainzSearch(title, artist);
    const hit = (year && found.find((i) => i.year === year)) || found[0];
    return hit?.cover ?? null;
  }
  if (media === "filme") {
    if (!c.tmdb) return null;
    const body = await tmdbGet<{ results?: TmdbResult[] }>("/3/search/multi", { query: title, language: "pt-BR", include_adult: "false" });
    const hits = (body.results ?? []).filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path);
    const y = (r: TmdbResult) => Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4));
    const best = (year && hits.find((r) => Math.abs(y(r) - year) <= 1)) || hits[0];
    return best ? (mapTmdb(best)?.cover ?? null) : null;
  }
  if (media === "jogo") {
    if (!c.igdb) return null;
    const safe = title.replace(/["\\]/g, " ");
    const games = await igdbQuery(`search "${safe}"; ${IGDB_FIELDS} where cover != null & version_parent = null; limit 3;`);
    return games.map(mapIgdb).find((i) => i?.cover)?.cover ?? null;
  }
  if (media === "livro") {
    const found = await openLibrarySearch(title);
    return found.find((i) => i.cover)?.cover ?? null;
  }
  const found = await anilistSearch(title, media === "manga" ? "manga" : "anime");
  return found.find((i) => i.cover)?.cover ?? null;
}

/* ------------------------------ detalhes ------------------------------ */

export interface DetailsQuery {
  id: string;
  title: string;
  media: Media;
  year?: number;
  artist?: string;
}

const ANILIST_DETAILS = `
  description(asHtml: false) episodes chapters volumes format averageScore
  trailer { id site }
  externalLinks { site url type }
  nextAiringEpisode { airingAt episode }
  startDate { year month day }
  studios { nodes { name isAnimationStudio } }
  recommendations(perPage: 5, sort: RATING_DESC) { nodes { mediaRecommendation { title { romaji english } } } }`;

async function anilistRaw(query: string, variables: Record<string, unknown>): Promise<AniListDetailsRaw | null> {
  const res = await fetch(ANILIST(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const body = await json<{ data?: { Media?: AniListDetailsRaw | null } }>(res);
  return body.data?.Media ?? null;
}

export async function findDetails(q: DetailsQuery): Promise<Details | null> {
  const c = configured();
  const [kind, a, b] = q.id.split(":");

  if (q.media === "filme") {
    if (!c.tmdb) return null;
    let type: "movie" | "tv" | null = kind === "tmdb" && (a === "movie" || a === "tv") ? a : null;
    let tid = type ? b : null;
    if (!type) {
      const s = await tmdbGet<{ results?: TmdbResult[] }>("/3/search/multi", { query: q.title, language: "pt-BR", include_adult: "false" });
      const hits = (s.results ?? []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
      const y = (r: TmdbResult) => Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4));
      const best = (q.year && hits.find((r) => Math.abs(y(r) - q.year!) <= 1)) || hits[0];
      if (!best) return null;
      type = best.media_type as "movie" | "tv";
      tid = String(best.id);
    }
    if (!/^\d+$/.test(tid ?? "")) return null;
    const raw = await tmdbGet<TmdbDetailsRaw>(`/3/${type}/${tid}`, {
      language: "pt-BR",
      append_to_response: "credits,videos,watch/providers",
      include_video_language: "pt,en,null",
    });
    return mapTmdbDetails(raw, type === "tv");
  }

  if (q.media === "jogo") {
    if (!c.igdb) return null;
    const fields = "fields summary, first_release_date, total_rating, total_rating_count, genres.name, platforms.name, involved_companies.developer, involved_companies.company.name, videos.video_id, similar_games.name, websites.category, websites.url;";
    const where = kind === "igdb" && /^\d+$/.test(a ?? "")
      ? `where id = ${a};`
      : `search "${q.title.replace(/["\\]/g, " ")}"; where version_parent = null;`;
    const games = await igdbQuery(`${fields} ${where} limit 1;`);
    return games[0] ? mapIgdbDetails(games[0] as unknown as IgdbDetailsRaw) : null;
  }

  if (q.media === "musica") {
    let mbid = kind === "musicbrainz" && isMbid(a) ? a : null;
    if (!mbid) {
      const hit = (await musicBrainzSearch(q.title, q.artist))[0];
      mbid = hit ? hit.id.split(":")[1] : null;
    }
    if (!mbid) return null;
    const g = await mbGet<MusicBrainzDetailsRaw>(`/ws/2/release-group/${mbid}`, { inc: "artist-credits+tags" });
    return mapMusicBrainzDetails(g);
  }

  if (q.media === "livro") {
    let key = kind === "openlibrary" && /^OL\d+W$/.test(a ?? "") ? a : null;
    let author: string | undefined;
    if (!key) {
      const url = new URL(OPENLIB() + "/search.json");
      url.searchParams.set("q", q.title);
      url.searchParams.set("limit", "1");
      url.searchParams.set("fields", OL_FIELDS);
      const hit = (await olGet<{ docs?: OpenLibraryDoc[] }>(url)).docs?.[0];
      key = /^\/works\/(OL\d+W)$/.exec(hit?.key ?? "")?.[1] ?? null;
      author = hit?.author_name?.[0];
    }
    if (!key) return null;
    const work = await olGet<OpenLibraryWorkRaw>(new URL(`${OPENLIB()}/works/${key}.json`));
    return mapOpenLibraryDetails(work, author);
  }

  // anime e mangá (AniList)
  const type = q.media === "manga" ? "MANGA" : "ANIME";
  const numeric = kind === "anilist" && (q.media === "manga" ? a === "manga" && /^\d+$/.test(b ?? "") : /^\d+$/.test(a ?? ""));
  if (numeric) {
    const m = await anilistRaw(`query ($id: Int) { Media(id: $id, type: ${type}) { ${ANILIST_DETAILS} } }`, { id: Number(q.media === "manga" ? b : a) });
    return m ? mapAniListDetails(m) : null;
  }
  const m = await anilistRaw(`query ($q: String) { Media(search: $q, type: ${type}) { ${ANILIST_DETAILS} } }`, { q: q.title });
  return m ? mapAniListDetails(m) : null;
}
