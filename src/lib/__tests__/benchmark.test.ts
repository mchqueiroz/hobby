import { beforeEach, describe, expect, it, vi } from "vitest";
import { timeSpent } from "../stats";
import { decodeList, encodeList } from "../shareList";
import { allRows, applyFilters, DEFAULT_FILTERS, facets } from "../libraryFilter";
import { buildStats, parseStats } from "../social";
import { EMPTY_LIBRARY, type Entry, type Item, type Library } from "../types";

const item = (id: string, media: Item["media"], extra: Partial<Item> = {}): Item => ({ id, title: id, media, vibes: ["aventura"], source: "anilist", ...extra });
const lib = (pairs: [Item, Partial<Entry>][]): Library => ({
  ...EMPTY_LIBRARY,
  items: Object.fromEntries(pairs.map(([i]) => [i.id, i])),
  entries: Object.fromEntries(pairs.map(([i, e]) => [i.id, { itemId: i.id, status: "concluido", at: 1, ...e } as Entry])),
});

describe("timeSpent", () => {
  it("usa progresso e total quando há; senão a duração típica; multiplica pelas vezes", () => {
    const t = timeSpent(lib([
      [item("a:1", "anime"), { total: 24 }],                      // 24 episódios × 24 min = 9,6 h
      [item("f:1", "filme"), { rounds: 2 }],                       // filme 2 h × 2
      [item("f:2", "filme"), { total: 10 }],                       // série: 10 × 45 min = 7,5 h
      [item("j:1", "jogo"), { status: "andamento", progress: 30 }], // 30 h anotadas
      [item("l:1", "livro"), { total: 400 }],                      // 400 páginas ÷ 40 = 10 h
      [item("q:1", "livro"), { status: "quero" }],                 // quero não conta
    ]));
    expect(t.byMedia).toMatchObject({ anime: 10, filme: 12, jogo: 30, livro: 10 });
    expect(t.total).toBe(62);
  });
});

describe("lista por link", () => {
  it("ida e volta mantém nome, ordem, mídia, ano e capa", () => {
    const items = [item("tmdb:movie:1", "filme", { title: "Cidade de Deus", year: 2002, cover: "https://image.tmdb.org/x.jpg" }), item("seed:livro:o-hobbit", "livro", { title: "O Hobbit ✨" })];
    const back = decodeList(encodeList("Para o fim de semana", items))!;
    expect(back.name).toBe("Para o fim de semana");
    expect(back.items.map((i) => [i.id, i.title, i.media, i.year, i.cover])).toEqual([
      ["tmdb:movie:1", "Cidade de Deus", "filme", 2002, "https://image.tmdb.org/x.jpg"],
      ["seed:livro:o-hobbit", "O Hobbit ✨", "livro", undefined, undefined],
    ]);
  });
  it("recusa lixo, capa sem https, mídia ou fonte desconhecidas", () => {
    expect(decodeList("isso-nao-e-base64!!")).toBeNull();
    const evil = btoa(JSON.stringify({ v: 1, n: "x", i: [["tmdb:1", "Ok", "filme", null, null, "javascript:alert(1)"], ["evil:1", "Fonte", "filme"], ["anilist:2", "Mídia", "podcast"]] }));
    const r = decodeList(evil)!;
    expect(r.items).toHaveLength(1);
    expect(r.items[0].cover).toBeUndefined();
  });
});

describe("filtro de plataforma / formato", () => {
  it("conta e filtra pelo formato do registro", () => {
    const l = lib([[item("j:1", "jogo"), { format: "Switch" }], [item("j:2", "jogo"), { format: "PC" }], [item("j:3", "jogo"), {}]]);
    const rows = allRows(l);
    expect(facets(rows, DEFAULT_FILTERS).formats).toEqual([{ format: "PC", count: 1 }, { format: "Switch", count: 1 }]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, format: "Switch" }).map((r) => r.item.id)).toEqual(["j:1"]);
  });
});

describe("vitrine pública", () => {
  it("publica as fixadas na ordem e valida ao ler", () => {
    const l = lib([[item("a:1", "anime", { cover: "https://s4.anilist.co/a.jpg" }), { pin: 20 }], [item("a:2", "anime"), { pin: 10 }], [item("a:3", "anime"), {}]]);
    const s = buildStats(l);
    expect(s.showcase?.map((x) => x.id)).toEqual(["a:2", "a:1"]);
    const parsed = parseStats({ ...s, showcase: [...s.showcase!, { id: "x", title: "y", media: "podcast" }, { id: "z", title: "w", media: "filme", cover: "http://inseguro" }] });
    expect(parsed.showcase?.map((x) => x.id)).toEqual(["a:2", "a:1", "z"]);
    expect(parsed.showcase?.[2].cover).toBeUndefined();
  });
});

/* ---------- ações do store (vitrine e fila) ---------- */

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
let store: typeof import("../store");
beforeEach(async () => {
  (globalThis as unknown as { window: object }).window = {};
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  vi.resetModules();
  store = await import("../store");
});

describe("vitrine e fila no store", () => {
  it("vitrine aceita até 4 e mantém o campo ao refazer o registro", () => {
    const its = [1, 2, 3, 4, 5].map((n) => item(`anilist:${n}`, "anime"));
    for (const i of its) store.saveEntry(i, "concluido", 5);
    expect(its.slice(0, 4).every((i) => store.togglePin(i.id))).toBe(true);
    expect(store.togglePin(its[4].id)).toBe(false);
    store.saveEntry(its[0], "concluido", 4);
    expect(store.getLibrary().entries[its[0].id].pin).toBeDefined();
  });
  it("fila só para 'quero', sobe posição e sai ao começar", () => {
    const [a, b] = [item("anilist:10", "anime"), item("anilist:11", "anime")];
    store.saveEntry(a, "quero");
    store.saveEntry(b, "quero");
    store.toggleQueue(a.id);
    store.toggleQueue(b.id);
    store.queueUp(b.id);
    const q = () => Object.values(store.getLibrary().entries).filter((e) => e.queue).sort((x, y) => x.queue! - y.queue!).map((e) => e.itemId);
    expect(q()).toEqual([b.id, a.id]);
    store.saveEntry(b, "andamento");
    expect(q()).toEqual([a.id]);
    store.saveEntry(a, "concluido", 5);
    expect(store.toggleQueue(a.id)).toBe(false);
  });
});

describe("música saiu do app", () => {
  it("registro antigo de música fica guardado, mas some das telas", async () => {
    const { getItem } = await import("../recommend");
    const l = lib([[item("deezer:1", "musica"), { rating: 5 }], [item("anilist:1", "anime"), {}]]);
    expect(getItem(l, "deezer:1")).toBeUndefined();
    expect(l.entries["deezer:1"]).toBeDefined();
    expect(allRows(l).map((r) => r.item.id)).toEqual(["anilist:1"]);
  });
});
