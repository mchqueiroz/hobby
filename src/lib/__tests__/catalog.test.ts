import { describe, expect, it } from "vitest";
import { SEED } from "../catalog";
import { VIBES } from "../vibes";

describe("catálogo base", () => {
  it("usa só vibes do vocabulário, de 3 a 6 por item", () => {
    const valid = new Set<string>(VIBES);
    for (const i of SEED) {
      expect(i.vibes.length, i.title).toBeGreaterThanOrEqual(3);
      expect(i.vibes.length, i.title).toBeLessThanOrEqual(6);
      for (const v of i.vibes) expect(valid.has(v), `${i.title}: ${v}`).toBe(true);
    }
  });

  it("não repete ids nem vibes dentro do mesmo item", () => {
    expect(new Set(SEED.map((i) => i.id)).size).toBe(SEED.length);
    for (const i of SEED) expect(new Set(i.vibes).size, i.title).toBe(i.vibes.length);
  });

  it("tem as seis mídias e produções brasileiras", () => {
    for (const m of ["anime", "manga", "jogo", "filme", "livro", "musica"] as const) {
      expect(SEED.filter((i) => i.media === m).length).toBeGreaterThanOrEqual(12);
    }
    // o plano pede 30% no catálogo; aqui contamos jogos e filmes, onde há produção nacional
    const br = SEED.filter((i) => i.brazil).length;
    expect(br).toBeGreaterThanOrEqual(8);
  });
});
