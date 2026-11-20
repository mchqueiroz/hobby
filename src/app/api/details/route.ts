import { NextResponse } from "next/server";
import { MEDIAS, type Media } from "@/lib/types";

const isMedia = (m: string | null): m is Media => !!m && (MEDIAS as readonly string[]).includes(m);
import { findDetails } from "@/lib/sources";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const title = q.get("title")?.trim() ?? "";
  const media = q.get("media");
  const year = Number(q.get("year")) || undefined;
  const artist = q.get("artist")?.trim().slice(0, 80) || undefined;
  if (!id || id.length > 60 || !title || title.length > 120 || !isMedia(media)) {
    return NextResponse.json({ details: null }, { status: 400 });
  }
  try {
    const details = await findDetails({ id, title, media, year, artist });
    return NextResponse.json({ details }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ details: null, error: "upstream" });
  }
}
