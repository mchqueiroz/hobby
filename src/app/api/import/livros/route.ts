import { NextResponse } from "next/server";
import { buildFilmImport, MAX_FILMS, type Book } from "@/lib/importers";
import { openLibraryFind } from "@/lib/sources";
import type { Item } from "@/lib/types";

export const maxDuration = 60;

/** Goodreads e StoryGraph: o aparelho lê o CSV e manda só título, autor, nota e status; aqui cada livro é achado no Open Library. */
export async function POST(req: Request) {
  let books: Book[];
  try {
    const body = (await req.json()) as { books?: Book[] };
    books = Array.isArray(body.books) ? body.books : [];
  } catch {
    return NextResponse.json({ error: "invalid", message: "Pedido inválido." }, { status: 400 });
  }
  books = books
    .filter((b) => typeof b?.title === "string" && b.title && b.title.length <= 200 && (b.author === undefined || (typeof b.author === "string" && b.author.length <= 120)))
    .slice(0, MAX_FILMS);
  if (books.length === 0) {
    return NextResponse.json({ error: "empty", message: "Não encontramos livros nesse arquivo." }, { status: 400 });
  }

  const found: (Item | null)[] = new Array(books.length).fill(null);
  let failures = 0;
  let next = 0;
  // 4 consultas ao mesmo tempo: o Open Library é gratuito e pede moderação
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < books.length) {
        const i = next++;
        try {
          found[i] = await openLibraryFind(books[i].title, books[i].author);
        } catch {
          failures++;
        }
      }
    }),
  );
  if (failures === books.length) {
    return NextResponse.json({ error: "upstream", message: "O Open Library não respondeu agora. Tente de novo daqui a pouco." }, { status: 502 });
  }
  return NextResponse.json(buildFilmImport(books, found));
}
