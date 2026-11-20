import { NextResponse } from "next/server";
import { ANILIST_URL, mapAniList, type AniListEntry, type AniListResponse } from "@/lib/anilist";
import type { MalEntry } from "@/lib/importers";

export const maxDuration = 60;

const MAX = 1500;
const BATCH = 50;

const QUERY = /* GraphQL */ `
  query ($ids: [Int], $page: Int) {
    Page(page: $page, perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        id
        idMal
        seasonYear
        countryOfOrigin
        title { romaji english }
        genres
        tags { name rank }
        coverImage { large }
      }
    }
  }
`;

type Media = AniListEntry["media"] & { idMal: number };

async function fetchBatch(ids: number[]): Promise<Media[]> {
  const res = await fetch(process.env.ANILIST_URL ?? ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { ids, page: 1 } }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { Page?: { media?: Media[] } } };
  return body.data?.Page?.media ?? [];
}

export async function POST(req: Request) {
  let list: MalEntry[];
  try {
    const body = (await req.json()) as { entries?: MalEntry[] };
    list = Array.isArray(body.entries) ? body.entries : [];
  } catch {
    return NextResponse.json({ error: "invalid", message: "Pedido inválido." }, { status: 400 });
  }
  list = list
    .filter((e) => Number.isInteger(e?.malId) && e.malId > 0 && typeof e.status === "string")
    .slice(0, MAX);
  if (list.length === 0) {
    return NextResponse.json({ error: "empty", message: "Não encontramos animes nesse arquivo." }, { status: 400 });
  }

  const media = new Map<number, Media>();
  try {
    for (let i = 0; i < list.length; i += BATCH) {
      for (const m of await fetchBatch(list.slice(i, i + BATCH).map((e) => e.malId))) media.set(m.idMal, m);
    }
  } catch {
    return NextResponse.json(
      { error: "upstream", message: "O AniList não respondeu agora. Tente de novo daqui a pouco." },
      { status: 502 },
    );
  }

  const entries: AniListEntry[] = [];
  let unknown = 0;
  for (const e of list) {
    const m = media.get(e.malId);
    if (!m) {
      unknown++;
      continue;
    }
    entries.push({ status: e.status, score: e.score, media: m });
  }
  const res: AniListResponse = { data: { MediaListCollection: { lists: [{ entries }] } } };
  return NextResponse.json({ ...mapAniList(res), unknown });
}
