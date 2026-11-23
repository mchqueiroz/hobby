import { cropSource } from "./image";
import { MEDIAS, MEDIA_LABEL, MEDIA_PLURAL, type Media } from "./types";

export interface ShareData {
  name: string;
  initials: string;
  /** JPEG (data URL) já recortado em quadrado */
  avatar?: string;
  avatarMedia: Media;
  /** JPEG (data URL) já recortado em 3:1; sem ele, vale o degradê */
  bannerImage?: string;
  bannerColors: [string, string];
  title: string;
  vibes: string[];
  counts: Record<Media, number>;
  total: number;
  favorites: { title: string; rating?: number; media: Media }[];
  year: number;
}

const W = 1080;
const H = 1350;
const COLORS = { paper: "#f4f4f1", ink: "#141413", mute: "#5f5f5a", line: "#e0e0db", };
const MEDIA_COLOR: Record<Media, string> = { anime: "#c93d22", manga: "#7a3b9c", jogo: "#2f7d5b", filme: "#2b5c9e", livro: "#9a5a12", musica: "#b02a67" };

function loadDataImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

function stars(r?: number) {
  if (r === undefined) return "";
  const full = Math.floor(r);
  return "★".repeat(full) + (r - full >= 0.5 ? "½" : "");
}

/** Desenha o cartão do perfil em um PNG. Só usa o que a pessoa vê na tela; nada é enviado a servidor. */
export async function buildShareCard(d: ShareData): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('800 80px "Schibsted Grotesk Variable"'), document.fonts.load('italic 800 56px "Schibsted Grotesk Variable"'), document.fonts.load('500 30px "Schibsted Grotesk Variable"')]);
  } catch {
    /* sem fontes carregadas, o navegador usa a reserva */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const serif = '"Schibsted Grotesk Variable", system-ui, sans-serif'; // títulos (o nome ficou de quando era serifada)
  const sans = '"Schibsted Grotesk Variable", system-ui, sans-serif';

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, W, H);

  // banner: foto (cortada para caber) ou degradê do gosto
  const BH = 230;
  const bannerImg = d.bannerImage ? await loadDataImage(d.bannerImage) : null;
  if (bannerImg) {
    const { sx, sy, sw, sh } = cropSource(bannerImg.naturalWidth, bannerImg.naturalHeight, W / BH);
    ctx.drawImage(bannerImg, sx, sy, sw, sh, 0, 0, W, BH);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, BH);
    g.addColorStop(0, d.bannerColors[0]);
    g.addColorStop(1, d.bannerColors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, BH);
  }
  // véu escuro leve, para a marca "hobby" sempre ler bem, seja qual for a foto
  const veil = ctx.createLinearGradient(0, 0, 0, BH);
  veil.addColorStop(0, "rgba(0,0,0,0.38)");
  veil.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, BH);
  // faixa com as cores das mídias na base do banner
  const seg = W / MEDIAS.length;
  MEDIAS.map((m) => MEDIA_COLOR[m]).forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * seg, BH - 16, seg, 16);
  });
  ctx.fillStyle = "#fff";
  ctx.font = `italic 800 56px ${serif}`;
  ctx.fillText("hobby", 80, 100);

  // avatar sobre a borda do banner
  const AR = 88;
  const ax = 80 + AR;
  const ay = BH + 6;
  ctx.fillStyle = COLORS.paper;
  ctx.beginPath();
  ctx.arc(ax, ay, AR + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, AR, 0, Math.PI * 2);
  ctx.clip();
  const photo = d.avatar ? await loadDataImage(d.avatar) : null;
  if (photo) {
    ctx.drawImage(photo, ax - AR, ay - AR, AR * 2, AR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = MEDIA_COLOR[d.avatarMedia];
    ctx.fillRect(ax - AR, ay - AR, AR * 2, AR * 2);
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = `800 72px ${serif}`;
    ctx.textAlign = "center";
    ctx.fillText(d.initials, ax, ay + 25);
    ctx.textAlign = "left";
  }

  const nx = 80 + AR * 2 + 36;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 80px ${serif}`;
  ctx.fillText(fit(ctx, d.name || "Meu perfil", W - nx - 80), nx, 330);
  ctx.fillStyle = COLORS.mute;
  ctx.font = `500 36px ${sans}`;
  ctx.fillText(fit(ctx, d.title, W - nx - 80), nx, 385);

  // contagens por mídia
  // as três mídias em que a pessoa mais concluiu (empate segue a ordem do app)
  const top = MEDIAS.slice().sort((a, b) => d.counts[b] - d.counts[a]).slice(0, 3);
  const cols: [Media, string][] = top.map((m) => [m, MEDIA_COLOR[m]]);
  cols.forEach(([m, color], i) => {
    const x = 80 + i * 310;
    ctx.fillStyle = color;
    ctx.font = `800 110px ${serif}`;
    ctx.fillText(String(d.counts[m]), x, 520);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `500 30px ${sans}`;
    ctx.fillText(MEDIA_PLURAL[m], x, 565);
  });

  ctx.fillStyle = COLORS.line;
  ctx.fillRect(80, 620, W - 160, 3);

  // vibes
  ctx.fillStyle = COLORS.mute;
  ctx.font = `600 28px ${sans}`;
  ctx.fillText("MINHAS VIBES", 80, 690);
  let x = 80;
  let y = 750;
  ctx.font = `600 34px ${sans}`;
  for (const v of d.vibes.slice(0, 6)) {
    const w = ctx.measureText(v).width + 56;
    if (x + w > W - 80) {
      x = 80;
      y += 76;
    }
    if (y > 826) break; // no máximo duas linhas, para os favoritos nunca invadirem o rodapé
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(x, y - 44, w, 62, 31);
    ctx.fill();
    ctx.fillStyle = COLORS.paper;
    ctx.fillText(v, x + 28, y);
    x += w + 16;
  }

  // favoritos
  const fy = y + 100;
  ctx.fillStyle = COLORS.mute;
  ctx.font = `600 28px ${sans}`;
  ctx.fillText("FAVORITOS", 80, fy);
  d.favorites.slice(0, 4).forEach((f, i) => {
    const ry = fy + 66 + i * 76;
    ctx.fillStyle = MEDIA_COLOR[f.media];
    ctx.fillRect(80, ry - 36, 10, 50);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 38px ${serif}`;
    ctx.fillText(fit(ctx, f.title, 640), 110, ry);
    ctx.fillStyle = COLORS.mute;
    ctx.font = `500 26px ${sans}`;
    ctx.fillText(MEDIA_LABEL[f.media], 110, ry + 28);
    ctx.fillStyle = MEDIA_COLOR.anime;
    ctx.font = `500 34px ${sans}`;
    ctx.textAlign = "right";
    ctx.fillText(stars(f.rating), W - 80, ry);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = COLORS.mute;
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(`${d.total} obras registradas · ${d.year}`, 80, H - 48);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
