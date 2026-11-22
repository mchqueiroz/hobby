import { NextResponse } from "next/server";
import { cacheFor, searchAll } from "@/lib/sources";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ items: [], sources: {} });
  const r = await searchAll(q);
  return NextResponse.json(r, { headers: { "Cache-Control": cacheFor(r, 600, 3600) } });
}
