import { NextResponse } from "next/server";
import { configured } from "@/lib/sources";

/** Só diz se cada fonte está configurada. Nunca devolve valor de chave. */
export async function GET() {
  const c = configured();
  return NextResponse.json({ tmdb: c.tmdb, igdb: c.igdb }, { headers: { "Cache-Control": "no-store" } });
}
