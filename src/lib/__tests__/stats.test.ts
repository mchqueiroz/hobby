import { describe, expect, it } from "vitest";
import { computeStats, dateFromInput, dateToInput, dayStreak, diaryGroups, effectiveDate, heatmap } from "../stats";
import { EMPTY_LIBRARY, type Entry, type Library } from "../types";

const NOW = new Date(2026, 10, 13, 12).getTime(); // 13/11/2026
const day = (m: number, d: number) => new Date(2026, m, d, 12).getTime();
const e = (id: string, o: Partial<Entry> = {}): Entry => ({ itemId: id, status: "concluido", at: day(10, 1), ...o });
const lib = (entries: Entry[]): Library => ({ ...EMPTY_LIBRARY, entries: Object.fromEntries(entries.map((x) => [x.itemId, x])) });

describe("datas", () => {
  it("ida e volta do campo de data é exata, sem erro de fuso", () => {
    const ms = dateFromInput("2026-03-05")!;
    expect(dateToInput(ms)).toBe("2026-03-05");
    expect(new Date(ms).getDate()).toBe(5);
  });
  it("rejeita texto fora do formato", () => {
    expect(dateFromInput("05/03/2026")).toBeNull();
    expect(dateFromInput("")).toBeNull();
    expect(dateToInput(undefined)).toBe("");
  });
  it("a data escolhida vale mais que a do registro", () => {
    expect(effectiveDate({ at: 10, date: 99 })).toBe(99);
    expect(effectiveDate({ at: 10 })).toBe(10);
  });
});

describe("computeStats", () => {
  const L = lib([
    e("seed:anime:death-note", { rating: 5 }),
    e("seed:anime:monster", { rating: 4.5 }),
    e("seed:jogo:hades", { rating: 3, review: "bom" }),
    e("seed:filme:parasita", { status: "quero" }),
    e("seed:filme:bacurau", { at: 0 }), // histórico importado sem data
    e("seed:anime:haikyu", { at: 0, date: day(2, 10), status: "concluido" }),
  ]);
  const s = computeStats(L, NOW);
  it("conta por status e mídia", () => {
    expect(s.total).toBe(6);
    expect(s.byStatus).toMatchObject({ concluido: 5, quero: 1 });
    expect(s.byMedia).toEqual({ anime: 3, manga: 0, jogo: 1, filme: 2, livro: 0, musica: 0 });
  });
  it("média geral e por mídia só com itens avaliados", () => {
    expect(s.rated).toBe(3);
    expect(s.average).toBe(4.17);
    expect(s.averageByMedia).toEqual({ anime: 4.75, manga: null, jogo: 3, filme: null, livro: null, musica: null });
  });
  it("histograma por meia estrela", () => {
    expect(s.histogram[9]).toBe(1); // 5★
    expect(s.histogram[8]).toBe(1); // 4,5★
    expect(s.histogram[5]).toBe(1); // 3★
    expect(s.histogram.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("concluídos por mês só contam itens com data neste ano", () => {
    // novembro: 3 (at = 1/nov), março: 1 (data escolhida), importado sem data: fora
    expect(s.doneByMonth[10]).toBe(3);
    expect(s.doneByMonth[2]).toBe(1);
    expect(s.doneThisYear).toBe(4);
  });
  it("resenhas e vibes", () => {
    expect(s.reviews).toBe(1);
    expect(s.topVibes.length).toBeGreaterThan(0);
    expect(s.topVibes[0].weight).toBeGreaterThanOrEqual(s.topVibes[s.topVibes.length - 1].weight);
  });
  it("outro ano não entra na conta do ano atual", () => {
    const old = lib([e("seed:jogo:hades", { at: new Date(2024, 5, 1).getTime() })]);
    expect(computeStats(old, NOW).doneThisYear).toBe(0);
  });
  it("biblioteca vazia não quebra", () => {
    const z = computeStats(EMPTY_LIBRARY, NOW);
    expect(z.total).toBe(0);
    expect(z.average).toBeNull();
  });
});

describe("diaryGroups", () => {
  it("agrupa por mês, do mais novo ao mais antigo, e ignora sem data", () => {
    const g = diaryGroups(lib([
      e("seed:jogo:hades", { at: day(10, 2) }),
      e("seed:anime:death-note", { at: day(10, 20) }),
      e("seed:anime:monster", { at: day(8, 5) }),
      e("seed:filme:bacurau", { at: 0 }),
    ]));
    expect(g.map((x) => x.key)).toEqual(["2026-11", "2026-09"]);
    expect(g[0].rows.map((r) => r.item.title)).toEqual(["Death Note", "Hades"]);
    expect(g[0].label.toLowerCase()).toContain("novembro");
  });
});

describe("sequência e mapa de calor", () => {
  const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
  const now = noon(2026, 11, 22);
  const A = "seed:anime:death-note";
  const B = "seed:anime:monster";
  const C = "seed:filme:parasita";

  it("quero ver não mantém a sequência: só conta o que a pessoa de fato fez", () => {
    const l = lib([e(A, { date: noon(2026, 11, 22) }), e(B, { status: "quero", date: noon(2026, 11, 21) }), e(C, { status: "quero", date: noon(2026, 11, 20) })]);
    expect(dayStreak(l, now)).toMatchObject({ current: 1, best: 1, today: true });
  });

  it("andamento e pausei contam como atividade", () => {
    const l = lib([e(A, { status: "andamento", date: noon(2026, 11, 22) }), e(B, { status: "pausei", date: noon(2026, 11, 21) })]);
    expect(dayStreak(l, now).current).toBe(2);
  });

  it("o mapa de calor também ignora quero ver", () => {
    const l = lib([e(A, { date: noon(2026, 11, 22) }), e(B, { status: "quero", date: noon(2026, 11, 22) })]);
    const total = heatmap(l, 4, now).flat().reduce((a, d) => a + d.count, 0);
    expect(total).toBe(1);
  });
});
