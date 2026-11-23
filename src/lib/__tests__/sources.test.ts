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
