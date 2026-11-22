import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildFilmImport, MAX_FILMS, parseBooks, parseCsv, parseLetterboxd, parseMalXml } from "../importers";
import type { Item } from "../types";

const fx = (n: string) => readFileSync(new URL(`../../../e2e/fixtures/${n}`, import.meta.url), "utf8");

describe("parseMalXml", () => {
  it("lê status, nota e ids do export", () => {
    const r = parseMalXml(fx("animelist.xml"));
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ malId: 1535, status: "COMPLETED", score: 10 });
    expect(r.find((e) => e.malId === 30)?.status).toBe("DROPPED");
    expect(r.find((e) => e.malId === 32)).toMatchObject({ status: "PLANNING", score: 0 });
    expect(r.find((e) => e.malId === 999999)?.status).toBe("CURRENT");
  });
  it("ignora duplicatas, status desconhecido e lixo", () => {
    const xml = `<anime><series_animedb_id>5</series_animedb_id><my_status>Completed</my_status><my_score>7</my_score></anime>
      <anime><series_animedb_id>5</series_animedb_id><my_status>Completed</my_status></anime>
      <anime><series_animedb_id>6</series_animedb_id><my_status>Whatever</my_status></anime>
      <anime><series_animedb_id>abc</series_animedb_id><my_status>Completed</my_status></anime>`;
    expect(parseMalXml(xml)).toEqual([{ malId: 5, status: "COMPLETED", score: 7 }]);
    expect(parseMalXml("não é xml")).toEqual([]);
  });
  it("limita a nota entre 0 e 10", () => {
    const xml = `<anime><series_animedb_id>1</series_animedb_id><my_status>Completed</my_status><my_score>99</my_score></anime>`;
    expect(parseMalXml(xml)[0].score).toBe(10);
  });
});

describe("parseCsv", () => {
  it("trata aspas, vírgulas, aspas duplas e quebras dentro de campo", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"l1\nl2",z\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["l1\nl2", "z"],
    ]);
  });
  it("aceita BOM e linhas vazias", () => {
    expect(parseCsv("﻿a,b\n\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseLetterboxd", () => {
  const files = () => [
    { name: "ratings.csv", text: fx("ratings.csv") },
    { name: "watchlist.csv", text: fx("watchlist.csv") },
  ];
  it("avaliados viram concluídos com nota; watchlist vira quero ver", () => {
    const { films, total } = parseLetterboxd(files());
    expect(total).toBe(4);
    expect(films[0]).toMatchObject({ title: "Duna", year: 2021, status: "concluido", rating: 4.5 });
    expect(films.find((f) => f.title === "Cidade de Deus, o filme")?.rating).toBe(5);
    expect(films.find((f) => f.title === "Matrix")).toMatchObject({ status: "quero", rating: undefined });
  });
  it("assistido sem nota sobrepõe a watchlist e o mesmo filme não duplica", () => {
    const { films } = parseLetterboxd([
      { name: "watchlist.csv", text: "Date,Name,Year,Letterboxd URI\nx,Matrix,1999,u" },
      { name: "watched.csv", text: "Date,Name,Year,Letterboxd URI\nx,Matrix,1999,u" },
    ]);
    expect(films).toEqual([{ title: "Matrix", year: 1999, status: "concluido", rating: undefined }]);
  });
  it("nota fora de 0,5–5 é descartada e arredonda para meia estrela", () => {
    const { films } = parseLetterboxd([{ name: "ratings.csv", text: "Date,Name,Year,Letterboxd URI,Rating\nx,A,2000,u,7\nx,B,2000,u,3.7" }]);
    expect(films.find((f) => f.title === "A")?.rating).toBeUndefined();
    expect(films.find((f) => f.title === "B")?.rating).toBe(3.5);
  });
  it("corta em MAX_FILMS priorizando avaliados", () => {
    const rows = Array.from({ length: 200 }, (_, i) => `x,F${i},2000,u,${i < 20 ? 4 : ""}`).join("\n");
    const { films, total } = parseLetterboxd([{ name: "ratings.csv", text: "Date,Name,Year,Letterboxd URI,Rating\n" + rows }]);
    expect(total).toBe(200);
    expect(films).toHaveLength(MAX_FILMS);
    expect(films.slice(0, 20).every((f) => f.rating === 4)).toBe(true);
  });
  it("ignora arquivos desconhecidos", () => {
    expect(parseLetterboxd([{ name: "comments.csv", text: "a,b\n1,2" }]).films).toEqual([]);
  });
});

describe("buildFilmImport", () => {
  const it1: Item = { id: "tmdb:movie:1", title: "Duna", media: "filme", vibes: ["aventura"], source: "tmdb" };
  const it2: Item = { id: "tmdb:movie:2", title: "Sem vibe", media: "filme", vibes: [], source: "tmdb" };
  it("conta status, filmes não encontrados e itens sem vibes; remove repetidos", () => {
    const films = [
      { title: "Duna", status: "concluido" as const, rating: 5 },
      { title: "Duna 2", status: "quero" as const },
      { title: "Sumiu", status: "quero" as const },
      { title: "Sem vibe", status: "concluido" as const },
    ];
    const r = buildFilmImport(films, [it1, it1, null, it2], 123);
    expect(r.items).toHaveLength(2);
    expect(r.entries[0]).toEqual({ itemId: "tmdb:movie:1", status: "concluido", rating: 5, at: 123 });
    expect(r.counts).toEqual({ quero: 0, andamento: 0, concluido: 2, abandonei: 0, pausei: 0 });
    expect(r.missing).toBe(1);
    expect(r.withoutVibes).toBe(1);
  });
});

describe("parseBooks", () => {
  it("lê o export do Goodreads: estante, nota 0 = sem nota, ano original", () => {
    const csv = [
      "Book Id,Title,Author,My Rating,Year Published,Original Publication Year,Exclusive Shelf",
      '1,"Dom Casmurro",Machado de Assis,5,2016,1899,read',
      "2,Duna,Frank Herbert,0,2017,1965,currently-reading",
      "3,Torto Arado,Itamar Vieira Junior,0,2019,,to-read",
      "4,Sem estante,Alguém,4,2000,,shelf-inventada",
    ].join("\n");
    const r = parseBooks(csv);
    expect(r.from).toBe("goodreads");
    expect(r.books).toEqual([
      { title: "Dom Casmurro", author: "Machado de Assis", year: 1899, status: "concluido", rating: 5 },
      { title: "Duna", author: "Frank Herbert", year: 1965, status: "andamento", rating: undefined },
      { title: "Torto Arado", author: "Itamar Vieira Junior", year: 2019, status: "quero", rating: undefined },
    ]);
  });

  it("lê o export do StoryGraph: primeiro autor, nota fracionada vira meia estrela, abandonado", () => {
    const csv = ["Title,Authors,Read Status,Star Rating", '"O Hobbit","J.R.R. Tolkien, Outro",read,4.25', "Ulisses,James Joyce,did-not-finish,"].join("\n");
    const r = parseBooks(csv);
    expect(r.from).toBe("storygraph");
    expect(r.books.map((b) => [b.title, b.author, b.status, b.rating])).toEqual([
      ["O Hobbit", "J.R.R. Tolkien", "concluido", 4.5],
      ["Ulisses", "James Joyce", "abandonei", undefined],
    ]);
  });

  it("recusa CSV que não é de nenhum dos dois", () => {
    expect(parseBooks("Name,Year,Rating\nDuna,2021,4").from).toBeNull();
  });
});

describe("buildFilmImport valida o que vem do aparelho", () => {
  it("descarta status inventado e nota fora de 0,5 a 5", () => {
    const it1 = { id: "a", title: "A", media: "livro", vibes: ["drama humano"] } as Item;
    const it2 = { id: "b", title: "B", media: "livro", vibes: ["drama humano"] } as Item;
    const r = buildFilmImport(
      [{ title: "A", status: "hackeado" as never, rating: 5 }, { title: "B", status: "concluido", rating: 99 }],
      [it1, it2],
    );
    expect(r.entries).toEqual([{ itemId: "b", status: "concluido", rating: undefined, at: expect.any(Number) }]);
  });
});
