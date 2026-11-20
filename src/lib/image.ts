/**
 * Foto de perfil e banner: validação do arquivo, enquadramento (zoom e posição) e reexportação.
 * A conta de enquadramento é pura e testada; a parte que usa canvas só roda no navegador.
 * Toda imagem é redesenhada num canvas e salva como JPEG novo: isso tira EXIF (local do GPS, modelo da câmera),
 * corrige a rotação e impede que um arquivo estranho (SVG com script, por exemplo) chegue ao app.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Teto do texto guardado no aparelho (data URL). Passou disso, a qualidade cai até caber. */
export const MAX_STORED_CHARS = 260_000;

export function checkFile(f: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) return "Use uma imagem JPG, PNG ou WebP.";
  if (f.size > MAX_FILE_BYTES) return "A imagem é grande demais (máximo 10 MB).";
  if (f.size === 0) return "O arquivo está vazio.";
  return null;
}

/** O que a gente aceita ler de volta do armazenamento: só o JPEG que nós mesmos geramos. */
export function isStoredImage(s: unknown): s is string {
  return typeof s === "string" && s.length <= MAX_STORED_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
}

export interface Crop {
  /** 1 = a maior área possível na proporção pedida; maior que 1 aproxima */
  zoom: number;
  /** posição, de -1 (esquerda/topo) a 1 (direita/base); 0 = centro */
  x: number;
  y: number;
}
export const CENTER: Crop = { zoom: 1, x: 0, y: 0 };
export const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Retângulo da imagem original que entra no quadro. Nunca sai da imagem. */
export function cropSource(w: number, h: number, aspect: number, c: Crop = CENTER) {
  const baseW = w / h > aspect ? h * aspect : w;
  const baseH = baseW / aspect;
  const zoom = clamp(Number.isFinite(c.zoom) ? c.zoom : 1, 1, MAX_ZOOM);
  const sw = baseW / zoom;
  const sh = baseH / zoom;
  const maxX = (w - sw) / 2;
  const maxY = (h - sh) / 2;
  const cx = w / 2 + clamp(Number.isFinite(c.x) ? c.x : 0, -1, 1) * maxX;
  const cy = h / 2 + clamp(Number.isFinite(c.y) ? c.y : 0, -1, 1) * maxY;
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, maxX, maxY };
}

/** Arrastar `dx`,`dy` pixels de tela (num quadro de `viewW` pixels) vira novo `x`,`y`. */
export function panBy(w: number, h: number, aspect: number, c: Crop, viewW: number, dx: number, dy: number): Crop {
  const { sw, maxX, maxY } = cropSource(w, h, aspect, c);
  const scale = sw / viewW; // pixels da imagem por pixel de tela
  const nx = maxX > 0 ? c.x - (dx * scale) / maxX : 0;
  const ny = maxY > 0 ? c.y - (dy * scale) / maxY : 0;
  return { zoom: c.zoom, x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
}

/* ------------------------- só no navegador ------------------------- */

export interface Loaded {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export async function loadImage(file: Blob): Promise<Loaded> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" aplica a rotação do EXIF (foto de celular em pé)
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, dispose: () => bmp.close() };
    } catch {
      /* cai para o <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("imagem inválida"));
      i.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function drawCrop(canvas: HTMLCanvasElement, img: Loaded, crop: Crop) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { sx, sy, sw, sh } = cropSource(img.width, img.height, canvas.width / canvas.height, crop);
  ctx.fillStyle = "#fff"; // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

/** Recorta, reduz e devolve um JPEG novo (data URL) que cabe no limite guardado. */
export function exportJpeg(img: Loaded, outW: number, outH: number, crop: Crop): string {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  drawCrop(canvas, img, crop);
  for (const q of [0.86, 0.78, 0.7, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (isStoredImage(url)) return url;
  }
  throw new Error("imagem pesada demais");
}

/** Miniatura quadrada (96px) de um avatar já guardado, para listas e feed. Só no navegador. */
export async function makeThumb(dataUrl: string, size = 96): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("imagem inválida"));
      i.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    for (const q of [0.8, 0.65, 0.5, 0.35]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= 19_000) return url;
    }
  } catch {
    /* sem miniatura: a lista usa as iniciais */
  }
  return null;
}
