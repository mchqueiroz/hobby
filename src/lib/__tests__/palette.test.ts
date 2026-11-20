import { describe, expect, it } from "vitest";
import { contrast, dominantFromPixels, hslToRgb, obraTheme, rgbToHsl, vibePalette } from "../palette";

const solid = (r: number, g: number, b: number, n = 100) => Uint8ClampedArray.from(Array.from({ length: n }, () => [r, g, b, 255]).flat());

describe("conversões", () => {
  it("rgb <-> hsl é reversível", () => {
    for (const c of [[200, 40, 30], [10, 120, 200], [90, 200, 50]] as [number, number, number][]) {
      const back = hslToRgb(rgbToHsl(c));
      c.forEach((v, i) => expect(Math.abs(back[i] - v)).toBeLessThanOrEqual(1));
    }
  });
});

describe("dominantFromPixels", () => {
  it("acha o azul de uma imagem azul", () => {
    const c = dominantFromPixels(solid(30, 80, 200))!;
    expect(c.h).toBeGreaterThan(205);
    expect(c.h).toBeLessThan(230);
  });
  it("prefere a cor saturada ao fundo preto", () => {
    const px = Array.from(solid(0, 0, 0, 300));
    const red = Array.from(solid(200, 30, 30, 60));
    const c = dominantFromPixels(Uint8ClampedArray.from([...px, ...red]))!;
    expect(c.h === 0 || c.h > 350 || c.h < 10).toBe(true);
  });
  it("preto e branco dá tom neutro (pouca saturação)", () => {
    const c = dominantFromPixels(Uint8ClampedArray.from([...solid(20, 20, 20, 50), ...solid(230, 230, 230, 50)]))!;
    expect(c.s).toBeLessThan(0.1);
  });
  it("transparente ou vazio dá null", () => {
    expect(dominantFromPixels(Uint8ClampedArray.from([255, 0, 0, 0]))).toBeNull();
    expect(dominantFromPixels([])).toBeNull();
  });
});

describe("vibePalette", () => {
  it("é estável e muda com as vibes", () => {
    expect(vibePalette(["terror", "sombrio"], "filme")).toEqual(vibePalette(["terror", "sombrio"], "filme"));
    expect(vibePalette(["humor leve"], "filme").h).not.toBe(vibePalette(["noir"], "filme").h);
  });
  it("sem vibes conhecidas cai no tom da mídia", () => {
    expect(vibePalette([], "jogo").h).toBe(156);
    expect(vibePalette(["???"], "anime").h).toBe(11);
  });
  it("tons opostos não se anulam (média circular)", () => {
    const c = vibePalette(["terror", "crime"], "filme"); // 355 e 18
    expect(c.h < 30 || c.h > 340).toBe(true);
  });
});

describe("obraTheme: contraste em qualquer tonalidade", () => {
  const parse = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];
  it("texto sobre o acento tem 4,5:1 nos dois temas, para todos os tons e saturações", () => {
    for (let h = 0; h < 360; h += 10) {
      for (const s of [0, 0.3, 0.6, 0.9]) {
        for (const l of [0.2, 0.5, 0.8]) {
          const t = obraTheme({ h, s, l });
          expect(contrast(parse(t.accentLight), parse(t.onLight))).toBeGreaterThanOrEqual(4.5);
          expect(contrast(parse(t.accentDark), parse(t.onDark))).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it("o fundo de destaque não prejudica o texto principal", () => {
    for (let h = 0; h < 360; h += 15) {
      const t = obraTheme({ h, s: 0.9, l: 0.5 });
      expect(contrast(parse(t.washLight), [27, 26, 23])).toBeGreaterThanOrEqual(7);
      expect(contrast(parse(t.washDark), [239, 233, 220])).toBeGreaterThanOrEqual(7);
    }
  });
});
