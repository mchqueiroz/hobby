import { describe, expect, it } from "vitest";
import { mapAniListMedia, mapIgdb, mapMusicBrainz, mapOpenLibrary, mapTmdb, tmdbGenreIdsFor, termsFor } from "../remote";
import { mergeResults, buildPool } from "../search";
import { SEED } from "../catalog";
import { VIBES, ANILIST_GENRES, MB_TAGS, mbVibes, olVibes } from "../vibes";
import { cleanData } from "../telemetry";
import type { Item } from "../types";

describe("mapTmdb", () => {
  it("mapeia filme com gêneros e Brasil", () => {
    const i = mapTmdb({ id: 1, media_type: "movie", title: "Bacurau", release_date: "2019-08-23", genre_ids: [18, 53], origin_country: ["BR"] })!;
    expect(i.id).toBe("tmdb:movie:1");
    expect(i.media).toBe("filme");
    expect(i.year).toBe(2019);
    expect(i.brazil).toBe(true);
    expect(i.vibes).toEqual(expect.arrayContaining(["drama humano", "mistério", "sombrio"]));
  });
  it("série usa name e first_air_date; pessoa é ignorada", () => {
    const t = mapTmdb({ id: 2, media_type: "tv", name: "3%", first_air_date: "2016-11-25", genre_ids: [10765] })!;
    expect(t.id).toBe("tmdb:tv:2");
    expect(t.title).toBe("3%");
    expect(mapTmdb({ id: 3, media_type: "person", name: "X" })).toBeNull();
  });
  it("discover sem media_type usa o tipo informado", () => {
    expect(mapTmdb({ id: 4, title: "A", genre_ids: [] }, "movie")?.id).toBe("tmdb:movie:4");
    expect(mapTmdb({ id: 4, title: "A" })).toBeNull();
  });
});

describe("mapIgdb", () => {
  it("mapeia gêneros e temas, ano em UTC", () => {
    const g = mapIgdb({ id: 9, name: "Hades", first_release_date: 1600128000, genres: [{ name: "Role-playing (RPG)" }], themes: [{ name: "Fantasy" }] })!;
    expect(g.id).toBe("igdb:9");
    expect(g.media).toBe("jogo");
    expect(g.year).toBe(2020);
    expect(g.vibes).toEqual(expect.arrayContaining(["jornada épica", "fantasia"]));
  });
  it("sem nome é descartado", () => expect(mapIgdb({ id: 1 })).toBeNull());
});

describe("mapAniListMedia", () => {
  it("prefere título em inglês e filtra tags de baixa confiança", () => {
    const a = mapAniListMedia({ id: 5, seasonYear: 2006, title: { romaji: "Desu Noto", english: "Death Note" }, genres: ["Mystery", "Psychological"], tags: [{ name: "Detective", rank: 90 }, { name: "War", rank: 10 }] })!;
    expect(a.title).toBe("Death Note");
    expect(a.vibes).toEqual(expect.arrayContaining(["mistério", "psicológico", "investigação"]));
    expect(a.vibes).not.toContain("guerra");
  });
});

describe("tabelas inversas", () => {
  it("todo vibe com gênero TMDB devolve ids; vibes inventados não", () => {
    expect(tmdbGenreIdsFor("ficção científica")).toEqual(expect.arrayContaining([878, 10765]));
    expect(tmdbGenreIdsFor("inexistente")).toEqual([]);
    expect(termsFor(ANILIST_GENRES, "mistério")).toEqual(expect.arrayContaining(["Mystery", "Thriller"]));
    expect(VIBES.length).toBe(33);
  });
});

describe("mergeResults / buildPool", () => {
  const mk = (id: string, title: string, media: Item["media"]): Item => ({ id, title, media, vibes: ["aventura"], source: "tmdb" });
  it("local vence duplicata de mesmo título e mídia, mídia diferente fica", () => {
    const local = [mk("a", "Dune", "filme")];
    const out = mergeResults(local, [mk("b", "dune", "filme"), mk("c", "Dune", "jogo")]);
    expect(out.map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("respeita o limite", () => {
    expect(mergeResults([], Array.from({ length: 20 }, (_, n) => mk(String(n), `T${n}`, "filme")), 8)).toHaveLength(8);
  });
  it("pool mantém todo o catálogo base e não duplica", () => {
    const seed = SEED[0];
    const pool = buildPool([{ ...seed, id: "tmdb:movie:1", source: "tmdb" }, mk("z", "Novo", "filme")]);
    expect(pool).toHaveLength(SEED.length + 1);
    expect(pool.find((i) => i.id === seed.id)).toBeTruthy();
  });
});

describe("cleanData", () => {
  it("só passa números, booleanos e textos curtos", () => {
    const d = cleanData({ ms: 1200, ok: true, s: "x".repeat(100), bad: NaN } as never)!;
    expect(d.ms).toBe(1200);
    expect(d.ok).toBe(true);
    expect((d.s as string).length).toBe(40);
    expect("bad" in d).toBe(false);
  });
});

describe("capas", () => {
  it("monta URLs e rejeita valores estranhos", async () => {
    const { tmdbPoster, igdbCover, anilistCover } = await import("../remote");
    expect(tmdbPoster("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(tmdbPoster("/../x")).toBeUndefined();
    expect(tmdbPoster("http://evil/x.jpg")).toBeUndefined();
    expect(tmdbPoster(null)).toBeUndefined();
    expect(igdbCover("co4jni")).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg");
    expect(igdbCover("a/b")).toBeUndefined();
    expect(anilistCover("https://s4.anilist.co/file/x.jpg")).toBe("https://s4.anilist.co/file/x.jpg");
    expect(anilistCover("https://evil.example/x.jpg")).toBeUndefined();
  });
  it("mapeadores carregam a capa", () => {
    expect(mapTmdb({ id: 1, media_type: "movie", title: "A", poster_path: "/p.jpg" })?.cover).toContain("/p.jpg");
    expect(mapIgdb({ id: 1, name: "G", cover: { image_id: "abc" } })?.cover).toContain("abc.jpg");
    expect(mapAniListMedia({ id: 1, title: { romaji: "X" }, coverImage: { large: "https://s1.anilist.co/a.jpg" } })?.cover).toBe("https://s1.anilist.co/a.jpg");
  });
});

describe("mangá e Open Library", () => {
  it("mangá leva o tipo no id, para não colidir com o anime de mesmo número", () => {
    const raw = { id: 30013, title: { romaji: "One Piece", english: null }, genres: ["Action", "Adventure"] };
    const anime = mapAniListMedia(raw);
    const manga = mapAniListMedia(raw, "manga");
    expect(anime?.id).toBe("anilist:30013");
    expect(manga?.id).toBe("anilist:manga:30013");
    expect(manga?.media).toBe("manga");
  });
  it("livro: mapeia autor, ano, capa e nota (0–5 vira 0–10, só com votos)", () => {
    const b = mapOpenLibrary({ key: "/works/OL1W", title: "1984", author_name: ["George Orwell"], first_publish_year: 1949, subject: ["Dystopia", "Political fiction"], cover_i: 9, ratings_average: 4.2, ratings_count: 500 });
    expect(b).toMatchObject({ id: "openlibrary:OL1W", media: "livro", author: "George Orwell", year: 1949, source: "openlibrary", quality: 8.4 });
    expect(b?.cover).toBe("https://covers.openlibrary.org/b/id/9-M.jpg");
    expect(b?.vibes).toContain("futurista");
    expect(mapOpenLibrary({ key: "/works/OL2W", title: "X", ratings_average: 5, ratings_count: 3 })?.quality).toBeUndefined();
  });
  it("livro: chave inválida ou sem título é descartado (nada de montar URL com texto de fora)", () => {
    expect(mapOpenLibrary({ key: "/authors/OL1A", title: "X" })).toBeNull();
    expect(mapOpenLibrary({ key: "/works/OL1W" })).toBeNull();
    expect(mapOpenLibrary({ key: "/works/../x", title: "X" })).toBeNull();
  });
  it("olVibes: assunto que contém a chave conta, os mais citados vêm primeiro, sem inventar vibe", () => {
    expect(olVibes(["Fantasy fiction", "Fantasy"])[0]).toBe("fantasia");
    expect(olVibes(["Cooking"])).toEqual([]);
    expect(olVibes(["Mystery", "Detective and mystery stories"])[0]).toBe("mistério");
  });
});

describe("música (MusicBrainz)", () => {
  const ID = "b1392450-e666-3926-a536-22c65f834433";
  const album = {
    id: ID, title: "OK Computer", "primary-type": "Album", "secondary-types": [] as string[], "first-release-date": "1997-05-21",
    "artist-credit": [{ name: "Radiohead" }], tags: [{ name: "alternative rock", count: 12 }, { name: "art rock", count: 4 }, { name: "electronic", count: 2 }],
  };
  it("mapeia álbum: id, artista, ano, capa e vibes", () => {
    const i = mapMusicBrainz(album);
    expect(i).toMatchObject({ id: `musicbrainz:${ID}`, media: "musica", author: "Radiohead", year: 1997, source: "musicbrainz" });
    expect(i?.cover).toBe(`https://coverartarchive.org/release-group/${ID}/front-250`);
    expect(i?.vibes.length).toBeGreaterThan(0);
    expect(i?.quality).toBeUndefined();
  });
  it("junta artistas e descarta ao vivo, coletânea, singles e id inválido", () => {
    expect(mapMusicBrainz({ ...album, "artist-credit": [{ name: "Elis Regina" }, { artist: { name: "Tom Jobim" } }] })?.author).toBe("Elis Regina e Tom Jobim");
    expect(mapMusicBrainz({ ...album, "secondary-types": ["Live"] })).toBeNull();
    expect(mapMusicBrainz({ ...album, "secondary-types": ["Compilation"] })).toBeNull();
    expect(mapMusicBrainz({ ...album, "secondary-types": ["Soundtrack"] })).not.toBeNull();
    expect(mapMusicBrainz({ ...album, "primary-type": "Single" })).toBeNull();
    expect(mapMusicBrainz({ ...album, id: "../../x" })).toBeNull();
    expect(mapMusicBrainz({ ...album, title: undefined })).toBeNull();
  });
  it("mbVibes: tag mais votada pesa mais; a específica ganha da genérica; tag desconhecida não vira vibe", () => {
    expect(mbVibes([{ name: "progressive rock", count: 5 }, { name: "rock", count: 1 }])).toEqual(expect.arrayContaining(["filosófico"]));
    expect(mbVibes([{ name: "progressive rock", count: 5 }])).not.toContain("energético");
    expect(mbVibes([{ name: "seen live", count: 9 }, { name: "favourite", count: 3 }])).toEqual([]);
    expect(mbVibes([{ name: "jazz", count: 1 }, { name: "hip hop", count: 5 }])[0]).not.toBe("noir");
  });
  it("toda vibe das tabelas de música existe no vocabulário", () => {
    const valid = new Set<string>(VIBES);
    for (const [k, vs] of Object.entries(MB_TAGS)) for (const v of vs) expect(valid.has(v), `${k}: ${v}`).toBe(true);
  });
});
