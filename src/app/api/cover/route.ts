import { NextResponse } from "next/server";
import { MEDIAS, type Media } from "@/lib/types";

const isMedia = (m: string | null): m is Media => !!m && (MEDIAS as readonly string[]).includes(m);
import { findCover } from "@/lib/sources";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = q.get("title")?.trim() ?? "";
  const media = q.get("media");
  const year = Number(q.get("year")) || undefined;
  const artist = q.get("artist")?.trim().slice(0, 80) || undefined;
  if (!title || title.length > 120 || !isMedia(media)) {
    return NextResponse.json({ url: null }, { status: 400 });
  }
  try {
    const url = await findCover(title, media, year, artist);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ url: null });
  }
}
