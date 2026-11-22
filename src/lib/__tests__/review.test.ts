import { describe, expect, it } from "vitest";
import { reviewYears, yearInReview } from "../review";
import { EMPTY_LIBRARY, type Entry, type Item, type Library } from "../types";

const day = (y: number, m: number, d = 10) => new Date(y, m - 1, d, 12).getTime();
const item = (id: string, media: Item["media"], vibes: string[]): Item => ({ id, title: id.toUpperCase(), media, vibes, source: "tmdb" });
const ent = (id: string, status: Entry["status"], date: number, rating?: number, review?: string): Entry => ({ itemId: id, status, date, at: date, rating, review });
function lib(items: Item[], entries: Entry[]): Library {
  return { ...EMPTY_LIBRARY, items: Object.fromEntries(items.map((i) => [i.id, i])), entries: Object.fromEntries(entries.map((e) => [e.itemId, e])) };
}

const L = lib(
  [item("a", "jogo", ["x", "y"]), item("b", "filme", ["x", "z"]), item("c", "livro", ["x"]), item("d", "anime", ["w"]), item("e", "jogo", ["y"]), item("f", "filme", ["q"])],
  [ent("a", "concluido", day(2026, 3), 5, "ótimo"), ent("b", "concluido", day(2026, 3, 20), 4), ent("c", "concluido", day(2026, 7), 4.5),
   ent("d", "abandonei", day(2026, 8)), ent("e", "concluido", day(2025, 12)), ent("f", "quero", day(2026, 9))],
);

describe("yearInReview", () => {
  const r = yearInReview(L, 2026);
  it("conta só concluídos do ano, separa abandonados e ignora 'quero ver'", () => {
    expect(r.done).toBe(3);
    expect(r.abandoned).toBe(1);
    expect(r.byMedia).toMatchObject({ jogo: 1, filme: 1, livro: 1, anime: 0 });
  });
  it("média, resenhas e melhores notas em ordem", () => {
    expect(r.average).toBe(4.5);
    expect(r.reviews).toBe(1);
    expect(r.best.map((b) => b.item.id)).toEqual(["a", "c", "b"]);
  });
  it("vibes mais frequentes, mês mais movimentado, primeiro e último", () => {
    expect(r.topVibes[0]).toBe("x");
    expect(r.busiestMonth).toEqual({ month: 2, count: 2 });
    expect(r.first?.item.id).toBe("a");
    expect(r.last?.item.id).toBe("c");
  });
  it("ano sem nada devolve zeros e nulos, sem quebrar", () => {
    const e = yearInReview(L, 2020);
    expect(e).toMatchObject({ done: 0, average: null, busiestMonth: null, first: null, last: null, best: [], topVibes: [] });
  });
  it("registro sem data não entra em nenhum ano", () => {
    const sem = lib([item("z", "jogo", ["x"])], [{ itemId: "z", status: "concluido", at: 0 }]);
    expect(reviewYears(sem)).toEqual([]);
    expect(yearInReview(sem, 2026).done).toBe(0);
  });
});

describe("reviewYears", () => {
  it("lista os anos com registro, do mais novo ao mais antigo", () => {
    expect(reviewYears(L)).toEqual([2026, 2025]);
  });
});

import { dayStreak } from "../stats";
describe("dayStreak", () => {
  const mk = (...days: number[]) => lib(days.map((_, i) => item(`i${i}`, "jogo", ["x"])), days.map((d, i) => ent(`i${i}`, "concluido", d)));
  const now = day(2026, 11, 20);
  it("conta dias seguidos até hoje", () => {
    expect(dayStreak(mk(day(2026, 11, 18), day(2026, 11, 19), day(2026, 11, 20)), now)).toEqual({ current: 3, best: 3, today: true });
  });
  it("hoje sem registro não quebra a sequência de ontem", () => {
    expect(dayStreak(mk(day(2026, 11, 18), day(2026, 11, 19)), now)).toEqual({ current: 2, best: 2, today: false });
  });
  it("um dia de buraco zera a atual mas guarda a melhor", () => {
    expect(dayStreak(mk(day(2026, 11, 10), day(2026, 11, 11), day(2026, 11, 12), day(2026, 11, 18)), now)).toEqual({ current: 0, best: 3, today: false });
  });
  it("vários registros no mesmo dia contam um dia só, e vazio dá zero", () => {
    expect(dayStreak(mk(day(2026, 11, 20), day(2026, 11, 20)), now).current).toBe(1);
    expect(dayStreak(mk(), now)).toEqual({ current: 0, best: 0, today: false });
  });
  it("atravessa a virada de mês e de ano", () => {
    expect(dayStreak(mk(day(2026, 12, 31), day(2027, 1, 1), day(2027, 1, 2)), day(2027, 1, 2)).current).toBe(3);
  });
});

import { achievements } from "../achievements";
describe("conquistas", () => {
  const mk = (n: number, extra: Record<string, unknown> = {}) => {
    const entries: Record<string, never> = {};
    for (let i = 0; i < n; i++) entries[`x${i}`] = { itemId: `x${i}`, status: "concluido", at: Date.now(), ...extra } as never;
    return { entries, items: {}, goal: 12 } as never;
  };
  const media = (id: string) => (["anime", "filme", "jogo", "livro"] as const)[Number(id.slice(1)) % 4];
  const get = (l: never, id: string) => achievements(l, media).find((a) => a.id === id)!;
  it("vazio não tem nada concluído", () => {
    const a = achievements({ entries: {}, items: {}, goal: 12 } as never, media);
    expect(a.every((x) => !x.done)).toBe(true);
  });
  it("conta conclusões e limita o progresso na meta", () => {
    expect(get(mk(1), "primeiro").done).toBe(true);
    expect(get(mk(9), "dez")).toMatchObject({ done: false, value: 9 });
    expect(get(mk(60), "cinquenta")).toMatchObject({ done: true, value: 50 });
  });
  it("variedade exige 4 mídias", () => {
    expect(get(mk(3), "variado").done).toBe(false);
    expect(get(mk(4), "variado").done).toBe(true);
  });
  it("resenhas, notas e releituras", () => {
    expect(get(mk(5, { review: "ótimo" }), "critico").done).toBe(true);
    expect(get(mk(5, { review: "   " }), "critico").done).toBe(false);
    expect(get(mk(10, { rating: 4 }), "avaliador").done).toBe(true);
    expect(get(mk(3, { rounds: 2 }), "rever").done).toBe(true);
  });
  it("meta do ano usa a meta da biblioteca", () => {
    expect(get(mk(12), "meta").done).toBe(true);
    expect(get(mk(11), "meta").done).toBe(false);
  });
});

import { countNewer } from "../novidades";
describe("novidades", () => {
  it("conta só o que é mais novo que a última visita e ignora datas inválidas", () => {
    const t = (ms: number) => new Date(ms).toISOString();
    expect(countNewer([t(1000), t(2000), t(3000)], 1500)).toBe(2);
    expect(countNewer([t(1000)], 1000)).toBe(0);
    expect(countNewer(["", "lixo"], 0)).toBe(0);
    expect(countNewer([], 5)).toBe(0);
  });
});

import { jointVibes } from "../recommend";
describe("ver algo juntos", () => {
  it("usa as vibes em comum quando há bastante", () => {
    expect(jointVibes(["a", "b", "c"], ["c", "b", "z"])).toEqual({ vibes: ["b", "c"], shared: ["b", "c"] });
  });
  it("completa com as melhores de cada um quando há pouco em comum", () => {
    expect(jointVibes(["a", "b", "c"], ["x", "y", "a"])).toEqual({ vibes: ["a", "b", "x", "y"], shared: ["a"] });
    expect(jointVibes(["a", "b"], ["x", "y"]).shared).toEqual([]);
  });
  it("sem dados de um lado ainda funciona", () => {
    expect(jointVibes([], ["x"]).vibes).toEqual(["x"]);
    expect(jointVibes([], []).vibes).toEqual([]);
  });
});

import { heatmap } from "../stats";
describe("heatmap", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();
  const lib = (...ts: number[]) => ({ items: {}, goal: 12, entries: Object.fromEntries(ts.map((t, i) => [`seed:anime:cowboy-bebop${i}`, { itemId: "seed:anime:cowboy-bebop", status: "concluido", at: t }])) }) as never;
  it("tem colunas de 7 dias e termina na semana atual", () => {
    const h = heatmap(lib(), 10, at(2026, 10, 25)); // quarta
    expect(h).toHaveLength(10);
    expect(h.every((c) => c.length === 7)).toBe(true);
    expect(h[9].filter((d) => d.future)).toHaveLength(3); // qui, sex, sáb
  });
  it("conta registros no dia certo", () => {
    const now = at(2026, 10, 25);
    const lb = { items: {}, goal: 12, entries: { a: { itemId: "seed:anime:cowboy-bebop", status: "concluido", at: now }, b: { itemId: "seed:anime:death-note", status: "concluido", at: now } } } as never;
    const flat = heatmap(lb, 4, now).flat();
    expect(flat.filter((d) => d.count === 2)).toHaveLength(1);
    expect(flat.reduce((a, d) => a + d.count, 0)).toBe(2);
  });
});

import { applyFilters, facets, DEFAULT_FILTERS, allRows } from "../libraryFilter";
describe("filtro por etiquetas", () => {
  const lib = { items: {}, goal: 12, entries: {
    a: { itemId: "seed:anime:cowboy-bebop", status: "concluido", at: 3, tags: ["noir", "classico"] },
    b: { itemId: "seed:anime:death-note", status: "concluido", at: 2, tags: ["noir"] },
    c: { itemId: "seed:jogo:hades", status: "concluido", at: 1 },
  } } as never;
  it("exige todas as etiquetas marcadas", () => {
    const rows = allRows(lib);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, tags: ["noir"] })).toHaveLength(2);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, tags: ["noir", "classico"] })).toHaveLength(1);
  });
  it("conta etiquetas e não perde a marcada", () => {
    const f = facets(allRows(lib), { ...DEFAULT_FILTERS, tags: ["noir"] });
    expect(f.tags[0]).toEqual({ tag: "noir", count: 2 });
    expect(f.tags.find((t) => t.tag === "classico")?.count).toBe(1);
    expect(facets(allRows(lib), { ...DEFAULT_FILTERS, tags: ["fantasma"] }).tags.some((t) => t.tag === "fantasma" && t.count === 0)).toBe(true);
  });
});

import { parseSpoilers } from "../spoiler";
describe("spoilers", () => {
  it("separa trechos", () => {
    expect(parseSpoilers("bom ||o vilão morre|| mesmo")).toEqual([{ text: "bom ", spoiler: false }, { text: "o vilão morre", spoiler: true }, { text: " mesmo", spoiler: false }]);
  });
  it("marca sem fechar, vazia ou sem marca fica texto", () => {
    expect(parseSpoilers("a || b")).toEqual([{ text: "a || b", spoiler: false }]);
    expect(parseSpoilers("a |||| b").every((p) => !p.spoiler)).toBe(true);
    expect(parseSpoilers("simples")).toEqual([{ text: "simples", spoiler: false }]);
    expect(parseSpoilers("")).toEqual([{ text: "", spoiler: false }]);
  });
  it("vários e colados", () => {
    expect(parseSpoilers("||a||||b||").filter((p) => p.spoiler).map((p) => p.text)).toEqual(["a", "b"]);
  });
});

import { cell, toCsv } from "../csv";
describe("csv", () => {
  it("escapa aspas, vírgulas e quebras", () => {
    expect(cell('diz "oi", ok')).toBe('"diz ""oi"", ok"');
    expect(cell("a\nb")).toBe('"a\nb"');
    expect(cell(undefined)).toBe("");
    expect(cell(4.5)).toBe("4.5");
  });
  it("neutraliza fórmulas de planilha", () => {
    expect(cell("=1+1")).toBe("'=1+1");
    expect(cell("@soma")).toBe("'@soma");
    expect(cell("-5")).toBe("'-5");
  });
  it("gera cabeçalho e uma linha por registro", () => {
    const lib = { items: {}, goal: 12, entries: { a: { itemId: "seed:anime:cowboy-bebop", status: "concluido", rating: 5, at: 1_700_000_000_000, tags: ["noir", "clássico"], review: "=HYPERLINK(\"x\")" } } } as never;
    const out = toCsv(lib);
    const lines = out.replace("﻿", "").trim().split("\r\n");
    expect(lines[0].startsWith("titulo,midia,ano")).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Cowboy Bebop");
    expect(lines[1]).toContain("noir | clássico");
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(out.startsWith("﻿")).toBe(true);
  });
});
