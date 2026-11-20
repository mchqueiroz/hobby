import { describe, expect, it } from "vitest";
import { ARCHETYPE, badges, bridgeVibes, dna, favorites, memberSince, persona, weeklyStreak } from "../insights";
import { initials } from "../profile";
import { VIBES } from "../vibes";
import { EMPTY_LIBRARY, type Entry, type Item, type Library } from "../types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 12);
const it_ = (id: string, media: Item["media"], vibes: string[]): Item => ({ id, title: id.toUpperCase(), media, vibes, source: "seed" });
const lib = (items: Item[], entries: Partial<Entry>[], extra: Partial<Library> = {}): Library => ({
  ...EMPTY_LIBRARY,
  items: Object.fromEntries(items.map((i) => [i.id, i])),
  entries: Object.fromEntries(entries.map((e) => [e.itemId!, { status: "concluido", at: NOW, ...e } as Entry])),
  ...extra,
});

describe("arquétipos", () => {
  it("toda vibe do vocabulário tem um arquétipo", () => {
    for (const v of VIBES) expect(ARCHETYPE[v], v).toBeTruthy();
  });
});

describe("gosto e fio condutor", () => {
  const a = it_("a", "anime", ["sombrio", "mistério"]);
  const g = it_("g", "jogo", ["sombrio", "aventura"]);
  const f = it_("f", "filme", ["humor leve"]);
  const L = lib([a, g, f], [{ itemId: "a", rating: 5 }, { itemId: "g", rating: 4.5 }, { itemId: "f", rating: 1 }]);

  it("dna ordena por peso e separa por mídia; nota baixa não entra", () => {
    const d = dna(L);
    expect(d[0].vibe).toBe("sombrio");
    expect(d[0].by.anime).toBeGreaterThan(0);
    expect(d[0].by.jogo).toBeGreaterThan(0);
    expect(d.find((x) => x.vibe === "humor leve")).toBeUndefined();
  });
  it("o fio condutor só traz vibes fortes em 2 ou mais mídias", () => {
    const b = bridgeVibes(L);
    expect(b.map((x) => x.vibe)).toEqual(["sombrio"]);
    expect(b[0].medias).toEqual(["anime", "jogo"]);
  });
  it("persona vem da vibe principal, e é nula sem registros", () => {
    expect(persona(L)!.title).toBe(ARCHETYPE.sombrio);
    expect(persona(EMPTY_LIBRARY)).toBeNull();
  });
});

describe("favoritos e datas", () => {
  const items = ["a", "b", "c", "d", "e"].map((x) => it_(x, "filme", ["aventura"]));
  const L = lib(items, [
    { itemId: "a", rating: 4, at: NOW - 3 * DAY },
    { itemId: "b", rating: 5, at: NOW - 9 * DAY },
    { itemId: "c", rating: 5, at: NOW - 2 * DAY },
    { itemId: "d", status: "quero" },
    { itemId: "e", status: "concluido" }, // sem nota
  ]);
  it("favoritos: maiores notas, empate pelo mais recente, sem quero ver nem sem nota", () => {
    expect(favorites(L, 4).map((x) => x.item.id)).toEqual(["c", "b", "a"]);
    expect(favorites(L, 1)).toHaveLength(1);
  });
  it("membro desde o primeiro registro com data; histórico importado (at 0) é ignorado", () => {
    expect(memberSince(L)).toBe(NOW - 9 * DAY);
    expect(memberSince(lib([it_("x", "jogo", ["aventura"])], [{ itemId: "x", at: 0 }]))).toBeNull();
  });
});

describe("sequência semanal", () => {
  const mkL = (offsetsDays: number[]) =>
    lib(offsetsDays.map((_, i) => it_(`i${i}`, "jogo", ["aventura"])), offsetsDays.map((o, i) => ({ itemId: `i${i}`, at: NOW - o * DAY })));
  it("conta semanas seguidas, mantém a sequência se a semana atual ainda está vazia e quebra com uma semana em branco", () => {
    expect(weeklyStreak(EMPTY_LIBRARY, NOW)).toEqual({ current: 0, best: 0 });
    expect(weeklyStreak(mkL([0, 7, 14]), NOW)).toEqual({ current: 3, best: 3 });
    // a semana atual vazia não quebra: a sequência segue da semana passada
    expect(weeklyStreak(mkL([7, 14]), NOW)).toEqual({ current: 2, best: 2 });
    // duas semanas seguidas em branco quebram
    expect(weeklyStreak(mkL([15, 22]), NOW).current).toBe(0);
    const broken = weeklyStreak(mkL([0, 30, 37, 44]), NOW);
    expect(broken.current).toBe(1);
    expect(broken.best).toBe(3);
    expect(weeklyStreak(mkL([60]), NOW).current).toBe(0);
  });
  it("registros no futuro e 'quero ver' não contam", () => {
    const L = lib([it_("a", "jogo", ["aventura"]), it_("b", "jogo", ["aventura"])], [{ itemId: "a", at: NOW + 30 * DAY }, { itemId: "b", status: "quero", at: NOW }]);
    expect(weeklyStreak(L, NOW)).toEqual({ current: 0, best: 0 });
  });
});

describe("conquistas", () => {
  it("começam todas por conquistar, com progresso limitado ao alvo", () => {
    const b = badges(EMPTY_LIBRARY, NOW);
    expect(b.every((x) => !x.earned && x.value === 0)).toBe(true);
  });
  it("desbloqueiam pelas regras", () => {
    const items = Array.from({ length: 12 }, (_, i) => it_(`i${i}`, (["anime", "jogo", "filme"] as const)[i % 3], ["sombrio", "aventura"]));
    const L = lib(items, items.map((it, i) => ({ itemId: it.id, rating: 5, at: NOW - i * DAY, review: i < 5 ? "ótimo" : undefined })), {
      lists: { l: { id: "l", name: "x", itemIds: items.slice(0, 5).map((i) => i.id), createdAt: 1 } },
      goal: 10,
    });
    const by = Object.fromEntries(badges(L, NOW).map((x) => [x.id, x]));
    expect(by.primeiro.earned && by.dez.earned).toBe(true);
    expect(by.cinquenta.earned).toBe(false);
    expect(by.cinquenta.value).toBe(12);
    expect(by["tres-midias"].earned).toBe(true);
    expect(by.ponte.earned).toBe(false);
    expect(by.critico.earned).toBe(true);
    expect(by.meta.earned).toBe(true);
    expect(by.curador.earned).toBe(true);
  });
});

describe("iniciais", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(initials("")).toBe("H");
    expect(initials("  michael  ")).toBe("M");
    expect(initials("michael queiroz cardoso")).toBe("MC");
    expect(initials("élan vital")).toBe("ÉV");
  });
});
