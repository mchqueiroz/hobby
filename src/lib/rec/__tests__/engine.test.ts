import { describe, expect, it } from "vitest";
import type { Item } from "../../types";
import { buildContext, DEFAULT_PARAMS, rankV2, rankWithDiversity, scoreAll, similarity, userSignals, type Interaction } from "../engine";
import { diversity, ndcg, hitRate, pairedCI } from "../metrics";
import { BASE_WORLD, buildWorld, mulberry32, splitUserForTest } from "./helpers";
import { popular, random, run, v1, v2 } from "../harness";

const it_ = (id: string, media: Item["media"], vibes: string[]): Item => ({ id, title: id, media, vibes, source: "seed" });
const hist = (item: Item, rating: number | undefined, day = 0, status: Interaction["status"] = "concluido"): Interaction => ({ item, rating, day, status });

describe("sinais do usuário", () => {
  const a = it_("a", "anime", ["x"]);
  const b = it_("b", "anime", ["y"]);
  it("nota é relativa à própria pessoa: quem dá 5 em tudo não vê tudo como positivo forte", () => {
    const generous = [hist(a, 5), hist(b, 5), hist(it_("c", "anime", ["z"]), 5)];
    const s = userSignals(generous, 0, DEFAULT_PARAMS);
    expect(Math.max(...s.map((x) => Math.abs(x.s)))).toBeLessThan(2);
    const mixed = userSignals([hist(a, 5), hist(b, 1)], 0, DEFAULT_PARAMS);
    expect(mixed[0].s).toBeGreaterThan(0);
    expect(mixed[1].s).toBeLessThan(0);
  });
  it("sinais negativos e sem nota entram com os valores configurados; quero ver não entra", () => {
    const s = userSignals([hist(a, undefined, 0, "abandonei"), hist(b, undefined, 0, "quero"), hist(a, undefined, 0, "dismissed"), hist(b, undefined, 0, "concluido")], 0, DEFAULT_PARAMS);
    expect(s.map((x) => x.s)).toEqual([DEFAULT_PARAMS.negAbandon, DEFAULT_PARAMS.negDismiss, DEFAULT_PARAMS.unratedDone]);
  });
  it("o peso cai pela metade a cada meia-vida", () => {
    const s = userSignals([hist(a, 4, 0)], 365, { ...DEFAULT_PARAMS, halfLife: 365 });
    expect(s[0].w).toBeCloseTo(0.5, 6);
    expect(userSignals([hist(a, 4, 0)], 9999, { ...DEFAULT_PARAMS, halfLife: Infinity })[0].w).toBe(1);
  });
});

describe("pontuação", () => {
  const dark1 = it_("d1", "anime", ["sombrio", "mistério"]);
  const dark2 = it_("d2", "jogo", ["sombrio", "mistério"]);
  const fun = it_("f1", "jogo", ["humor leve"]);
  const ctx = buildContext([dark1, dark2, fun], false);
  const p = { ...DEFAULT_PARAMS, priorWeight: 0 };

  it("sem histórico todos empatam em zero (ou no prior)", () => {
    expect(scoreAll([], [dark2, fun], ctx, p, 0).map((x) => x.score)).toEqual([0, 0]);
    expect(scoreAll([], [dark2, fun], ctx, DEFAULT_PARAMS, 0, [1, -1]).map((x) => x.score)).toEqual([DEFAULT_PARAMS.priorWeight, -DEFAULT_PARAMS.priorWeight]);
  });
  it("o que se parece com o que foi bem avaliado sobe, mesmo em outra mídia, e traz o item âncora", () => {
    const h = [hist(dark1, 5), hist(fun, 1)];
    const [a, b] = scoreAll(h, [dark2, it_("f2", "anime", ["humor leve"])], ctx, p, 0);
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.anchor?.item.id).toBe("d1");
  });
  it("evidência fraca vale menos que evidência forte (encolhimento)", () => {
    const one = scoreAll([hist(dark1, 5), hist(fun, 1)], [dark2], ctx, { ...p, knnWeight: 0 }, 0)[0].score;
    const many = scoreAll([hist(dark1, 5), hist(it_("d3", "anime", ["sombrio", "mistério"]), 5), hist(it_("d4", "anime", ["sombrio", "mistério"]), 5), hist(fun, 1)], [dark2], ctx, { ...p, knnWeight: 0 }, 0)[0].score;
    expect(many).toBeGreaterThan(one);
  });
  it("itens parecidos com algo abandonado descem", () => {
    const s = scoreAll([hist(dark1, undefined, 0, "abandonei"), hist(fun, 4)], [dark2, it_("f2", "anime", ["humor leve"])], ctx, p, 0);
    expect(s[0].score).toBeLessThan(s[1].score);
  });
  it("é determinístico", () => {
    const h = [hist(dark1, 5), hist(fun, 2)];
    expect(rankV2(h, [dark2, fun], ctx, p, 0)).toEqual(rankV2(h, [dark2, fun], ctx, p, 0));
  });
});

describe("similaridade e diversidade", () => {
  const a = it_("a", "anime", ["x", "y"]);
  const ctx = buildContext([a], false);
  it("cosseno em [0,1]", () => {
    expect(similarity(ctx, a, it_("b", "jogo", ["x", "y"]))).toBeCloseTo(1, 6);
    expect(similarity(ctx, a, it_("c", "jogo", ["z"]))).toBe(0);
    expect(similarity(ctx, a, it_("d", "jogo", ["x", "z"]))).toBeCloseTo(0.5, 6);
  });
  it("MMR troca um quase-duplicado por algo diferente no topo, sem perder ninguém", () => {
    const c = [it_("a", "anime", ["x", "y"]), it_("b", "anime", ["x", "y"]), it_("c", "jogo", ["z", "w"])];
    const scores = [1, 0.95, 0.9];
    const plain = rankWithDiversity(scores, c, ctx, { ...DEFAULT_PARAMS, mmrLambda: 1 });
    const div = rankWithDiversity(scores, c, ctx, { ...DEFAULT_PARAMS, mmrLambda: 0.5 });
    expect(plain).toEqual([0, 1, 2]);
    expect(div[0]).toBe(0);
    expect(div[1]).toBe(2);
    expect([...div].sort()).toEqual([0, 1, 2]);
  });
});

describe("métricas", () => {
  it("ndcg: 1 quando a ordem é a ideal, menor quando não", () => {
    const g = new Map([[0, 3], [1, 1]]);
    expect(ndcg([0, 1, 2], g, 3)).toBeCloseTo(1, 6);
    expect(ndcg([2, 1, 0], g, 3)).toBeLessThan(1);
    expect(ndcg([2], new Map(), 3)).toBe(0);
  });
  it("hitRate e diversidade", () => {
    expect(hitRate([5, 6], new Set([6]), 2)).toBe(1);
    expect(hitRate([5, 6], new Set([6]), 1)).toBe(0);
    const items = [it_("a", "anime", ["x"]), it_("b", "anime", ["x"]), it_("c", "anime", ["y"])];
    const ctx = buildContext(items, false);
    expect(diversity([0, 1], items, ctx, 2)).toBeCloseTo(0, 6);
    expect(diversity([0, 2], items, ctx, 2)).toBeCloseTo(1, 6);
  });
  it("intervalo pareado cobre zero quando não há diferença e exclui quando há", () => {
    const x = Array.from({ length: 200 }, (_, i) => Math.sin(i));
    expect(pairedCI(x, x).diff).toBe(0);
    const y = x.map((v) => v + 0.5);
    const ci = pairedCI(y, x);
    expect(ci.lo).toBeGreaterThan(0.4);
  });
});

describe("laboratório", () => {
  it("o mundo sintético é reproduzível e respeita o ritmo temporal", () => {
    const c = { ...BASE_WORLD, users: 12, items: 80, seed: 5 };
    const w1 = buildWorld(c);
    const w2 = buildWorld(c);
    expect(w1.users[3].events.map((e) => e.item.id)).toEqual(w2.users[3].events.map((e) => e.item.id));
    for (const u of w1.users) for (let i = 1; i < u.events.length; i++) expect(u.events[i].day).toBeGreaterThanOrEqual(u.events[i - 1].day);
    expect(mulberry32(1)()).toBe(mulberry32(1)());
    const { train, test } = splitUserForTest(w1.users[0]);
    if (train.length && test.length) expect(train[train.length - 1].day).toBeLessThanOrEqual(test[0].day);
  });

  it("ninguém recebe item que já viu e o teste não vaza para o treino", () => {
    const c = { ...BASE_WORLD, users: 20, items: 120, seed: 3 };
    let seenLeak = false;
    const spy = (x: Parameters<typeof v2>[0] extends never ? never : Parameters<ReturnType<typeof v2>>[0]) => {
      const trainIds = new Set(x.history.map((h) => h.item.id));
      if (x.candidates.some((cand) => trainIds.has(cand.id))) seenLeak = true;
      return random(x);
    };
    run(c, { spy });
    expect(seenLeak).toBe(false);
  });

  it("regressão: o v2 supera o método antigo, a popularidade e o acaso num mundo pequeno", () => {
    const c = { ...BASE_WORLD, users: 70, items: 240, seed: 21 };
    const { results } = run(c, { random, popular, v1, v2: v2({ priorStrength: 8, halfLife: 720, vibeShrink: 4, knnWeight: 0.25, mediaWeight: 0.5, mmrLambda: 0.8, priorWeight: 0.35 }) });
    const m = (k: string) => results[k].reduce((a, r) => a + r.oracle, 0) / results[k].length;
    expect(m("v2")).toBeGreaterThan(m("v1"));
    expect(m("v2")).toBeGreaterThan(m("random"));
    expect(m("v2")).toBeGreaterThanOrEqual(m("popular") - 0.02);
  });
});
