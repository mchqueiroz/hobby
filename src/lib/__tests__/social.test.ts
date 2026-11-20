import { describe, expect, it } from "vitest";
import { SEED_BY_ID } from "../catalog";
import { affinity, buildStats, desiredActivity, diffActivity, handleError, MAX_ACTIVITY, normalizeHandle, parseActivity, parseStats, type ActivityRow } from "../social";
import { EMPTY_LIBRARY, type Library } from "../types";

const lib = (entries: Library["entries"], extra: Partial<Library> = {}): Library => ({ ...EMPTY_LIBRARY, entries, ...extra });
const E = (id: string, rating: number | undefined, at = 1000, extra = {}) => ({ itemId: id, status: "concluido" as const, rating, at, ...extra });

describe("nome de usuário", () => {
  it("normaliza e valida", () => {
    expect(normalizeHandle("  @Ana_Silva ")).toBe("ana_silva");
    expect(handleError("ana_silva")).toBeNull();
    for (const bad of ["ab", "a".repeat(21), "ana silva", "ânâ", "ana-x", ""]) expect(handleError(bad)).not.toBeNull();
    for (const r of ["admin", "perfil", "u", "Comunidade"]) expect(handleError(r.length < 3 ? "u" : r)).not.toBeNull();
  });
});

describe("resumo público", () => {
  it("só tem contagens e vibes, nunca títulos ou notas", () => {
    const l = lib({ "seed:jogo:hades": E("seed:jogo:hades", 5, 1, { review: "segredo" }), "seed:anime:death-note": E("seed:anime:death-note", 4) });
    const s = buildStats(l);
    expect(s.total).toBe(2);
    expect(s.perMedia.jogo).toBe(1);
    expect(s.topVibes.length).toBeGreaterThan(0);
    const txt = JSON.stringify(s);
    expect(txt).not.toMatch(/segredo|Hades|Death/);
    expect(txt.length).toBeLessThan(2000);
  });
  it("parseStats descarta lixo", () => {
    const s = parseStats({ total: "x", perMedia: { anime: -3, jogo: 2.9, foo: 1 }, topVibes: ["a", 3, "b"], persona: 5 });
    expect(s.perMedia.anime).toBe(0);
    expect(s.perMedia.jogo).toBe(2);
    expect(s.topVibes).toEqual(["a", "b"]);
    expect(s.persona).toBeUndefined();
    expect(parseStats(null).total).toBe(0);
  });
});

describe("atividade publicada", () => {
  it("resenha só vai se liberada; nota inválida vira nula", () => {
    const l = lib({ "seed:jogo:hades": E("seed:jogo:hades", 5, 1, { review: "ótimo" }), "seed:anime:death-note": E("seed:anime:death-note", undefined) });
    const sem = desiredActivity(l, false);
    expect(sem.every((r) => r.review === null)).toBe(true);
    expect(sem.find((r) => r.item_id === "seed:anime:death-note")!.rating).toBeNull();
    expect(desiredActivity(l, true).find((r) => r.item_id === "seed:jogo:hades")!.review).toBe("ótimo");
  });
  it("limita a 200, com os mais recentes primeiro", () => {
    const items: Library["items"] = {};
    const entries: Library["entries"] = {};
    for (let i = 0; i < 260; i++) {
      const id = `tmdb:movie:${i}`;
      items[id] = { id, title: `Filme ${i}`, media: "filme", vibes: ["aventura"], source: "tmdb" };
      entries[id] = E(id, 4, 1000 + i);
    }
    const d = desiredActivity(lib(entries, { items }), false);
    expect(d).toHaveLength(MAX_ACTIVITY);
    expect(d[0].item_id).toBe("tmdb:movie:259");
  });
  it("capa só https e curta; título longo é cortado", () => {
    const id = "tmdb:movie:1";
    const l = lib({ [id]: E(id, 3) }, { items: { [id]: { id, title: "T".repeat(500), media: "filme", vibes: ["aventura"], source: "tmdb", cover: "http://x/y.jpg" } } });
    const r = desiredActivity(l, false)[0];
    expect(r.item.title).toHaveLength(120);
    expect(r.item.cover).toBeUndefined();
    expect(JSON.stringify(r.item).length).toBeLessThan(2000);
  });
  it("diff manda só o que mudou e remove o que saiu", () => {
    const l = lib({ "seed:jogo:hades": E("seed:jogo:hades", 5), "seed:anime:death-note": E("seed:anime:death-note", 4) });
    const want = desiredActivity(l, false);
    expect(diffActivity(want, []).upsert).toHaveLength(2);
    const have = want.map((w) => ({ ...w, rating: w.rating === null ? null : (String(w.rating) as unknown as number) })); // numeric vem como string do banco
    expect(diffActivity(want, have)).toEqual({ upsert: [], remove: [] });
    const changed = have.map((h) => (h.item_id === "seed:jogo:hades" ? { ...h, rating: 3 } : h));
    expect(diffActivity(want, changed).upsert.map((u) => u.item_id)).toEqual(["seed:jogo:hades"]);
    const extra = [...have, { ...have[0], item_id: "velho" }];
    expect(diffActivity(want, extra).remove).toEqual(["velho"]);
  });
  it("parseActivity rejeita linha torta", () => {
    expect(parseActivity(null)).toBeNull();
    expect(parseActivity({ item_id: "x", item: { title: "a", media: "xx" }, status: "concluido" })).toBeNull();
    expect(parseActivity({ item_id: "x", item: { title: "a", media: "filme", cover: "javascript:1" }, status: "concluido", rating: "4.5" })).toMatchObject({ rating: 4.5, item: { title: "a" } });
    expect(parseActivity({ item_id: "x", item: { title: "a", media: "filme", cover: "javascript:1" }, status: "concluido" })!.item.cover).toBeUndefined();
  });
});

describe("afinidade", () => {
  const row = (id: string, rating: number | null): ActivityRow => ({ item_id: id, item: { id, title: id, media: "jogo" }, status: "concluido", rating, review: null });
  const mine = lib({ a: E("a", 5), b: E("b", 4), c: E("c", 1), d: E("d", 3), e: E("e", 5), f: E("f", 2) });
  it("notas iguais nas mesmas obras = 100", () => {
    const r = affinity(mine, ["a", "b", "c", "d", "e", "f"].map((id) => row(id, mine.entries[id].rating!)), []);
    expect(r.score).toBe(100);
    expect(r.shared).toBe(6);
    expect(r.basis).toBe("notas");
    expect(r.lovedBoth).toEqual(["a", "b", "e"]);
  });
  it("notas opostas dão afinidade baixa", () => {
    const r = affinity(mine, [row("a", 0.5), row("c", 5), row("e", 0.5), row("b", 1), row("f", 5), row("d", 5)], []);
    expect(r.score!).toBeLessThan(25);
  });
  it("poucas obras em comum pesam pouco: 1 obra igual não dá 100", () => {
    expect(affinity(mine, [row("a", 5)], []).score!).toBeLessThan(25);
  });
  it("sem nada em comum e sem vibes não inventa número", () => {
    expect(affinity(EMPTY_LIBRARY, [row("zz", 4)], []).score).toBeNull();
    expect(affinity(EMPTY_LIBRARY, [], []).basis).toBe("nenhuma");
  });
  it("só vibes: sobreposição das vibes fortes", () => {
    const hades = SEED_BY_ID["seed:jogo:hades"];
    const l = lib({ [hades.id]: E(hades.id, 5) });
    const mineV = affinity(l, [], []).commonVibes; // vazio sem vibes da outra pessoa
    expect(mineV).toEqual([]);
    const same = affinity(l, [], hades.vibes);
    expect(same.basis).toBe("vibes");
    expect(same.score!).toBeGreaterThan(50);
    expect(affinity(l, [], ["nada-a-ver"]).score).toBe(0);
  });
  it("mistura os dois e fica entre 0 e 100", () => {
    const hades = SEED_BY_ID["seed:jogo:hades"], dn = SEED_BY_ID["seed:anime:death-note"];
    const l = lib({ [hades.id]: E(hades.id, 5), [dn.id]: E(dn.id, 4) });
    const r = affinity(l, [row(hades.id, 5), row(dn.id, 3)], hades.vibes);
    expect(r.basis).toBe("ambos");
    expect(r.score!).toBeGreaterThanOrEqual(0);
    expect(r.score!).toBeLessThanOrEqual(100);
    expect(r.commonVibes.length).toBeGreaterThan(0);
  });
  it("é simétrica nas notas", () => {
    const a = lib({ x: E("x", 5), y: E("y", 2) });
    const b = lib({ x: E("x", 4), y: E("y", 3) });
    const asRows = (l: Library) => Object.values(l.entries).map((e) => row(e.itemId, e.rating!));
    expect(affinity(a, asRows(b), []).score).toBe(affinity(b, asRows(a), []).score);
  });
});

import { checkComment, COMMENT_MAX, countByThread, parseComment, threadKey } from "../social";
describe("comentários", () => {
  it("recusa vazio e texto grande, apara espaços e normaliza quebras de linha", () => {
    expect(checkComment("   \n ")).toMatchObject({ ok: false });
    expect(checkComment("a".repeat(COMMENT_MAX + 1))).toMatchObject({ ok: false });
    expect(checkComment("a".repeat(COMMENT_MAX))).toMatchObject({ ok: true });
    expect(checkComment("  oi\r\ntudo bem  ")).toEqual({ ok: true, body: "oi\ntudo bem" });
  });
  it("parseComment descarta linha torta e corta o texto", () => {
    expect(parseComment(null)).toBeNull();
    expect(parseComment({ id: 1 })).toBeNull();
    const c = parseComment({ id: "1", author_id: "a", target_user: "b", target_item: "x", body: "z".repeat(900), created_at: "2026-01-01" });
    expect(c!.body).toHaveLength(COMMENT_MAX);
  });
  it("conta comentários por atividade", () => {
    const m = countByThread([
      { target_user: "u1", target_item: "i1" }, { target_user: "u1", target_item: "i1" }, { target_user: "u1", target_item: "i2" }, { target_user: "u2", target_item: "i1" },
    ]);
    expect(m.get(threadKey("u1", "i1"))).toBe(2);
    expect(m.get(threadKey("u2", "i1"))).toBe(1);
    expect(m.get(threadKey("u9", "i1"))).toBeUndefined();
  });
});
