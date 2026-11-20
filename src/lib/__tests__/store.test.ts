import { beforeEach, describe, expect, it } from "vitest";
import type { Imported } from "../anilist";
import { SEED_BY_ID } from "../catalog";

// o store lê window e localStorage; aqui entram versões mínimas para rodar fora do navegador
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
let store: typeof import("../store");
let ls: MemoryStorage;

beforeEach(async () => {
  ls = new MemoryStorage();
  (globalThis as unknown as { window: object }).window = {};
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = ls;
  (await import("vitest")).vi.resetModules();
  store = await import("../store");
});

const imp = (titles: [number, string][]): Imported => ({
  items: titles.map(([n, t]) => ({ id: `anilist:${n}`, title: t, media: "anime" as const, vibes: ["psicológico"], source: "anilist" as const })),
  entries: titles.map(([n]) => ({ itemId: `anilist:${n}`, status: "concluido" as const, rating: 4, at: 123 })),
  counts: { quero: 0, andamento: 0, concluido: titles.length, abandonei: 0 },
  withoutVibes: 0,
});

describe("armazenamento", () => {
  it("registra e desfaz, voltando ao estado anterior", () => {
    const hades = SEED_BY_ID["seed:jogo:hades"];
    store.saveEntry(hades, "concluido", 5);
    store.saveEntry(hades, "concluido", 3);
    expect(ls.getItem("hobby:v1")).toContain('"rating":3');
    expect(store.undoLast()).toBe(true);
    expect(JSON.parse(ls.getItem("hobby:v1")!).entries["seed:jogo:hades"].rating).toBe(5);
    expect(store.undoLast()).toBe(false); // só desfaz uma vez
  });

  it("registrar um item dispensado tira ele dos dispensados", () => {
    const hades = SEED_BY_ID["seed:jogo:hades"];
    store.dismiss(hades.id);
    store.saveEntry(hades, "quero");
    expect(JSON.parse(ls.getItem("hobby:v1")!).dismissed).toEqual([]);
  });

  it("importação não sobrescreve registro manual nem duplica título já existente", () => {
    store.saveEntry(SEED_BY_ID["seed:anime:death-note"], "concluido", 2); // registrado à mão pelo catálogo base
    const r = store.importHistory(imp([[1535, "Death Note"], [1, "Cowboy Bebop"]]));
    expect(r).toEqual({ added: 1, skipped: 1 });
    const saved = JSON.parse(ls.getItem("hobby:v1")!);
    expect(saved.entries["seed:anime:death-note"].rating).toBe(2);
    expect(saved.entries["anilist:1535"]).toBeUndefined();
    expect(saved.items["anilist:1535"]).toBeUndefined();
    expect(saved.entries["anilist:1"].at).toBe(0); // histórico não conta na meta do ano
  });

  it("importar duas vezes a mesma lista não repete nada", () => {
    store.importHistory(imp([[1, "Cowboy Bebop"], [2, "Monster"]]));
    const again = store.importHistory(imp([[1, "Cowboy Bebop"], [2, "Monster"]]));
    expect(again).toEqual({ added: 0, skipped: 2 });
  });

  it("dado corrompido ou de outro formato vira biblioteca vazia", async () => {
    for (const bad of ["{lixo", '{"entries":[]}', "null", '"texto"']) {
      ls.setItem("hobby:v1", bad);
      (await import("vitest")).vi.resetModules();
      const fresh = await import("../store");
      expect(JSON.parse(fresh.exportData()).entries).toEqual({});
    }
  });

  it("excluir tudo apaga biblioteca e métricas", () => {
    store.saveEntry(SEED_BY_ID["seed:jogo:hades"], "concluido", 5);
    store.track("x");
    store.deleteAll();
    expect(ls.getItem("hobby:v1")).toBe(JSON.stringify({ items: {}, entries: {}, dismissed: [], goal: 80, lists: {} }));
    expect(ls.getItem("hobby:events")).toBeNull();
  });

  it("métrica nunca derruba o app quando o armazenamento falha", () => {
    (globalThis as unknown as { localStorage: object }).localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
    expect(() => store.track("x")).not.toThrow();
    expect(store.readEvents()).toEqual([]);
  });
});

describe("resenha, data e listas", () => {
  const hades = SEED_BY_ID["seed:jogo:hades"];
  const read = () => JSON.parse(ls.getItem("hobby:v1")!);

  it("salva resenha e data, apaga a resenha com texto vazio e limita o tamanho", () => {
    store.saveEntry(hades, "concluido", 5);
    store.setNote(hades.id, { review: "  ótimo  ", date: 123 });
    expect(read().entries[hades.id]).toMatchObject({ review: "ótimo", date: 123 });
    store.setNote(hades.id, { review: "x".repeat(5000) });
    expect(read().entries[hades.id].review).toHaveLength(store.MAX_REVIEW);
    store.setNote(hades.id, { review: "   " });
    expect(read().entries[hades.id].review).toBeUndefined();
    store.setNote(hades.id, { date: null });
    expect(read().entries[hades.id].date).toBeUndefined();
  });

  it("refazer o registro mantém resenha e data", () => {
    store.saveEntry(hades, "concluido", 5);
    store.setNote(hades.id, { review: "guarda isso", date: 777 });
    store.saveEntry(hades, "concluido", 3);
    expect(read().entries[hades.id]).toMatchObject({ rating: 3, review: "guarda isso", date: 777 });
  });

  it("nota em item sem registro é ignorada", () => {
    store.setNote("seed:jogo:hades", { review: "oi" });
    expect(JSON.parse(store.exportData()).entries).toEqual({});
  });

  it("cria, renomeia, preenche e apaga listas", () => {
    const id = store.createList("  Melhores de 2026  ")!;
    expect(read().lists[id].name).toBe("Melhores de 2026");
    expect(store.createList("   ")).toBeNull();
    expect(store.toggleInList(id, hades)).toBe(true);
    expect(read().lists[id].itemIds).toEqual([hades.id]);
    expect(store.toggleInList(id, hades)).toBe(false);
    expect(read().lists[id].itemIds).toEqual([]);
    store.renameList(id, "Favoritos");
    expect(read().lists[id].name).toBe("Favoritos");
    store.deleteList(id);
    expect(read().lists[id]).toBeUndefined();
  });

  it("item de API vai para a biblioteca ao entrar numa lista", () => {
    const id = store.createList("API")!;
    const api = { id: "tmdb:movie:1", title: "Duna", media: "filme" as const, vibes: ["aventura"], source: "tmdb" as const };
    store.toggleInList(id, api);
    expect(read().items["tmdb:movie:1"].title).toBe("Duna");
  });

  it("dados antigos, sem listas, abrem normalmente", async () => {
    ls.setItem("hobby:v1", JSON.stringify({ items: {}, entries: {}, dismissed: [], goal: 50 }));
    (await import("vitest")).vi.resetModules();
    store = await import("../store");
    store.createList("Nova"); // não pode quebrar por falta de `lists`
    expect(Object.keys(read().lists)).toHaveLength(1);
    expect(read().goal).toBe(50);
  });
});


describe("progresso", () => {
  const anime = SEED_BY_ID["seed:anime:death-note"];
  const read = () => JSON.parse(ls.getItem("hobby:v1")!);
  it("guarda e arredonda o progresso, e zero ou vazio apaga", () => {
    store.saveEntry(anime, "andamento");
    store.setNote(anime.id, { progress: 12.34 });
    expect(read().entries[anime.id].progress).toBe(12.3);
    store.setNote(anime.id, { progress: 0 });
    expect(read().entries[anime.id].progress).toBeUndefined();
    store.setNote(anime.id, { progress: 5 });
    store.setNote(anime.id, { progress: null });
    expect(read().entries[anime.id].progress).toBeUndefined();
    store.setNote(anime.id, { progress: Number.NaN });
    expect(read().entries[anime.id].progress).toBeUndefined();
  });
  it("mantém o progresso enquanto continua em andamento e perde ao concluir", () => {
    store.saveEntry(anime, "andamento");
    store.setNote(anime.id, { progress: 7 });
    store.saveEntry(anime, "andamento");
    expect(read().entries[anime.id].progress).toBe(7);
    store.saveEntry(anime, "concluido", 4);
    expect(read().entries[anime.id].progress).toBeUndefined();
  });
});

describe("carimbos de tempo (base da sincronização)", () => {
  const it1 = SEED_BY_ID["seed:anime:cowboy-bebop"];
  const it2 = SEED_BY_ID["seed:jogo:hades"];
  const ts = () => store.getLibrary().ts ?? {};

  it("cada mudança carimba só a chave que mexeu", () => {
    store.saveEntry(it1, "concluido", 5);
    expect(Object.keys(ts())).toEqual(["e:seed:anime:cowboy-bebop"]);
    store.setNote(it1.id, { review: "ótimo" });
    expect(ts()["e:seed:anime:cowboy-bebop"]).toBeGreaterThan(0);
    store.setGoal(30);
    expect(ts().g).toBeGreaterThan(0);
    const id = store.createList("Maratona")!;
    expect(ts()[`l:${id}`]).toBeGreaterThan(0);
    store.renameList(id, "Outra");
    store.toggleInList(id, it2);
    store.deleteList(id);
    expect(store.getLibrary().lists[id]).toBeUndefined();
    expect(ts()[`l:${id}`]).toBeGreaterThan(0); // apagar deixa o carimbo (tombstone)
  });
  it("cada mudança no mesmo item sobe o carimbo", () => {
    store.saveEntry(it1, "concluido", 4);
    const a = ts()["e:seed:anime:cowboy-bebop"];
    store.saveEntry(it1, "concluido", 5);
    expect(ts()["e:seed:anime:cowboy-bebop"]).toBeGreaterThan(a);
  });
  it("remover deixa carimbo sem valor; registrar de novo limpa o 'não é pra mim' com carimbo", () => {
    store.dismiss(it2.id);
    expect(ts()[`d:${it2.id}`]).toBeGreaterThan(0);
    store.saveEntry(it2, "quero");
    expect(store.getLibrary().dismissed).toEqual([]);
    expect(ts()[`d:${it2.id}`]).toBeGreaterThan(0);
    store.removeEntry(it2.id);
    expect(store.getLibrary().entries[it2.id]).toBeUndefined();
    expect(ts()[`e:${it2.id}`]).toBeGreaterThan(0);
  });
  it("desfazer também conta como mudança nova", () => {
    store.saveEntry(it1, "concluido", 4);
    const a = ts()["e:seed:anime:cowboy-bebop"];
    store.saveEntry(it1, "concluido", 2);
    expect(store.undoLast()).toBe(true);
    expect(store.getLibrary().entries[it1.id].rating).toBe(4);
    expect(ts()["e:seed:anime:cowboy-bebop"]).toBeGreaterThan(a);
  });
  it("aplicar o resultado do sync troca a biblioteca e avisa quem escuta", () => {
    let calls = 0;
    const off = store.subscribeLibrary(() => calls++);
    store.applySynced({ ...store.getLibrary(), goal: 12 });
    expect(store.getLibrary().goal).toBe(12);
    expect(calls).toBe(1);
    off();
  });
});

describe("resenha ao registrar", () => {
  const hades = SEED_BY_ID["seed:jogo:hades"];
  const read = () => JSON.parse(ls.getItem("hobby:v1")!);
  it("registrar com resenha guarda tudo junto; sem resenha mantém a anterior; resenha nova substitui", () => {
    store.saveEntry(hades, "concluido", 5, "  ótimo  ");
    expect(read().entries[hades.id]).toMatchObject({ rating: 5, review: "ótimo" });
    store.saveEntry(hades, "concluido", 4);
    expect(read().entries[hades.id]).toMatchObject({ rating: 4, review: "ótimo" });
    store.saveEntry(hades, "concluido", 4, "mudei de ideia");
    expect(read().entries[hades.id].review).toBe("mudei de ideia");
    store.saveEntry(hades, "concluido", 4, "   ");
    expect(read().entries[hades.id].review).toBe("mudei de ideia");
  });
  it("limita o tamanho e desfazer volta à resenha anterior", () => {
    store.saveEntry(hades, "concluido", 3, "primeira");
    store.saveEntry(hades, "concluido", 5, "x".repeat(5000));
    expect(read().entries[hades.id].review).toHaveLength(store.MAX_REVIEW);
    store.undoLast();
    expect(read().entries[hades.id]).toMatchObject({ rating: 3, review: "primeira" });
  });
});
