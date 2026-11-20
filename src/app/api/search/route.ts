import { NextResponse } from "next/server";
import { searchAll } from "@/lib/sources";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ items: [], sources: {} });
  return NextResponse.json(await searchAll(q));
}
