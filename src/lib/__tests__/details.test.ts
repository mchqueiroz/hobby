import { describe, expect, it } from "vitest";
import { mapAniListDetails, mapIgdbDetails, mapMusicBrainzDetails, mapOpenLibraryDetails, mapTmdbDetails, stripHtml } from "../details";
import { MOODS } from "../vibes";
import { EMPTY_LIBRARY, type Entry, type Item, type Library } from "../types";
import { recommend, tonight } from "../recommend";

describe("stripHtml", () => {
  it("troca <br> por quebra de linha e remove tags e entidades", () => {
    expect(stripHtml("Um<br>dois <i>três</i> &amp; &quot;quatro&quot;")).toBe('Um\ndois três & "quatro"');
  });
});

describe("mapTmdbDetails", () => {
  const raw = {
    overview: "Um garoto encontra um caderno.",
    runtime: 122,
    vote_average: 8.46,
    vote_count: 500,
    genres: [{ name: "Drama" }, { name: "Crime" }],
    credits: {
      cast: [{ name: "A" }, { name: "B" }, { name: "A" }],
      crew: [{ name: "Diretor X", job: "Director" }, { name: "Roteirista", job: "Writer" }],
    },
    videos: { results: [
      { site: "Vimeo", type: "Trailer", key: "vimeo1" },
      { site: "YouTube", type: "Teaser", key: "teaserKey123" },
      { site: "YouTube", type: "Trailer", key: "trailerKey12", official: true },
    ] },
    "watch/providers": { results: { BR: { flatrate: [{ provider_name: "Netflix" }, { provider_name: "Max" }] }, US: { flatrate: [{ provider_name: "Hulu" }] } } },
  };
  it("filme: duração, direção, elenco sem repetir, trailer oficial e streaming do Brasil", () => {
    const d = mapTmdbDetails(raw, false);
    expect(d.facts).toEqual(["2h 02min", "Drama", "Crime"]);
    expect(d.makers).toEqual(["Diretor X"]);
    expect(d.cast).toEqual(["A", "B"]);
    expect(d.trailer).toBe("https://www.youtube.com/watch?v=trailerKey12");
    expect(d.providers).toEqual(["Netflix", "Max"]);
    expect(d.score).toEqual({ value: 8.5, source: "TMDB" });
  });
  it("série: temporadas, episódios e criadores", () => {
    const d = mapTmdbDetails({ number_of_seasons: 1, number_of_episodes: 10, created_by: [{ name: "Criador" }] }, true);
    expect(d.facts).toEqual(["1 temporada", "10 episódios"]);
    expect(d.makers).toEqual(["Criador"]);
  });
  it("sem trailer, sem provedores e pouca avaliação não inventa nada", () => {
    const d = mapTmdbDetails({ overview: "", vote_average: 9, vote_count: 3 }, false);
    expect(d.synopsis).toBeUndefined();
    expect(d.trailer).toBeUndefined();
    expect(d.providers).toEqual([]);
    expect(d.score).toBeUndefined();
  });
  it("chave de vídeo suspeita é descartada", () => {
    const d = mapTmdbDetails({ videos: { results: [{ site: "YouTube", type: "Trailer", key: "x&y=<script>" }] } }, false);
    expect(d.trailer).toBeUndefined();
  });
  it("sinopse enorme é cortada em palavra inteira", () => {
    const d = mapTmdbDetails({ overview: "palavra ".repeat(300) }, false);
    expect(d.synopsis!.length).toBeLessThan(910);
    expect(d.synopsis!.endsWith("…")).toBe(true);
  });
});

describe("mapIgdbDetails", () => {
  it("plataformas, desenvolvedora, trailer, parecidos e nota em 0 a 10", () => {
    const d = mapIgdbDetails({
      summary: "Fuja do submundo.",
      total_rating: 93.4, total_rating_count: 100,
      platforms: [{ name: "PC" }, { name: "Switch" }],
      genres: [{ name: "Indie" }],
      involved_companies: [{ developer: true, company: { name: "Supergiant" } }, { developer: false, company: { name: "Editora" } }],
      videos: [{ video_id: "abcDEF12345" }],
      similar_games: [{ name: "Dead Cells" }],
    });
    expect(d.facts).toEqual(["PC", "Switch", "Indie"]);
    expect(d.makers).toEqual(["Supergiant"]);
    expect(d.trailer).toContain("abcDEF12345");
    expect(d.score).toEqual({ value: 9.3, source: "IGDB" });
    expect(d.similar).toEqual(["Dead Cells"]);
  });
});

describe("mapAniListDetails", () => {
  it("limpa a sinopse, só aceita trailer do YouTube e converte a nota", () => {
    const d = mapAniListDetails({
      description: "Um caderno<br><br>do <i>mal</i>.",
      episodes: 37, format: "TV", averageScore: 84,
      trailer: { id: "yt123456789", site: "youtube" },
      studios: { nodes: [{ name: "Madhouse", isAnimationStudio: true }, { name: "Editora", isAnimationStudio: false }] },
      recommendations: { nodes: [{ mediaRecommendation: { title: { english: "Code Geass", romaji: "Code Geass" } } }] },
    });
    expect(d.synopsis).toBe("Um caderno\n\ndo mal.");
    expect(d.facts).toEqual(["TV", "37 episódios"]);
    expect(d.makers).toEqual(["Madhouse"]);
    expect(d.trailer).toContain("yt123456789");
    expect(d.score).toEqual({ value: 8.4, source: "AniList" });
    expect(d.similar).toEqual(["Code Geass"]);
    expect(mapAniListDetails({ trailer: { id: "abc123456", site: "dailymotion" } }).trailer).toBeUndefined();
  });
});

/* ---------------------------- o que ver hoje ---------------------------- */

const mk = (id: string, media: Item["media"], vibes: string[]): Item => ({ id, title: id, media, vibes, source: "seed" });
const entry = (itemId: string, o: Partial<Entry> = {}): Entry => ({ itemId, status: "concluido", rating: 5, at: 1, ...o });
const lib = (items: Item[], entries: Entry[]): Library => ({
  ...EMPTY_LIBRARY,
  items: Object.fromEntries(items.map((i) => [i.id, i])),
  entries: Object.fromEntries(entries.map((e) => [e.itemId, e])),
});

describe("clima na recomendação", () => {
  const seen = mk("seen", "anime", ["psicológico", "humor leve", "ação intensa"]);
  const cands = [
    mk("leve", "filme", ["humor leve"]),
    mk("tenso", "jogo", ["ação intensa"]),
    mk("misto", "filme", ["humor leve", "ação intensa"]),
  ];
  const L = lib([seen], [entry("seen")]);
  it("só entra quem tem alguma vibe do clima, e mais vibes do clima sobem", () => {
    const r = recommend(L, { pool: cands, moodVibes: MOODS.leve.vibes, count: 5, perMedia: 5 });
    expect(r.map((x) => x.item.id).sort()).toEqual(["leve", "misto"]);
    const r2 = recommend(L, { pool: cands, moodVibes: MOODS.intenso.vibes, count: 5, perMedia: 5 });
    expect(r2.map((x) => x.item.id).sort()).toEqual(["misto", "tenso"]);
  });
  it("clima sem nenhum candidato devolve vazio", () => {
    expect(recommend(L, { pool: cands, moodVibes: ["filosófico"], count: 5 })).toEqual([]);
  });
});

describe("lista de quero ver", () => {
  const seen = mk("seen", "anime", ["psicológico", "mistério"]);
  const w1 = mk("w1", "filme", ["mistério"]);
  const w2 = mk("w2", "jogo", ["humor leve"]); // sem afinidade com o gosto
  const done = mk("done", "filme", ["mistério"]);
  const L = lib([seen, w1, w2, done], [entry("seen"), entry("w1", { status: "quero", rating: undefined }), entry("w2", { status: "quero", rating: undefined }), entry("done")]);
  it("sugere só o que está em quero ver, inclusive sem afinidade, e nunca o já concluído", () => {
    const r = recommend(L, { fromWatchlist: true, count: 5, perMedia: 5 });
    expect(r.map((x) => x.item.id)).toEqual(["w1", "w2"]);
    expect(r[1].reason).toBe("Já está na sua lista de quero ver.");
  });
  it("itens dispensados não voltam", () => {
    const L2 = { ...L, dismissed: ["w1"] };
    expect(recommend(L2, { fromWatchlist: true, count: 5, perMedia: 5 }).map((x) => x.item.id)).toEqual(["w2"]);
  });
  it("lista vazia dá vazio", () => {
    expect(recommend(lib([seen], [entry("seen")]), { fromWatchlist: true }).length).toBe(0);
  });
});

describe("tonight", () => {
  const seen = mk("seen", "anime", ["psicológico"]);
  const pool = ["a", "b", "c", "d", "e", "f"].map((n, i) => mk(n, "filme", i % 2 ? ["psicológico"] : ["psicológico", "mistério"]));
  const L = lib([seen], [entry("seen")]);
  it("rng zero pega a melhor; rng quase 1 pega a de menor peso entre as 5; sempre traz 2 alternativas distintas", () => {
    const first = tonight(L, { pool, media: "filme", rng: () => 0 });
    const last = tonight(L, { pool, media: "filme", rng: () => 0.9999 });
    expect(first.pick).toBeDefined();
    expect(last.pick).toBeDefined();
    expect(first.pick!.item.id).not.toBe(last.pick!.item.id);
    expect(first.others).toHaveLength(2);
    expect(first.others.every((o) => o.item.id !== first.pick!.item.id)).toBe(true);
  });
  it("é reprodutível com o mesmo rng e nunca devolve item já visto", () => {
    const a = tonight(L, { pool, media: "filme", rng: () => 0.37 });
    const b = tonight(L, { pool, media: "filme", rng: () => 0.37 });
    expect(a.pick!.item.id).toBe(b.pick!.item.id);
    expect(a.pick!.item.id).not.toBe("seen");
  });
  it("sem candidatos, sem sorteio", () => {
    expect(tonight(L, { pool: [], media: "filme" }).pick).toBeUndefined();
  });
});

describe("mapOpenLibraryDetails", () => {
  it("aceita descrição em texto ou objeto, corta a cauda de links e filtra assuntos de catalogação", () => {
    const d = mapOpenLibraryDetails(
      { description: { value: "Um duque muda de planeta.\r\n----------\r\nFonte: [x](http://a)" }, subjects: ["Science fiction", "Accessible book", "Adventure"] },
      "Frank Herbert",
    );
    expect(d.synopsis).toBe("Um duque muda de planeta.");
    expect(d.makers).toEqual(["Frank Herbert"]);
    expect(d.facts).toEqual(["Science fiction", "Adventure"]);
    expect(mapOpenLibraryDetails({ description: "Texto simples." }).synopsis).toBe("Texto simples.");
    expect(mapOpenLibraryDetails({}).facts).toEqual([]);
  });
});

describe("mapMusicBrainzDetails", () => {
  it("fatos: tipo, ano e as três tags mais votadas; artista como autoria", () => {
    const d = mapMusicBrainzDetails({
      "primary-type": "Album", "first-release-date": "1997-05-21",
      "artist-credit": [{ name: "Radiohead" }],
      tags: [{ name: "pop", count: 1 }, { name: "alternative rock", count: 12 }, { name: "art rock", count: 4 }, { name: "electronic", count: 2 }],
    });
    expect(d.facts).toEqual(["Álbum", "1997", "alternative rock", "art rock", "electronic"]);
    expect(d.makers).toEqual(["Radiohead"]);
    expect(d.synopsis).toBeUndefined();
    expect(mapMusicBrainzDetails({}).facts).toEqual([]);
  });
});

import { safeHttps } from "../details";
import { searchLinks } from "../availability";
describe("onde está disponível", () => {
  it("safeHttps só aceita https", () => {
    expect(safeHttps("https://a.com/x")).toBe("https://a.com/x");
    expect(safeHttps("http://a.com")).toBeUndefined();
    expect(safeHttps("javascript:alert(1)")).toBeUndefined();
    expect(safeHttps("data:text/html,x")).toBeUndefined();
    expect(safeHttps("lixo")).toBeUndefined();
    expect(safeHttps(undefined)).toBeUndefined();
  });
  it("TMDB: assinatura, aluguel, compra, grátis+anúncios e página do JustWatch (só Brasil)", () => {
    const d = mapTmdbDetails({
      "watch/providers": { results: {
        BR: { link: "https://www.themoviedb.org/movie/1/watch?locale=BR", flatrate: [{ provider_name: "Max" }], rent: [{ provider_name: "Apple TV" }], buy: [{ provider_name: "Google Play" }], free: [{ provider_name: "Tubi" }], ads: [{ provider_name: "Pluto TV" }] },
        US: { flatrate: [{ provider_name: "Hulu" }] },
      } },
    }, false);
    expect(d.where).toMatchObject({ flatrate: ["Max"], rent: ["Apple TV"], buy: ["Google Play"], free: ["Tubi", "Pluto TV"], source: "JustWatch" });
    expect(d.where?.pageUrl).toContain("themoviedb.org");
    expect(JSON.stringify(d.where)).not.toContain("Hulu");
  });
  it("TMDB: sem provedores no Brasil não inventa nada", () => {
    expect(mapTmdbDetails({ "watch/providers": { results: { BR: {} } } }, false).where).toBeUndefined();
    expect(mapTmdbDetails({}, false).where).toBeUndefined();
  });
  it("AniList: só links de streaming https, sem repetir", () => {
    const d = mapAniListDetails({ externalLinks: [
      { site: "Crunchyroll", url: "https://crunchyroll.com/x", type: "STREAMING" },
      { site: "Crunchyroll", url: "https://crunchyroll.com/y", type: "STREAMING" },
      { site: "Site oficial", url: "https://oficial.jp", type: "INFO" },
      { site: "Ruim", url: "http://inseguro.com", type: "STREAMING" },
      { site: "Xss", url: "javascript:alert(1)", type: "STREAMING" },
    ] });
    expect(d.where?.links).toEqual([{ name: "Crunchyroll", url: "https://crunchyroll.com/x" }]);
    expect(mapAniListDetails({ externalLinks: [] }).where).toBeUndefined();
  });
  it("IGDB: só lojas conhecidas", () => {
    const d = mapIgdbDetails({ websites: [{ category: 13, url: "https://store.steampowered.com/app/1" }, { category: 1, url: "https://oficial.com" }, { category: 16, url: "http://epic.insegura" }, { category: 17, url: "https://gog.com/g" }] });
    expect(d.where?.links.map((l) => l.name)).toEqual(["Steam", "GOG"]);
  });
  it("links de busca existem para todas as mídias e escapam o título", () => {
    for (const m of ["anime", "filme", "manga", "livro", "jogo", "musica"] as const) expect(searchLinks(m, "A & B").length).toBeGreaterThan(0);
    expect(searchLinks("jogo", "A & B")[0].url).toContain("A%20%26%20B");
    expect(searchLinks("jogo", "   ")).toEqual([]);
  });
});
