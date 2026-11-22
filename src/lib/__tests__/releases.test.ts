import { describe, expect, it } from "vitest";
import { daysUntil, dueLabel, groupUpcoming, releaseLabel, upcoming } from "../releases";
import { mapAniListDetails, mapIgdbDetails, mapTmdbDetails } from "../details";
import type { Item } from "../types";

const NOW = new Date(2026, 10, 22, 15, 0).getTime(); // 22/11/2026 15h local
const mk = (id: string, media: Item["media"] = "filme"): Item => ({ id, title: id, media, vibes: [], source: "tmdb" });

describe("lançamentos", () => {
  it("conta dias no calendário local", () => {
    expect(daysUntil("2026-11-22", NOW)).toBe(0);
    expect(daysUntil("2026-11-23", NOW)).toBe(1);
    expect(daysUntil("2026-12-22", NOW)).toBe(30);
    expect(daysUntil("2026-11-21", NOW)).toBe(-1);
    expect(daysUntil("lixo", NOW)).toBeNaN();
  });
  it("rótulos", () => {
    expect(dueLabel(0)).toBe("hoje");
    expect(dueLabel(1)).toBe("amanhã");
    expect(dueLabel(9)).toBe("em 9 dias");
    expect(releaseLabel({ date: "2026-11-23", kind: "episodio", ep: 5 }, "anime")).toBe("Episódio 5");
    expect(releaseLabel({ date: "2026-11-23", kind: "estreia" }, "jogo")).toBe("Lançamento");
    expect(releaseLabel({ date: "2026-11-23", kind: "estreia" }, "filme")).toBe("Estreia");
  });
  it("filtra passado e longe demais, e ordena por data", () => {
    const u = upcoming([
      { item: mk("b"), release: { date: "2026-12-10", kind: "estreia" } },
      { item: mk("a"), release: { date: "2026-11-23", kind: "estreia" } },
      { item: mk("velho"), release: { date: "2020-01-01", kind: "estreia" } },
      { item: mk("longe"), release: { date: "2029-01-01", kind: "estreia" } },
      { item: mk("sem") },
    ], NOW);
    expect(u.map((x) => x.item.id)).toEqual(["a", "b"]);
  });
  it("agrupa em semana, mês e mais para frente", () => {
    const g = groupUpcoming(upcoming([
      { item: mk("a"), release: { date: "2026-11-25", kind: "estreia" } },
      { item: mk("b"), release: { date: "2026-12-10", kind: "estreia" } },
      { item: mk("c"), release: { date: "2027-03-01", kind: "estreia" } },
    ], NOW));
    expect(g.map((x) => x.key)).toEqual(["semana", "mes", "depois"]);
  });
  it("as fontes entregam a data", () => {
    expect(mapTmdbDetails({ release_date: "2026-12-01" }, false).release).toEqual({ date: "2026-12-01", kind: "estreia" });
    expect(mapTmdbDetails({ next_episode_to_air: { air_date: "2026-12-02", episode_number: 4 }, first_air_date: "2020-01-01" }, true).release).toEqual({ date: "2026-12-02", kind: "episodio", ep: 4 });
    expect(mapTmdbDetails({ release_date: "x" }, false).release).toBeUndefined();
    expect(mapIgdbDetails({ first_release_date: 1796083200 }).release?.date).toBe("2026-12-01");
    expect(mapAniListDetails({ nextAiringEpisode: { airingAt: 1796083200, episode: 7 } }).release).toEqual({ date: "2026-12-01", kind: "episodio", ep: 7 });
    expect(mapAniListDetails({ startDate: { year: 2027, month: 4, day: 3 } }).release).toEqual({ date: "2027-04-03", kind: "estreia" });
    expect(mapAniListDetails({ startDate: { year: 2027 } }).release).toBeUndefined();
  });
});

import { reviewCardData } from "../reviewCard";
describe("cartão da retrospectiva", () => {
  it("escolhe as 3 mídias com mais obras, as 3 melhores e o mês por extenso", () => {
    const item = (id: string, media: Item["media"]): Item => ({ id, title: id, media, vibes: [], source: "seed" });
    const d = reviewCardData({
      year: 2026, done: 14, abandoned: 1,
      byMedia: { anime: 5, manga: 0, jogo: 4, filme: 3, livro: 2, musica: 0 },
      average: 4.2, reviews: 2,
      best: [1, 2, 3, 4].map((n) => ({ item: item(`o${n}`, "filme"), rating: 5 - n / 4 })),
      topVibes: ["a", "b", "c", "d"], busiestMonth: { month: 10, count: 6 }, first: null, last: null,
    });
    expect(d.medias.map((m) => m.media)).toEqual(["anime", "jogo", "filme"]);
    expect(d.best).toHaveLength(3);
    expect(d.vibes).toHaveLength(3);
    expect(d.busiestMonth).toBe("novembro");
  });
});

import { parseReported } from "../admin";
describe("painel de moderação", () => {
  it("aceita só linhas completas e limita o texto", () => {
    expect(parseReported(null)).toBeNull();
    expect(parseReported({ comment_id: "c", body: 5 })).toBeNull();
    const r = parseReported({ comment_id: "c", body: "x".repeat(900), author_id: "a", author_handle: null, hidden: true, reports: "3", reasons: ["spam", 4] });
    expect(r?.body).toHaveLength(500);
    expect(r?.reports).toBe(3);
    expect(r?.reasons).toEqual(["spam"]);
    expect(r?.hidden).toBe(true);
  });
});

import { rankTasteMatches } from "../social";
describe("gosto parecido", () => {
  const mine = new Map<string, number | null>([["a", 5], ["b", 4], ["c", null], ["d", 2]]);
  it("exige 2 obras em comum e pesa a concordância de nota", () => {
    const rows = [
      { user_id: "u1", item_id: "a", rating: 5 }, { user_id: "u1", item_id: "b", rating: 4.5 },
      { user_id: "u2", item_id: "a", rating: 1 }, { user_id: "u2", item_id: "b", rating: 1 }, { user_id: "u2", item_id: "c", rating: null },
      { user_id: "u3", item_id: "a", rating: 5 },
      { user_id: "u4", item_id: "zzz", rating: 5 }, { user_id: "u4", item_id: "yyy", rating: 5 },
    ];
    const r = rankTasteMatches(mine, rows);
    expect(r.map((x) => x.userId)).toEqual(["u1", "u2"]);
    expect(r[0]).toMatchObject({ shared: 2, agree: 2, score: 4 });
    expect(r[1]).toMatchObject({ shared: 3, agree: 0, score: 3 });
  });
  it("não conta a mesma obra duas vezes e respeita o limite", () => {
    const rows = [{ user_id: "u1", item_id: "a", rating: 5 }, { user_id: "u1", item_id: "a", rating: 5 }];
    expect(rankTasteMatches(mine, rows)).toEqual([]);
    const many = ["u1", "u2", "u3"].flatMap((u) => [{ user_id: u, item_id: "a", rating: 5 }, { user_id: u, item_id: "b", rating: 4 }]);
    expect(rankTasteMatches(mine, many, { limit: 2 })).toHaveLength(2);
  });
});
