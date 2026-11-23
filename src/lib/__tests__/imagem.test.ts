import { describe, expect, it } from "vitest";
import { checkFile, cropSource, isStoredImage, panBy, MAX_STORED_CHARS } from "../image";
import { mergeProfile, parseProfile, EMPTY_PROFILE } from "../profile";
import { bannerColors } from "../palette";

describe("enquadramento", () => {
  it("sem zoom pega a maior área na proporção, centralizada", () => {
    const r = cropSource(4000, 3000, 1);
    expect(r.sw).toBe(3000);
    expect(r.sh).toBe(3000);
    expect(r.sx).toBe(500);
    expect(r.sy).toBe(0);
    const b = cropSource(1000, 1000, 3);
    expect(b.sw).toBe(1000);
    expect(b.sh).toBeCloseTo(333.33, 1);
  });
  it("zoom aproxima e nunca sai da imagem, em qualquer posição", () => {
    for (const [w, h, a] of [[4000, 3000, 1], [800, 2000, 1], [1200, 1200, 3], [5000, 500, 3]] as const) {
      for (const zoom of [1, 1.5, 4, 99, NaN]) {
        for (const x of [-5, -1, 0, 1, 5]) {
          for (const y of [-1, 0, 1]) {
            const r = cropSource(w, h, a, { zoom, x, y });
            expect(r.sx).toBeGreaterThanOrEqual(-1e-6);
            expect(r.sy).toBeGreaterThanOrEqual(-1e-6);
            expect(r.sx + r.sw).toBeLessThanOrEqual(w + 1e-6);
            expect(r.sy + r.sh).toBeLessThanOrEqual(h + 1e-6);
            expect(r.sw / r.sh).toBeCloseTo(a, 5);
          }
        }
      }
    }
  });
  it("posição -1 e 1 encostam nas bordas", () => {
    expect(cropSource(4000, 3000, 1, { zoom: 1, x: -1, y: 0 }).sx).toBe(0);
    const r = cropSource(4000, 3000, 1, { zoom: 1, x: 1, y: 0 });
    expect(r.sx + r.sw).toBe(4000);
  });
  it("arrastar para a direita mostra o que está à esquerda, e sem folga não anda", () => {
    const c = panBy(4000, 3000, 1, { zoom: 1, x: 0, y: 0 }, 300, 30, 0);
    expect(c.x).toBeLessThan(0);
    expect(c.y).toBe(0);
    expect(panBy(3000, 3000, 1, { zoom: 1, x: 0, y: 0 }, 300, 50, 50)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(panBy(4000, 3000, 1, { zoom: 1, x: 0, y: 0 }, 300, 99999, 0).x).toBe(-1);
  });
});

describe("arquivo e imagem guardada", () => {
  it("só JPG, PNG e WebP, até 10 MB", () => {
    expect(checkFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(checkFile({ type: "image/svg+xml", size: 1000 })).toMatch(/JPG, PNG ou WebP/);
    expect(checkFile({ type: "image/gif", size: 1000 })).not.toBeNull();
    expect(checkFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/grande/);
    expect(checkFile({ type: "image/jpeg", size: 0 })).not.toBeNull();
  });
  it("só aceita de volta o JPEG gerado aqui", () => {
    expect(isStoredImage("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isStoredImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isStoredImage("javascript:alert(1)")).toBe(false);
    expect(isStoredImage("https://x.com/a.jpg")).toBe(false);
    expect(isStoredImage('data:image/jpeg;base64,AAA" onerror="x')).toBe(false);
    expect(isStoredImage("data:image/jpeg;base64," + "A".repeat(MAX_STORED_CHARS))).toBe(false);
    expect(isStoredImage(42)).toBe(false);
  });
});

describe("perfil", () => {
  const img = "data:image/jpeg;base64,/9j/4AAQ";
  it("lê o formato antigo (só nome) e descarta o que é inválido", () => {
    expect(parseProfile({ name: "Ana" })).toEqual({ name: "Ana" });
    expect(parseProfile(null)).toBe(EMPTY_PROFILE);
    const p = parseProfile({ name: "A".repeat(99), avatar: "http://x/y.png", color: "podcast", banner: { kind: "image", data: "<svg>" } });
    expect(p).toEqual({ name: "A".repeat(40) });
    expect(parseProfile({ name: "", avatar: img, color: "livro", banner: { kind: "media", media: "manga" } })).toEqual({
      name: "",
      avatar: img,
      color: "livro",
      banner: { kind: "media", media: "manga" },
    });
  });
  it("mesclar: undefined mantém, null apaga, vazio remove tudo", () => {
    const a = mergeProfile(EMPTY_PROFILE, { name: "  Ana   Maria ", avatar: img });
    expect(a).toEqual({ name: "Ana Maria", avatar: img });
    const b = mergeProfile(a!, { banner: { kind: "media", media: "jogo" } });
    expect(b).toMatchObject({ name: "Ana Maria", avatar: img, banner: { kind: "media", media: "jogo" } });
    expect(mergeProfile(b!, { avatar: null })?.avatar).toBeUndefined();
    expect(mergeProfile(b!, { banner: { kind: "auto" } })?.banner).toBeUndefined();
    expect(mergeProfile({ name: "x" }, { name: "" })).toBeNull();
  });
});

describe("banner automático", () => {
  it("duas cores no mesmo formato que o canvas entende", () => {
    const [a, b] = bannerColors({ h: 200.4, s: 0.5, l: 0.4 });
    expect(a).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    // dois tons da mesma cor, sem salto de matiz
    expect([a, b]).toEqual(["hsl(200, 30%, 20%)", "hsl(200, 34%, 36%)"]);
    expect(bannerColors({ h: 350, s: 1, l: 1 })[1]).toBe("hsl(350, 34%, 36%)");
  });
});
