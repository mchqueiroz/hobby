/**
 * Cor de destaque de cada obra. Vem da tonalidade dominante da capa; se a capa não puder ser lida
 * (sem capa, sem permissão de leitura da imagem), vem das vibes do próprio título.
 * Tudo aqui é puro e testável.
 */
export interface Hsl { h: number; s: number; l: number } // h 0–360, s e l 0–1
type Rgb = [number, number, number];

export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const BINS = 24;

/** Cor dominante dos pixels RGBA: dá mais peso ao que é saturado e de brilho médio, e ignora quase preto, quase branco e transparente. */
export function dominantFromPixels(data: ArrayLike<number>): Hsl | null {
  const acc = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  const mean = { r: 0, g: 0, b: 0, n: 0 };
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
    mean.r += rgb[0]; mean.g += rgb[1]; mean.b += rgb[2]; mean.n++;
    const { h, s, l } = rgbToHsl(rgb);
    if (s < 0.15 || l < 0.1 || l > 0.9) continue;
    const w = s * (1 - Math.abs(2 * l - 1));
    const bin = acc[Math.floor(h / (360 / BINS)) % BINS];
    bin.w += w; bin.r += rgb[0] * w; bin.g += rgb[1] * w; bin.b += rgb[2] * w;
    total += w;
  }
  if (mean.n === 0) return null;
  const best = acc.reduce((a, b) => (b.w > a.w ? b : a));
  // imagem quase sem cor (preto e branco): usa a média, que dá um tom neutro
  if (total < mean.n * 0.02 || best.w === 0) {
    return rgbToHsl([mean.r / mean.n, mean.g / mean.n, mean.b / mean.n]);
  }
  return rgbToHsl([best.r / best.w, best.g / best.w, best.b / best.w]);
}

const VIBE_HUE: Record<string, number> = {
  sombrio: 235, noir: 215, terror: 355, mistério: 265, psicológico: 285, investigação: 200,
  crime: 18, urbano: 205, político: 30, guerra: 12, sobrevivência: 95, sobrenatural: 275,
  "ação intensa": 5, competição: 40, "humor leve": 48, romance: 335, "slice of life": 145,
  "drama humano": 22, melancólico: 220, "coming of age": 160, filosófico: 250, "narrativa densa": 230,
  exploração: 170, estratégia: 190, família: 38, fantasia: 285, "jornada épica": 32, aventura: 28,
  "ficção científica": 192, futurista: 188, energético: 8, dançante: 320, introspectivo: 225,
};
export const MEDIA_HUE = { anime: 11, manga: 285, jogo: 156, filme: 214, livro: 32, musica: 335 } as const;

/** Tom do título a partir das vibes (média circular dos tons). Estável: o mesmo título sempre dá a mesma cor. */
export function vibePalette(vibes: string[], media: keyof typeof MEDIA_HUE): Hsl {
  const hues = vibes.map((v) => VIBE_HUE[v]).filter((h): h is number => h !== undefined).slice(0, 4);
  if (hues.length === 0) return { h: MEDIA_HUE[media], s: 0.5, l: 0.45 };
  let x = 0, y = 0;
  for (const h of hues) {
    x += Math.cos((h * Math.PI) / 180);
    y += Math.sin((h * Math.PI) / 180);
  }
  return { h: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, s: 0.5, l: 0.45 };
}

const PAPER_LIGHT: Rgb = [244, 244, 241];
const PAPER_DARK: Rgb = [17, 17, 16];
const WHITE: Rgb = [255, 255, 255];

const css = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export interface ObraTheme {
  /** fundo suave da área de destaque, para o tema claro e para o escuro */
  washLight: string; washDark: string;
  /** cor de botões e realces + cor do texto sobre ela (contraste mínimo 4,5:1) */
  accentLight: string; onLight: string;
  accentDark: string; onDark: string;
}

export function obraTheme(color: Hsl): ObraTheme {
  const s = Math.min(0.75, Math.max(0.3, color.s));
  const h = color.h;

  // claro: acento escuro o bastante para texto branco, e ainda visível no papel
  let l = 0.46;
  let accL = hslToRgb({ h, s, l });
  while (l > 0.12 && (contrast(accL, WHITE) < 4.5 || contrast(accL, PAPER_LIGHT) < 3)) {
    l -= 0.02;
    accL = hslToRgb({ h, s, l });
  }
  // escuro: acento claro o bastante para texto escuro
  l = 0.62;
  let accD = hslToRgb({ h, s, l });
  while (l < 0.9 && (contrast(accD, PAPER_DARK) < 4.5 || contrast(accD, [236, 236, 232]) < 3)) {
    l += 0.02;
    accD = hslToRgb({ h, s, l });
  }
  // texto no botão escuro precisa de contraste com o acento claro
  const onD = contrast(accD, PAPER_DARK) >= contrast(accD, WHITE) ? PAPER_DARK : WHITE;
  return {
    washLight: css(hslToRgb({ h, s: Math.min(0.6, s), l: 0.84 })),
    washDark: css(hslToRgb({ h, s: Math.min(0.5, s), l: 0.17 })),
    accentLight: css(accL), onLight: css(WHITE),
    accentDark: css(accD), onDark: css(onD),
  };
}

/**
 * Degradê do banner (só decoração: nenhum texto fica sobre ele). Cores em sintaxe com vírgula, que o canvas também lê.
 * Dois tons da mesma cor, escuros e pouco saturados: o salto de matiz saturado (roxo para magenta) tinha cara de interface gerada.
 */
export function bannerColors(c: Hsl): [string, string] {
  const h = Math.round(c.h);
  return [`hsl(${h}, 30%, 20%)`, `hsl(${h}, 34%, 36%)`];
}
export const bannerGradient = (c: Hsl) => {
  const [a, b] = bannerColors(c);
  return `linear-gradient(120deg, ${a}, ${b})`;
};
