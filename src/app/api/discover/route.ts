import { NextResponse } from "next/server";
import { discoverAll } from "@/lib/sources";
import { VIBES } from "@/lib/vibes";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("vibes") ?? "";
  const valid = new Set<string>(VIBES);
  const vibes = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => valid.has(v))
    .slice(0, 5);
  if (vibes.length === 0) return NextResponse.json({ items: [], sources: {} });
  return NextResponse.json(await discoverAll(vibes));
}
