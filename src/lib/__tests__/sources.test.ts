import { describe, expect, it } from "vitest";
import { cacheFor, mapSteam, steamCover } from "../sources";
import { mapSteamDetails } from "../details";
import type { RemoteResult } from "../remote";

const res = (musicbrainz: "ok" | "error"): RemoteResult => ({
  items: [],
  sources: { tmdb: "ok", igdb: "off", steam: "ok", anilist: "ok", openlibrary: "ok", musicbrainz },
});

describe("cacheFor", () => {
  it("guarda pouco tempo quando alguma fonte falhou", () => {
    expect(cacheFor(res("error"), 600, 3600)).toBe("public, max-age=0, s-maxage=30");
  });
  it("usa o cache longo quando tudo respondeu", () => {
    expect(cacheFor(res("ok"), 600, 3600)).toBe("public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  });
});


describe("Steam", () => {
  it("mapeia jogo com gêneros em vibes, ano, nota e capa vertical", () => {
    const it = mapSteam(367520, { type: "game", name: "Hollow Knight", genres: [{ description: "Ação" }, { description: "Aventura" }, { description: "Indie" }], release_date: { date: "24 fev. 2017" }, metacritic: { score: 87 } }, ["sombrio"]);
    expect(it).toEqual({ id: "steam:367520", title: "Hollow Knight", media: "jogo", year: 2017, vibes: ["sombrio", "ação intensa", "aventura"], source: "steam", cover: steamCover(367520), quality: 8.7 });
  });
  it("ignora DLC e trilha sonora", () => {
    expect(mapSteam(1, { type: "dlc", name: "Expansão" })).toBeNull();
    expect(mapSteam(2, { type: "music", name: "Trilha" })).toBeNull();
  });
  it("detalhes trazem loja, nota e fatos", () => {
    const d = mapSteamDetails(10, { short_description: "<b>Ótimo</b> jogo", developers: ["Estúdio"], metacritic: { score: 90 }, is_free: true, platforms: { windows: true, linux: true } });
    expect(d.synopsis).toBe("Ótimo jogo");
    expect(d.score).toEqual({ value: 9, source: "Metacritic" });
    expect(d.where?.free).toEqual(["Steam"]);
    expect(d.where?.links[0].url).toBe("https://store.steampowered.com/app/10");
    expect(d.facts).toContain("Windows, Linux");
  });
});

describe("vibes enriquecidas", () => {
  it("tags da comunidade da Steam vêm antes dos gêneros da loja", async () => {
    const { mapSteam: m } = await import("../sources");
    const it = m(1, { type: "game", name: "X", genres: [{ description: "Ação" }] }, [], ["Metroidvania", "Souls-like", "Tag que não existe"]);
    expect(it?.vibes).toEqual(["exploração", "aventura", "sombrio", "ação intensa"]);
  });
  it("Deezer: só álbum, vibes pelo gênero, capa grande", async () => {
    const { mapDeezer } = await import("../sources");
    expect(mapDeezer({ id: 7, title: "Clube da Esquina", record_type: "album", genre_id: 78, release_date: "1972-03-01", cover_xl: "https://cdn-images.dzcdn.net/a.jpg", artist: { name: "Milton Nascimento" } }))
      .toEqual({ id: "deezer:7", title: "Clube da Esquina", media: "musica", year: 1972, vibes: ["introspectivo", "melancólico"], source: "deezer", cover: "https://cdn-images.dzcdn.net/a.jpg", author: "Milton Nascimento" });
    expect(mapDeezer({ id: 8, title: "Hit", record_type: "single" })).toBeNull();
    expect(mapDeezer({ id: 9, title: "Ao Vivo no Rock in Rio", record_type: "album" })).toBeNull();
  });
  it("assunto do Open Library casa no começo da palavra", async () => {
    const { olVibes } = await import("../vibes");
    expect(olVibes(["Hogwarts School", "Award winner"])).not.toContain("guerra");
    expect(olVibes(["World War, 1939-1945"])).toEqual(["guerra"]);
    expect(olVibes(["Novela fantástica", "Magia"])).toEqual(["fantasia"]);
  });
});
