import { NextResponse } from "next/server";
import { cacheFor, discoverAll } from "@/lib/sources";
import { VIBES } from "@/lib/vibes";

/** 4 páginas de 20 por fonte bastam para meses de sugestões e mantêm a cota das APIs sob controle */
const MAX_PAGE = 4;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("vibes") ?? "";
  const valid = new Set<string>(VIBES);
  const vibes = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => valid.has(v))
    .slice(0, 5);
  if (vibes.length === 0) return NextResponse.json({ items: [], sources: {} });
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1));
  // a resposta só depende das vibes: o cache da borda poupa cota do TMDB, IGDB e AniList
  const r = await discoverAll(vibes, page);
  return NextResponse.json(r, { headers: { "Cache-Control": cacheFor(r, 3600, 86400) } });
}
