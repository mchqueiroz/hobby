import { ANILIST_GENRES, ANILIST_TAGS, collect, onlyValid } from "./vibes";
import type { Entry, Item, Status } from "./types";
import { anilistCover } from "./remote";

export const ANILIST_URL = "https://graphql.anilist.co";

export const ANILIST_QUERY = /* GraphQL */ `
  query ($userName: String) {
    MediaListCollection(userName: $userName, type: ANIME) {
      lists {
        entries {
          status
          score(format: POINT_10_DECIMAL)
          media {
            id
            seasonYear
            countryOfOrigin
            title {
              romaji
              english
            }
            genres
            tags {
              name
              rank
            }
            coverImage {
              large
            }
          }
        }
      }
    }
  }
`;

export interface AniListEntry {
  status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
  score: number | null;
  media: {
    id: number;
    seasonYear: number | null;
    countryOfOrigin: string | null;
    title: { romaji: string | null; english: string | null };
    genres: string[] | null;
    tags: { name: string; rank: number | null }[] | null;
    coverImage?: { large?: string | null } | null;
  };
}

export interface AniListResponse {
  data?: { MediaListCollection: { lists: { entries: AniListEntry[] }[] } | null };
  errors?: { message: string; status?: number }[];
}

const STATUS: Record<AniListEntry["status"], Status> = {
  COMPLETED: "concluido",
  CURRENT: "andamento",
  REPEATING: "andamento",
  PAUSED: "andamento",
  PLANNING: "quero",
  DROPPED: "abandonei",
};

/** Só tags em que o AniList tem alguma confiança entram na tradução. */
const MIN_TAG_RANK = 50;

export interface Imported {
  items: Item[];
  entries: Entry[];
  counts: Record<Status, number>;
  /** itens para os quais não foi possível calcular nenhuma vibe */
  withoutVibes: number;
}

export function mapAniList(res: AniListResponse, now = Date.now()): Imported {
  const lists = res.data?.MediaListCollection?.lists ?? [];
  const seen = new Set<number>();
  const items: Item[] = [];
  const entries: Entry[] = [];
  const counts: Record<Status, number> = { quero: 0, andamento: 0, concluido: 0, abandonei: 0 };
  let withoutVibes = 0;

  for (const list of lists) {
    for (const e of list.entries) {
      // listas personalizadas repetem a mesma obra: conta uma vez só
      if (seen.has(e.media.id)) continue;
      seen.add(e.media.id);

      const title = e.media.title.english || e.media.title.romaji;
      if (!title) continue;

      const tagNames = (e.media.tags ?? [])
        .filter((t) => (t.rank ?? 0) >= MIN_TAG_RANK)
        .map((t) => t.name);
      const vibes = onlyValid([
        ...collect(tagNames, ANILIST_TAGS, 4),
        ...collect(e.media.genres ?? [], ANILIST_GENRES, 4),
      ]).slice(0, 6);
      if (vibes.length === 0) withoutVibes++;

      const id = `anilist:${e.media.id}`;
      items.push({
        id,
        title,
        media: "anime",
        year: e.media.seasonYear ?? undefined,
        vibes,
        source: "anilist",
        cover: anilistCover(e.media.coverImage?.large),
      });

      const status = STATUS[e.status] ?? "quero";
      counts[status]++;
      // score 0 no AniList significa "sem nota". Nota de 0 a 10 vira 0,5 a 5 em passos de 0,5.
      const rating =
        e.score && e.score > 0 ? Math.min(5, Math.max(0.5, Math.round(e.score) / 2)) : undefined;
      entries.push({ itemId: id, status, rating, at: now });
    }
  }
  return { items, entries, counts, withoutVibes };
}

export type ImportError = "invalid" | "not_found" | "private" | "rate_limited" | "upstream";

export const USER_RE = /^[A-Za-z0-9_]{2,20}$/;

export function classifyError(res: AniListResponse, httpStatus: number): ImportError | null {
  if (httpStatus === 429) return "rate_limited";
  const err = res.errors?.[0];
  if (!err) return httpStatus >= 400 ? "upstream" : null;
  const status = err.status ?? httpStatus;
  if (/private/i.test(err.message)) return "private";
  if (status === 404 || /not found/i.test(err.message)) return "not_found";
  if (status === 429) return "rate_limited";
  return "upstream";
}
