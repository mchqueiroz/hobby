import { describe, expect, it } from "vitest";
import { canonical, mergeLibraries, parseRemote, sameLibrary, touch } from "../sync";
import { EMPTY_LIBRARY, type Entry, type Item, type Library, type UserList } from "../types";

const item = (id: string): Item => ({ id, title: id.toUpperCase(), media: "filme", vibes: ["drama humano"], source: "tmdb" });
const entry = (id: string, over: Partial<Entry> = {}): Entry => ({ itemId: id, status: "concluido", rating: 4, at: 1000, ...over });
const lib = (over: Partial<Library> = {}): Library => ({ ...EMPTY_LIBRARY, items: {}, entries: {}, dismissed: [], lists: {}, ...over });

describe("merge: casos do dia a dia", () => {
  it("soma o que cada lado tem, sem perder nada", () => {
    const a = lib({ entries: { x: entry("x") }, items: { x: item("x") } });
    const b = lib({ entries: { y: entry("y") }, items: { y: item("y") } });
    const m = mergeLibraries(a, b);
    expect(Object.keys(m.entries).sort()).toEqual(["x", "y"]);
    expect(Object.keys(m.items).sort()).toEqual(["x", "y"]);
  });
  it("o mais recente vence quando os dois mexeram no mesmo registro", () => {
    const a = lib({ entries: { x: entry("x", { rating: 2 }) }, ts: { "e:x": 100 } });
    const b = lib({ entries: { x: entry("x", { rating: 5 }) }, ts: { "e:x": 200 } });
    expect(mergeLibraries(a, b).entries.x.rating).toBe(5);
    expect(mergeLibraries(b, a).entries.x.rating).toBe(5);
  });
  it("apagar num aparelho apaga no outro, e o dado não ressuscita no sync seguinte", () => {
    const antes = lib({ entries: { x: entry("x") }, items: { x: item("x") }, ts: { "e:x": 100 } });
    const apagou = lib({ entries: {}, ts: { "e:x": 300 } });
    const m = mergeLibraries(antes, apagou);
    expect(m.entries.x).toBeUndefined();
    expect(m.items.x).toBeUndefined(); // o cache do item também sai
    expect(mergeLibraries(m, antes).entries.x).toBeUndefined();
    expect(mergeLibraries(antes, m).entries.x).toBeUndefined();
  });
  it("registrar de novo depois de apagar vence o apagamento mais antigo", () => {
    const apagou = lib({ ts: { "e:x": 300 } });
    const voltou = lib({ entries: { x: entry("x") }, ts: { "e:x": 400 } });
    expect(mergeLibraries(apagou, voltou).entries.x).toBeDefined();
  });
  it("dado antigo sem carimbo: quem tem o registro ganha de quem nunca o viu", () => {
    const velho = lib({ entries: { x: entry("x", { at: 0 }) } }); // importado, sem data
    expect(mergeLibraries(velho, lib()).entries.x).toBeDefined();
    expect(mergeLibraries(lib(), velho).entries.x).toBeDefined();
  });
  it("não ressuscita registro apagado mesmo quando o outro lado é dado antigo sem carimbo", () => {
    const antigo = lib({ entries: { x: entry("x", { at: 500 }) } });
    const apagou = lib({ ts: { "e:x": 900 } });
    expect(mergeLibraries(antigo, apagou).entries.x).toBeUndefined();
    // mas se o dado antigo é mais novo que o apagamento, ele vence
    expect(mergeLibraries(lib({ entries: { x: entry("x", { at: 1200 }) } }), apagou).entries.x).toBeDefined();
  });
  it('"não é pra mim" e desfazer funcionam entre aparelhos', () => {
    const marcou = lib({ dismissed: ["x"], ts: { "d:x": 100 } });
    const desfez = lib({ dismissed: [], ts: { "d:x": 200 } });
    expect(mergeLibraries(marcou, desfez).dismissed).toEqual([]);
    expect(mergeLibraries(marcou, lib()).dismissed).toEqual(["x"]);
  });
  it("listas: a versão mais nova vale inteira; apagar lista apaga", () => {
    const l = (name: string, ids: string[]): UserList => ({ id: "L", name, itemIds: ids, createdAt: 50 });
    const a = lib({ lists: { L: l("Velha", ["x"]) }, ts: { "l:L": 100 } });
    const b = lib({ lists: { L: l("Nova", ["x", "y"]) }, items: { y: item("y") }, ts: { "l:L": 200 } });
    expect(mergeLibraries(a, b).lists.L.name).toBe("Nova");
    expect(mergeLibraries(a, lib({ ts: { "l:L": 300 } })).lists.L).toBeUndefined();
  });
  it("meta: a que a pessoa mexeu vence a padrão; entre duas mexidas, a mais recente", () => {
    expect(mergeLibraries(lib({ goal: 80 }), lib({ goal: 120 })).goal).toBe(120);
    expect(mergeLibraries(lib({ goal: 50, ts: { g: 100 } }), lib({ goal: 120, ts: { g: 200 } })).goal).toBe(120);
    expect(mergeLibraries(lib({ goal: 50, ts: { g: 300 } }), lib({ goal: 120, ts: { g: 200 } })).goal).toBe(50);
  });
  it("cache de itens: só o que alguém ainda usa", () => {
    const m = mergeLibraries(lib({ items: { x: item("x"), lixo: item("lixo") }, entries: { x: entry("x") } }), lib());
    expect(Object.keys(m.items)).toEqual(["x"]);
  });
  it("touch: sempre maior que o carimbo anterior, mesmo com o relógio parado", () => {
    const t1 = touch(lib(), ["e:x"], 1000)!;
    const t2 = touch(lib({ ts: t1 }), ["e:x"], 1000)!;
    expect(t2["e:x"]).toBeGreaterThan(t1["e:x"]);
    expect(touch(lib({ ts: t1 }), ["e:x"], 5)!["e:x"]).toBeGreaterThan(t1["e:x"]);
  });
  it("sameLibrary ignora a ordem das chaves e o lixo no cache", () => {
    const a = lib({ entries: { x: entry("x"), y: entry("y") }, items: { lixo: item("lixo") } });
    const b = lib({ entries: { y: entry("y"), x: entry("x") } });
    expect(sameLibrary(a, b)).toBe(true);
    expect(sameLibrary(a, lib({ entries: { x: entry("x") } }))).toBe(false);
  });
});

describe("parseRemote: não confia no que vem da nuvem", () => {
  it("formato errado vira biblioteca vazia, e merge com vazio nunca apaga o local", () => {
    for (const bad of [null, undefined, 5, "x", {}, { lib: 5 }, { v: 1, lib: [] }]) {
      expect(parseRemote(bad)).toEqual(EMPTY_LIBRARY);
    }
    const local = lib({ entries: { x: entry("x") } });
    expect(mergeLibraries(local, parseRemote({ lib: "lixo" })).entries.x).toBeDefined();
  });
  it("descarta registro e lista malformados, mantém os bons", () => {
    const r = parseRemote({
      v: 1,
      lib: {
        entries: { x: entry("x"), y: { itemId: "outro", status: "concluido" }, z: null },
        lists: { L: { id: "L", name: "ok", itemIds: [], createdAt: 1 }, M: { name: 5 } },
        dismissed: ["a", 5, null],
        goal: "muito",
        ts: { "e:x": 5, "e:y": "agora", "g": Infinity },
      },
    });
    expect(Object.keys(r.entries)).toEqual(["x"]);
    expect(Object.keys(r.lists)).toEqual(["L"]);
    expect(r.dismissed).toEqual(["a"]);
    expect(r.goal).toBe(80);
    expect(r.ts).toEqual({ "e:x": 5 });
  });
});

/* ------------------------ propriedades, com gerador aleatório fixo ------------------------ */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomLib(r: () => number): Library {
  const ids = ["a", "b", "c", "d"];
  const out = lib({ goal: [80, 50, 100][Math.floor(r() * 3)] });
  const ts: Record<string, number> = {};
  const maybeTs = (k: string) => {
    if (r() < 0.6) ts[k] = Math.floor(r() * 6); // poucos valores: muitos empates de propósito
  };
  for (const id of ids) {
    const roll = r();
    if (roll < 0.6) {
      out.entries[id] = entry(id, { rating: [2, 3, 4, 5][Math.floor(r() * 4)], at: Math.floor(r() * 6) });
    }
    maybeTs(`e:${id}`);
    if (r() < 0.3) out.dismissed.push(id);
    maybeTs(`d:${id}`);
    if (r() < 0.4) out.lists[id] = { id, name: ["x", "y"][Math.floor(r() * 2)], itemIds: r() < 0.5 ? [id] : [], createdAt: Math.floor(r() * 6) };
    maybeTs(`l:${id}`);
  }
  out.dismissed.sort();
  // regra do app: tudo que um registro, "não é pra mim" ou lista cita tem o item guardado do mesmo lado (o store faz isso)
  for (const id of [...Object.keys(out.entries), ...out.dismissed, ...Object.values(out.lists).flatMap((l) => l.itemIds)]) out.items[id] = item(id);
  maybeTs("g");
  if (Object.keys(ts).length) out.ts = ts;
  return out;
}

describe("merge: propriedades (2000 casos aleatórios com muitos empates)", () => {
  const N = 2000;
  const cases = (f: (a: Library, b: Library, c: Library) => void) => {
    const r = rng(12345);
    for (let i = 0; i < N; i++) f(randomLib(r), randomLib(r), randomLib(r));
  };
  const eq = (x: Library, y: Library) => expect(canonical(x)).toBe(canonical(y));

  it("comutativo: merge(a,b) = merge(b,a)", () => cases((a, b) => eq(mergeLibraries(a, b), mergeLibraries(b, a))));
  it("idempotente: juntar de novo o mesmo lado não muda nada", () =>
    cases((a, b) => {
      const m = mergeLibraries(a, b);
      eq(mergeLibraries(m, b), m);
      eq(mergeLibraries(m, a), m);
      eq(mergeLibraries(m, m), m);
    }));
  it("associativo: a ordem de juntar três aparelhos não importa", () =>
    cases((a, b, c) => eq(mergeLibraries(mergeLibraries(a, b), c), mergeLibraries(a, mergeLibraries(b, c)))));
  it("convergência: dois aparelhos que se sincronizam pela nuvem terminam iguais", () =>
    cases((a, b) => {
      const cloud = mergeLibraries(a, b); // A sobe, B junta e sobe
      const a2 = mergeLibraries(a, cloud);
      const b2 = mergeLibraries(b, cloud);
      eq(a2, b2);
    }));
  it("nada some sem apagamento: todo registro de um lado sem carimbo em nenhum aparece no resultado", () =>
    cases((a, b) => {
      const m = mergeLibraries(a, b);
      for (const side of [a, b]) {
        for (const id of Object.keys(side.entries)) {
          const other = side === a ? b : a;
          const tsHere = side.ts?.[`e:${id}`];
          const tsOther = other.ts?.[`e:${id}`];
          // só pode sumir se alguém tem um apagamento/versão mais nova dessa chave
          if (tsHere === undefined && tsOther === undefined && !other.entries[id]) expect(m.entries[id]).toBeDefined();
        }
      }
    }));
});
