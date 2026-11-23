import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { pickBest, rankByRelevance, searchItems, splitFavorites } from "../search";
import { EMPTY_LIBRARY, type Library } from "../types";

describe("busca local", () => {
  it("ignora acento e maiúsculas e põe quem começa com o termo primeiro", () => {
    const r = searchItems(EMPTY_LIBRARY, "DARK");
    expect(r.map((i) => i.title)).toEqual(["Dark", "Dark Souls"]);
    expect(searchItems(EMPTY_LIBRARY, "pássaro").length).toBe(0);
    expect(searchItems(EMPTY_LIBRARY, "auto da compadecida")[0].title).toBe("O Auto da Compadecida");
  });

  it("devolve vazio para termo vazio e respeita o limite", () => {
    expect(searchItems(EMPTY_LIBRARY, "  ")).toEqual([]);
    expect(searchItems(EMPTY_LIBRARY, "e", 3).length).toBe(3);
  });

  it("não duplica um título que existe no catálogo e na importação; vale o importado", () => {
    const lib: Library = {
      ...EMPTY_LIBRARY,
      items: { "anilist:1": { id: "anilist:1", title: "Death Note", media: "anime", vibes: ["psicológico"], source: "anilist" } },
    };
    const r = searchItems(lib, "death note");
    // o anime importado substitui o do catálogo; o mangá com o mesmo nome é outra obra e continua
    expect(r.filter((i) => i.media === "anime").map((i) => i.id)).toEqual(["anilist:1"]);
    expect(r.filter((i) => i.media === "manga")).toHaveLength(1);
  });
});

describe("splitFavorites", () => {
  it("separa por vírgula, ponto e vírgula, quebra de linha e ' e ' antes de maiúscula", () => {
    expect(splitFavorites("Dark, Persona 5; Kafka à beira-mar e Radiohead\nBerserk")).toEqual(["Dark", "Persona 5", "Kafka à beira-mar", "Radiohead", "Berserk"]);
  });
  it("mantém ' e ' no meio de um título em minúscula, tira repetidos e respeita o máximo", () => {
    expect(splitFavorites("Orgulho e preconceito, dark, Dark, x, Duna, Naruto", 3)).toEqual(["Orgulho e preconceito", "dark", "Duna"]);
  });
});

describe("pickBest", () => {
  const it_ = (title: string, vibes: string[] = ["drama humano"]) => ({ id: title, title, media: "filme", vibes }) as unknown as Item;
  it("prefere título igual, depois começo igual com vibes, depois o primeiro com vibes", () => {
    expect(pickBest("dark", [it_("Dark Souls"), it_("Dark")])?.title).toBe("Dark");
    expect(pickBest("persona", [it_("A Persona", []), it_("Persona 5"), it_("Persona 4")])?.title).toBe("Persona 5");
    expect(pickBest("xyz", [it_("Sem vibes", []), it_("Com vibes")])?.title).toBe("Com vibes");
    expect(pickBest("xyz", [])).toBeNull();
  });
});

describe("rankByRelevance", () => {
  const m = (title: string, media: string) => ({ id: `${media}:${title}`, title, media, vibes: [] }) as unknown as Item;
  it("título igual primeiro e mídias alternadas dentro de cada faixa", () => {
    const r = rankByRelevance("harry potter", [
      m("Harry Potter e a Pedra Filosofal", "livro"), m("Harry Potter e a Câmara Secreta", "livro"), m("Harry Potter e o Prisioneiro", "livro"),
      m("Harry Potter e a Pedra Filosofal", "filme"), m("Harry Potter e a Câmara Secreta", "filme"), m("Harry Potter", "jogo"),
    ]);
    expect(r.map((i) => i.media)).toEqual(["jogo", "livro", "filme", "livro", "filme", "livro"]);
  });
});
