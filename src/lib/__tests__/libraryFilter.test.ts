import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS, eraOf, eraLabel, facets, isFiltered, allRows, type Filters } from "../libraryFilter";
import { EMPTY_LIBRARY, type Item, type Library } from "../types";

const it_ = (id: string, media: Item["media"], year: number | undefined, vibes: string[], title = id, author?: string): Item => ({ id, title, media, year, vibes, source: "tmdb", ...(author ? { author } : {}) });
const items = [
  it_("a", "anime", 1998, ["sombrio", "ação"], "Cowboy Bebop"),
  it_("b", "anime", 2006, ["sombrio", "psicológico"], "Death Note"),
  it_("c", "jogo", 2017, ["aventura"], "Hollow Knight"),
  it_("d", "filme", 1962, ["drama"], "Lawrence"),
  it_("e", "livro", undefined, ["drama"], "Dom Casmurro", "Machado de Assis"),
  it_("f", "jogo", 2020, ["sombrio"], "Hades"),
];
const lib: Library = {
  ...EMPTY_LIBRARY,
  items: Object.fromEntries(items.map((i) => [i.id, i])),
  entries: Object.fromEntries(items.map((i, n) => [i.id, { itemId: i.id, status: i.id === "f" ? "quero" : "concluido", rating: n % 5 + 1, at: 1000 + n }])),
};
const rows = allRows(lib);
// a maioria dos casos mira os concluídos; o padrão do app ("todos") tem teste próprio
const F = (p: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, status: "concluido", ...p });
const ids = (f: Filters) => applyFilters(rows, f).map((r) => r.item.id);

describe("épocas", () => {
  it("agrupa em décadas, antes de 1970 e sem ano", () => {
    expect(eraOf(1998)).toBe("1990");
    expect(eraOf(2000)).toBe("2000");
    expect(eraOf(1969)).toBe("pre1970");
    expect(eraOf(undefined)).toBe("semano");
    expect(eraOf(0)).toBe("semano");
    expect(eraLabel("1990")).toBe("1990s");
    expect(eraLabel("pre1970")).toBe("Antes de 1970");
  });
});

describe("filtros da biblioteca", () => {
  it("por padrão mostra todos os status, para o que acabou de ser salvo aparecer", () => {
    expect(ids(DEFAULT_FILTERS).sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
  it("só mostra o status escolhido", () => {
    expect(ids(F({ status: "concluido" })).sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(F({ status: "quero" }))).toEqual(["f"]);
  });
  it("categoria, época e estilo se combinam (todos os estilos marcados)", () => {
    expect(ids(F({ media: "anime" })).sort()).toEqual(["a", "b"]);
    expect(ids(F({ era: "2000" }))).toEqual(["b"]);
    expect(ids(F({ vibes: ["sombrio"] })).sort()).toEqual(["a", "b"]);
    expect(ids(F({ vibes: ["sombrio", "psicológico"] }))).toEqual(["b"]);
    expect(ids(F({ media: "anime", era: "1990", vibes: ["sombrio"] }))).toEqual(["a"]);
    expect(ids(F({ media: "jogo", era: "1990" }))).toEqual([]);
    expect(ids(F({ era: "semano" }))).toEqual(["e"]);
  });
  it("busca ignora acento e maiúscula e acha pelo autor", () => {
    expect(ids(F({ q: "COWBOY" }))).toEqual(["a"]);
    expect(ids(F({ q: "assis" }))).toEqual(["e"]);
    expect(ids(F({ q: "psicologico" }))).toEqual([]); // busca é no título/autor, não no estilo
  });
  it("ordenações", () => {
    expect(ids(F({ sort: "titulo" }))).toEqual(["a", "b", "c", "d", "e"].sort((x, y) => items.find((i) => i.id === x)!.title.localeCompare(items.find((i) => i.id === y)!.title)));
    expect(ids(F({ sort: "ano" }))[0]).toBe("c");
    expect(ids(F({ sort: "recentes" }))[0]).toBe("e");
    expect(ids(F({ sort: "nota" }))[0]).toBe("e");
  });
  it("isFiltered ignora status e ordem", () => {
    expect(isFiltered(F())).toBe(false);
    expect(isFiltered(F({ status: "quero", sort: "nota" }))).toBe(false);
    expect(isFiltered(F({ era: "1990" }))).toBe(true);
    expect(isFiltered(F({ q: "  " }))).toBe(false);
  });
});

describe("contagens das facetas", () => {
  it("cada faceta conta com os outros filtros, não com o dela", () => {
    const f = facets(rows, F({ media: "anime" }));
    expect(f.media.anime).toBe(2);
    expect(f.media.jogo).toBe(1); // o jogo concluído; "Hades" está em "quero"
    expect(f.media.tudo).toBe(5);
    expect(f.status.concluido).toBe(2);
    expect(f.status.quero).toBe(0);
  });
  it("épocas e estilos refletem o recorte atual e ordenam como esperado", () => {
    const f = facets(rows, F({ media: "anime" }));
    expect(f.eras.map((e) => e.key)).toEqual(["2000", "1990"]);
    expect(f.vibes[0]).toEqual({ vibe: "sombrio", count: 2 });
    expect(f.vibes.map((v) => v.vibe)).toContain("psicológico");
    const all = facets(rows, F());
    expect(all.eras.map((e) => e.key)).toEqual(["2010", "2000", "1990", "pre1970", "semano"]);
  });
  it("marcar um estilo mostra o que ainda combina com ele", () => {
    const f = facets(rows, F({ vibes: ["sombrio"] }));
    expect(f.vibes.find((v) => v.vibe === "psicológico")!.count).toBe(1);
    expect(f.vibes.find((v) => v.vibe === "aventura")).toBeUndefined();
  });
  it("opção marcada nunca some, mesmo sem resultado", () => {
    const f = facets(rows, F({ era: "2020", vibes: ["drama"] }));
    expect(f.eras.find((e) => e.key === "2020")!.count).toBe(0);
    expect(f.vibes.find((v) => v.vibe === "drama")).toBeDefined();
  });
  it("biblioteca vazia não quebra", () => {
    const f = facets([], F());
    expect(f.eras).toEqual([]);
    expect(f.vibes).toEqual([]);
    expect(f.media.tudo).toBe(0);
  });
});
