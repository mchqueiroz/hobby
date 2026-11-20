import { NextResponse } from "next/server";
import { buildFilmImport, MAX_FILMS, type Film } from "@/lib/importers";
import { configured, tmdbFindMovie } from "@/lib/sources";
import type { Item } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!configured().tmdb) {
    return NextResponse.json(
      { error: "off", message: "A importação do Letterboxd precisa da chave do TMDB, que ainda não foi configurada." },
      { status: 503 },
    );
  }
  let films: Film[];
  try {
    const body = (await req.json()) as { films?: Film[] };
    films = Array.isArray(body.films) ? body.films : [];
  } catch {
    return NextResponse.json({ error: "invalid", message: "Pedido inválido." }, { status: 400 });
  }
  films = films.filter((f) => typeof f?.title === "string" && f.title && f.title.length <= 200).slice(0, MAX_FILMS);
  if (films.length === 0) {
    return NextResponse.json({ error: "empty", message: "Não encontramos filmes nesses arquivos." }, { status: 400 });
  }

  const found: (Item | null)[] = new Array(films.length).fill(null);
  let failures = 0;
  let next = 0;
  // 5 consultas ao mesmo tempo, para respeitar o limite do TMDB
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (next < films.length) {
        const i = next++;
        try {
          found[i] = await tmdbFindMovie(films[i].title, films[i].year);
        } catch {
          failures++;
        }
      }
    }),
  );
  if (failures === films.length) {
    return NextResponse.json(
      { error: "upstream", message: "O TMDB não respondeu agora. Tente de novo daqui a pouco." },
      { status: 502 },
    );
  }
  return NextResponse.json(buildFilmImport(films, found));
}
