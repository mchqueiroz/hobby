import { describe, expect, it } from "vitest";
import { similarTo } from "../similar";
import { SEED } from "../catalog";
import { EMPTY_LIBRARY, type Item, type Library } from "../types";

const it0 = (id: string, media: Item["media"], vibes: string[], title = id): Item => ({ id, title, media, vibes, source: "tmdb" });
const lib = (patch: Partial<Library> = {}): Library => ({ ...EMPTY_LIBRARY, ...patch });
const base = SEED.find((i) => i.id === "seed:jogo:hades")!;

describe("similarTo", () => {
  it("devolve obras de outras mídias que dividem pelo menos 2 vibes, sem a própria obra", () => {
    const r = similarTo(lib(), base);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.shared.length >= 2 && x.shared.every((v) => base.vibes.includes(v)))).toBe(true);
    expect(r.some((x) => x.item.id === base.id)).toBe(false);
    expect(new Set(r.map((x) => x.item.media)).size).toBeGreaterThan(1);
  });
  it("não repete a mesma obra vinda de outra fonte (mesmo título e mídia)", () => {
    const dup = it0("tmdb:x", "jogo", base.vibes, base.title);
    expect(similarTo(lib({ items: { [dup.id]: dup } }), base).some((x) => x.item.id === dup.id)).toBe(false);
  });
  it("tira o que já foi registrado ou dispensado", () => {
    const first = similarTo(lib(), base)[0].item;
    const e = { itemId: first.id, status: "concluido" as const, at: 1 };
    expect(similarTo(lib({ entries: { [first.id]: e } }), base).some((x) => x.item.id === first.id)).toBe(false);
    expect(similarTo(lib({ dismissed: [first.id] }), base).some((x) => x.item.id === first.id)).toBe(false);
  });
  it("limita a 3 por mídia e respeita n", () => {
    const many = Array.from({ length: 10 }, (_, i) => it0(`m${i}`, "filme", ["a", "b", "c"], `Filme ${i}`));
    const r = similarTo(lib({ items: Object.fromEntries(many.map((m) => [m.id, m])) }), it0("alvo", "livro", ["a", "b", "c"]), 5);
    expect(r.filter((x) => x.item.media === "filme").length).toBeLessThanOrEqual(3);
    expect(r.length).toBeLessThanOrEqual(5);
  });
  it("ordena pelo que mais se parece (Jaccard) e é estável", () => {
    const a = it0("a", "filme", ["x", "y", "z"], "A"), b = it0("b", "anime", ["x", "y", "w", "q"], "B");
    const r = similarTo(lib({ items: { a, b } }), it0("alvo", "livro", ["x", "y", "z"]));
    expect(r.map((x) => x.item.id).slice(0, 2)).toEqual(["a", "b"]);
    expect(similarTo(lib({ items: { a, b } }), it0("alvo", "livro", ["x", "y", "z"]))).toEqual(r);
  });
  it("sem 2 vibes em comum não entra", () => {
    const c = it0("c", "filme", ["x", "outra"]);
    expect(similarTo(lib({ items: { c } }), it0("alvo", "livro", ["x", "y"])).some((x) => x.item.id === "c")).toBe(false);
  });
});
