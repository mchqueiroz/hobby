import { describe, expect, it } from "vitest";
import { USER_RE, classifyError, mapAniList, type AniListEntry, type AniListResponse } from "../anilist";
import { VIBES } from "../vibes";

function entry(over: Partial<AniListEntry> & { id: number; title?: string; genres?: string[]; tags?: [string, number][] }): AniListEntry {
  return {
    status: over.status ?? "COMPLETED",
    score: over.score ?? 0,
    media: {
      id: over.id,
      seasonYear: 2006,
      countryOfOrigin: "JP",
      title: { romaji: over.title ?? `Anime ${over.id}`, english: null },
      genres: over.genres ?? [],
      tags: (over.tags ?? []).map(([name, rank]) => ({ name, rank })),
    },
  };
}

const res = (lists: AniListEntry[][]): AniListResponse => ({
  data: { MediaListCollection: { lists: lists.map((entries) => ({ entries })) } },
});

describe("importação do AniList", () => {
  it("traduz gêneros e tags para vibes do vocabulário", () => {
    const out = mapAniList(
      res([[entry({ id: 1, title: "Death Note", genres: ["Mystery", "Psychological", "Thriller"], tags: [["Detective", 90], ["Philosophy", 40]] })]]),
    );
    const v = out.items[0].vibes;
    expect(v).toContain("investigação");
    expect(v).toContain("psicológico");
    expect(v).toContain("mistério");
    // tag com rank baixo (40) é ignorada
    expect(v).not.toContain("filosófico");
    for (const x of v) expect(VIBES as readonly string[]).toContain(x);
    expect(v.length).toBeLessThanOrEqual(6);
  });

  it("converte status e nota de 0–10 para 0,5–5, e 0 vira 'sem nota'", () => {
    const out = mapAniList(
      res([[
        entry({ id: 1, status: "COMPLETED", score: 9 }),
        entry({ id: 2, status: "COMPLETED", score: 7 }),
        entry({ id: 3, status: "CURRENT", score: 0 }),
        entry({ id: 4, status: "PLANNING" }),
        entry({ id: 5, status: "DROPPED", score: 3 }),
        entry({ id: 6, status: "PAUSED" }),
        entry({ id: 7, status: "COMPLETED", score: 1 }),
      ]]),
    );
    const by = Object.fromEntries(out.entries.map((e) => [e.itemId, e]));
    expect(by["anilist:1"]).toMatchObject({ status: "concluido", rating: 4.5 });
    expect(by["anilist:2"]).toMatchObject({ status: "concluido", rating: 3.5 });
    expect(by["anilist:3"]).toMatchObject({ status: "andamento", rating: undefined });
    expect(by["anilist:4"].status).toBe("quero");
    expect(by["anilist:5"]).toMatchObject({ status: "abandonei", rating: 1.5 });
    expect(by["anilist:6"].status).toBe("andamento");
    expect(by["anilist:7"].rating).toBe(0.5);
    expect(out.counts).toEqual({ concluido: 3, andamento: 2, quero: 1, abandonei: 1 });
  });

  it("conta uma vez só a obra que aparece em mais de uma lista", () => {
    const a = entry({ id: 10, score: 8 });
    const out = mapAniList(res([[a], [a, entry({ id: 11 })]]));
    expect(out.items.map((i) => i.id)).toEqual(["anilist:10", "anilist:11"]);
    expect(out.entries).toHaveLength(2);
  });

  it("avisa quantos itens ficaram sem nenhuma vibe", () => {
    const out = mapAniList(res([[entry({ id: 1, genres: [] }), entry({ id: 2, genres: ["Action"] })]]));
    expect(out.withoutVibes).toBe(1);
  });

  it("lida com lista vazia ou usuário sem listas", () => {
    expect(mapAniList({ data: { MediaListCollection: { lists: [] } } }).items).toEqual([]);
    expect(mapAniList({ data: { MediaListCollection: null } }).items).toEqual([]);
  });

  it("valida o nome de usuário", () => {
    for (const ok of ["ab", "Michael_Q", "user123"]) expect(USER_RE.test(ok)).toBe(true);
    for (const bad of ["", "a", "x".repeat(21), "with space", "a/b", "a;b", "é", '{"x":1}']) expect(USER_RE.test(bad)).toBe(false);
  });

  it("classifica os erros do AniList", () => {
    expect(classifyError({ errors: [{ message: "Private User", status: 403 }] }, 403)).toBe("private");
    expect(classifyError({ errors: [{ message: "User not found", status: 404 }] }, 404)).toBe("not_found");
    expect(classifyError({ errors: [{ message: "Too Many Requests.", status: 429 }] }, 429)).toBe("rate_limited");
    expect(classifyError({}, 429)).toBe("rate_limited");
    expect(classifyError({}, 500)).toBe("upstream");
    expect(classifyError(res([[]]), 200)).toBeNull();
  });
});
