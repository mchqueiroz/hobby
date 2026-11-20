import { describe, expect, it } from "vitest";
import { searchItems } from "../search";
import { EMPTY_LIBRARY, type Library } from "../types";

describe("busca local", () => {
  it("ignora acento e maiúsculas e põe quem começa com o termo primeiro", () => {
    const r = searchItems(EMPTY_LIBRARY, "DARK");
    expect(r.map((i) => i.title)).toEqual(["Dark", "Dark Souls", "The Dark Side of the Moon"]);
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
