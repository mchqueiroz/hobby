import { describe, expect, it } from "vitest";
import { SEED_BY_ID } from "../catalog";
import { recommend, tasteProfile } from "../recommend";
import type { Item } from "../types";
import { EMPTY_LIBRARY, type Library, type Status } from "../types";

const id = (media: string, slug: string) => `seed:${media}:${slug}`;

function lib(entries: [string, Status, number?][], dismissed: string[] = []): Library {
  return {
    ...EMPTY_LIBRARY,
    entries: Object.fromEntries(
      entries.map(([itemId, status, rating]) => [itemId, { itemId, status, rating, at: 0 }]),
    ),
    dismissed,
  };
}

describe("recomendação", () => {
  const fan = lib([
    [id("anime", "death-note"), "concluido", 5],
    [id("anime", "monster"), "concluido", 5],
    [id("anime", "cowboy-bebop"), "concluido", 4.5],
    [id("filme", "cidade-de-deus"), "concluido", 5],
  ]);

  it("não sugere o que já está na biblioteca nem o que foi dispensado", () => {
    const withDismiss = { ...fan, dismissed: [id("jogo", "disco-elysium")] };
    const ids = recommend(withDismiss, { count: 50, perMedia: 50 }).map((r) => r.item.id);
    for (const owned of Object.keys(fan.entries)) expect(ids).not.toContain(owned);
    expect(ids).not.toContain(id("jogo", "disco-elysium"));
    // sem a dispensa, Disco Elysium aparece: o teste prova que a exclusão é o que o tira
    const without = recommend(fan, { count: 50, perMedia: 50 }).map((r) => r.item.id);
    expect(without).toContain(id("jogo", "disco-elysium"));
  });

  it("limita a 2 sugestões por mídia entre 5 e traz mais de uma mídia", () => {
    const recs = recommend(fan);
    expect(recs.length).toBe(5);
    const per: Record<string, number> = {};
    for (const r of recs) per[r.item.media] = (per[r.item.media] ?? 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(2);
    expect(Object.keys(per).length).toBeGreaterThan(1);
  });

  it("sempre explica o motivo citando um item que o usuário avaliou e vibes em comum", () => {
    for (const r of recommend(fan)) {
      expect(r.anchor).toBeDefined();
      expect(r.reason).toContain(r.anchor!.item.title);
      expect(r.shared.length).toBeGreaterThan(0);
      for (const v of r.shared) {
        expect(r.item.vibes).toContain(v);
        expect(r.anchor!.item.vibes).toContain(v);
      }
    }
  });

  it("o motivo usa a nota real do usuário", () => {
    const only = lib([[id("anime", "death-note"), "concluido", 4.5]]);
    const r = recommend(only)[0];
    expect(r.reason).toMatch(/deu 4,5★ a Death Note/);
  });

  it("'não é pra mim' reordena na hora e tira o item da lista", () => {
    const before = recommend(fan, { count: 8, perMedia: 8 });
    const top = before[0].item;
    const after = recommend({ ...fan, dismissed: [top.id] }, { count: 8, perMedia: 8 });
    expect(after.map((r) => r.item.id)).not.toContain(top.id);
    // dispensar reduz em exatamente 1 o peso de cada vibe do item
    const t0 = tasteProfile(fan);
    const t1 = tasteProfile({ ...fan, dismissed: [top.id] });
    for (const v of top.vibes) expect(t1[v]).toBe((t0[v] ?? 0) - 1);
  });

  it("nota baixa pesa contra: o mesmo item sobe ou cai conforme a nota dada a um parecido", () => {
    const base: [string, Status, number?][] = [[id("anime", "cowboy-bebop"), "concluido", 5]];
    const fanOfDS = lib([...base, [id("jogo", "dark-souls"), "concluido", 5]]);
    const hateDS = lib([...base, [id("jogo", "dark-souls"), "concluido", 1]]);
    const target = id("jogo", "the-last-of-us");
    const pick = (l: Library) =>
      recommend(l, { count: 50, perMedia: 50 }).find((r) => r.item.id === target)?.score ?? 0;
    expect(tasteProfile(hateDS)["sobrevivência"]).toBeLessThan(0);
    expect(tasteProfile(fanOfDS)["sobrevivência"]).toBeGreaterThan(0);
    expect(pick(fanOfDS)).toBeGreaterThan(pick(hateDS));
  });

  it("filtro de mídia devolve só aquela mídia, sem o limite de 2", () => {
    const recs = recommend(fan, { media: "jogo", count: 4 });
    expect(recs.length).toBe(4);
    expect(recs.every((r) => r.item.media === "jogo")).toBe(true);
  });

  it("biblioteca vazia não gera sugestões (o onboarding pede favoritos)", () => {
    expect(recommend(EMPTY_LIBRARY)).toEqual([]);
  });

  it("é determinístico", () => {
    expect(recommend(fan).map((r) => r.item.id)).toEqual(recommend(fan).map((r) => r.item.id));
  });

  it("não sugere de novo um título que veio importado com outro id", () => {
    const imported = {
      ...EMPTY_LIBRARY,
      items: {
        "anilist:1": { id: "anilist:1", title: "Death Note", media: "anime" as const, vibes: SEED_BY_ID[id("anime", "death-note")].vibes, source: "anilist" as const },
      },
      entries: { "anilist:1": { itemId: "anilist:1", status: "concluido" as const, rating: 5, at: 0 } },
    };
    const ids = recommend(imported, { count: 50, perMedia: 50 }).map((r) => r.item.id);
    expect(ids).not.toContain(id("anime", "death-note"));
  });
});

import { interactions, qualityPrior } from "../recommend";
import { publicScore } from "../remote";
import { EMPTY_LIBRARY as EMPTY2 } from "../types";

describe("v2 no app", () => {
  const mk = (id: string, media: "anime" | "jogo" | "filme", q?: number) => ({ id, title: id, media, vibes: ["sombrio"], source: "seed" as const, quality: q });

  it("nota pública vira prior padronizado por mídia e só vale com amostra suficiente", () => {
    const filmes = Array.from({ length: 10 }, (_, i) => mk(`f${i}`, "filme", 5 + i * 0.3));
    const jogos = [mk("g1", "jogo", 9), mk("g2", "jogo", 3)];
    const z = qualityPrior([...filmes, ...jogos]);
    expect(z[9]).toBeGreaterThan(z[0]);
    expect(z.slice(0, 10).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 6);
    expect(z[10]).toBe(0); // só 2 jogos com nota: neutro
    expect(qualityPrior([mk("x", "anime")])).toEqual([0]);
  });

  it("publicScore ignora nota inválida ou com poucos votos", () => {
    expect(publicScore(8.26, 100, 50)).toBe(8.3);
    expect(publicScore(8, 10, 50)).toBeUndefined();
    expect(publicScore(0, 1000, 50)).toBeUndefined();
    expect(publicScore(11, 1000, 50)).toBeUndefined();
    expect(publicScore(undefined, 1000, 50)).toBeUndefined();
    expect(publicScore(7, undefined, 0)).toBe(7);
  });

  it("entrada importada, sem data, não some pelo decaimento", () => {
    const lib = { ...EMPTY2, entries: { "seed:jogo:hades": { itemId: "seed:jogo:hades", status: "concluido" as const, rating: 5, at: 0 } } };
    const now = Date.UTC(2026, 10, 1);
    const [h] = interactions(lib, now);
    expect(now / 86_400_000 - h.day).toBeCloseTo(365, 3);
  });

  it("a nota pública puxa para cima, a igualdade de gosto, e nunca sobrepõe quem não combina", () => {
    const base = { ...EMPTY2, entries: { "seed:anime:death-note": { itemId: "seed:anime:death-note", status: "concluido" as const, rating: 5, at: Date.now() } } };
    const pool = [
      { id: "a", title: "A", media: "filme" as const, vibes: ["psicológico", "mistério"], source: "tmdb" as const, quality: 6 },
      { id: "b", title: "B", media: "filme" as const, vibes: ["psicológico", "mistério"], source: "tmdb" as const, quality: 9 },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, title: `N${i}`, media: "filme" as const, vibes: ["humor leve"], source: "tmdb" as const, quality: 5 + i * 0.4 })),
    ];
    const r = recommend(base, { pool, count: 5, perMedia: 5 });
    const ids = r.map((x) => x.item.id);
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("a"));
    expect(ids).not.toContain("n7"); // humor leve não combina com o que ele gosta
  });
});

describe("recomendação: franquia, autor, explicação e aposta", () => {
  const vibes = ["psicológico", "investigação", "sombrio", "mistério", "narrativa densa"];
  const mk = (title: string, media: Item["media"], over: Partial<Item> = {}): Item => ({ id: `t:${media}:${title}`, title, media, vibes, source: "anilist", ...over });
  const base = lib([[id("anime", "death-note"), "concluido", 5], [id("anime", "monster"), "concluido", 5]]);

  it("não oferece continuação de algo que a pessoa já viu", () => {
    const pool = [mk("Death Note: Relight", "anime"), mk("Monster Second Season", "anime"), mk("Outro Anime", "anime", { vibes: ["psicológico", "sombrio", "mistério"] })];
    const titles = recommend(base, { pool, count: 10, perMedia: 10 }).map((r) => r.item.title);
    expect(titles).toContain("Outro Anime");
    expect(titles).not.toContain("Death Note: Relight");
    expect(titles).not.toContain("Monster Second Season");
  });

  it("na lista de quero ver, a continuação continua aparecendo (foi a pessoa que pôs lá)", () => {
    const sequel = mk("Death Note: Relight", "anime");
    const withWant: Library = { ...base, items: { [sequel.id]: sequel }, entries: { ...base.entries, [sequel.id]: { itemId: sequel.id, status: "quero", at: 0 } } };
    expect(recommend(withWant, { fromWatchlist: true }).map((r) => r.item.id)).toContain(sequel.id);
  });

  it("outro álbum do mesmo artista sobe, e o motivo diz isso", () => {
    const mine = lib([[id("musica", "ok-computer"), "concluido", 5], [id("anime", "death-note"), "concluido", 4]]);
    const kidA = mk("Kid A", "musica", { vibes: ["dançante"], author: "Radiohead" });
    const outro = mk("Outro Álbum", "musica", { vibes: ["dançante"], author: "Fulano" });
    const r = recommend(mine, { pool: [kidA, outro], count: 5, perMedia: 5 });
    expect(r[0].item.title).toBe("Kid A");
    expect(r[0].reason).toBe("Porque você deu 5★ a OK Computer (álbum), do mesmo artista.");
    expect(r.map((x) => x.item.title)).not.toContain("Outro Álbum");
  });

  it("nota baixa para um autor pesa contra os outros livros dele", () => {
    const mine = lib([[id("livro", "1984"), "concluido", 1], [id("livro", "o-hobbit"), "concluido", 5]]);
    const r = recommend(mine, { pool: SEED_BOOKS_BY_ORWELL_AND_OTHERS(), count: 5, perMedia: 5 }).map((x) => x.item.title);
    expect(r[0]).toBe("Livro de Tolkien");
    // o de Orwell pode até aparecer, mas nunca antes
    expect(r.indexOf("Livro de Orwell") === -1 || r.indexOf("Livro de Orwell") > 0).toBe(true);
  });

  it("cita duas obras quando as duas pesaram quase igual, sem repetir o verbo", () => {
    const withMany = recommend(base, { pool: [mk("Parecido", "anime")], count: 3 });
    expect(withMany[0].also).toBeDefined();
    expect(withMany[0].reason).toMatch(/^Porque você deu 5★ a .* \(anime\) e 5★ a .* \(anime\): este também é /);
  });

  it("com a aposta ligada, a última sugestão foge das vibes de sempre; desligada, ninguém é aposta", () => {
    const fan = lib([
      [id("anime", "death-note"), "concluido", 5], [id("anime", "monster"), "concluido", 5], [id("anime", "cowboy-bebop"), "concluido", 4.5],
      [id("filme", "cidade-de-deus"), "concluido", 5], [id("livro", "1984"), "concluido", 5], [id("musica", "ok-computer"), "concluido", 5],
    ]);
    const plain = recommend(fan, { count: 5 });
    const withBet = recommend(fan, { count: 5, bet: true });
    expect(plain.some((r) => r.bet)).toBe(false);
    expect(withBet).toHaveLength(plain.length);
    expect(withBet.filter((r) => r.bet)).toHaveLength(1);
    expect(withBet[withBet.length - 1].bet).toBe(true);
    expect(withBet.slice(0, -1).map((r) => r.item.id)).toEqual(plain.slice(0, -1).map((r) => r.item.id));
  });

  it("nunca repete a mesma obra por causa da aposta", () => {
    const fan = lib([[id("anime", "death-note"), "concluido", 5], [id("anime", "monster"), "concluido", 5], [id("filme", "cidade-de-deus"), "concluido", 5], [id("livro", "1984"), "concluido", 5]]);
    const ids = recommend(fan, { count: 5, bet: true }).map((r) => r.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

function SEED_BOOKS_BY_ORWELL_AND_OTHERS(): Item[] {
  const v = ["fantasia", "aventura", "jornada épica"];
  return [
    { id: "t:livro:a", title: "Livro de Orwell", media: "livro", vibes: v, author: "George Orwell", source: "openlibrary" },
    { id: "t:livro:b", title: "Livro de Tolkien", media: "livro", vibes: v, author: "J. R. R. Tolkien", source: "openlibrary" },
  ];
}
