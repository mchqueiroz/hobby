import type { YearReview } from "./review";
import { MEDIAS, MEDIA_LABEL, MEDIA_PLURAL, type Media } from "./types";

export interface ReviewCardData {
  year: number;
  done: number;
  /** as três mídias com mais obras concluídas no ano (só as que têm alguma) */
  medias: { media: Media; label: string; count: number }[];
  average: number | null;
  busiestMonth: string | null;
  vibes: string[];
  best: { title: string; media: Media; rating: number }[];
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const W = 1080;
const H = 1350;
const C = { paper: "#f4efe6", ink: "#17150f", mute: "#5f5a50", line: "#d8d0c0", accent: "#c93d22" };
const MEDIA_COLOR: Record<Media, string> = { anime: "#c93d22", manga: "#7a3b9c", jogo: "#2f7d5b", filme: "#2b5c9e", livro: "#9a5a12", musica: "#b02a67" };

/** Escolhe o que cabe no cartão. Só usa números da própria retrospectiva. */
export function reviewCardData(r: YearReview): ReviewCardData {
  const medias = MEDIAS.filter((m) => r.byMedia[m] > 0)
    .sort((a, b) => r.byMedia[b] - r.byMedia[a])
    .slice(0, 3)
    .map((m) => ({ media: m, label: MEDIA_PLURAL[m], count: r.byMedia[m] }));
  return {
    year: r.year,
    done: r.done,
    medias,
    average: r.average,
    busiestMonth: r.busiestMonth ? MONTH_NAMES[r.busiestMonth.month] : null,
    vibes: r.topVibes.slice(0, 3),
    best: r.best.slice(0, 3).map((b) => ({ title: b.item.title, media: b.item.media, rating: b.rating })),
  };
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}
const stars = (r: number) => "★".repeat(Math.floor(r)) + (r - Math.floor(r) >= 0.5 ? "½" : "");

/** Desenha a retrospectiva em PNG, no aparelho. Nada é enviado a servidor. */
export async function buildReviewCard(d: ReviewCardData): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load("700 80px Lora"), document.fonts.load("italic 700 56px Lora"), document.fonts.load("500 30px Inter Variable")]);
  } catch { /* usa a fonte reserva */ }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const serif = "Lora, Georgia, serif";
  const sans = '"Inter Variable", Inter, system-ui, sans-serif';

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  const seg = W / MEDIAS.length;
  MEDIAS.forEach((m, i) => { ctx.fillStyle = MEDIA_COLOR[m]; ctx.fillRect(i * seg, 0, seg, 18); });

  ctx.fillStyle = C.ink;
  ctx.font = `italic 700 56px ${serif}`;
  ctx.fillText("hobby", 80, 120);
  ctx.fillStyle = C.mute;
  ctx.font = `600 28px ${sans}`;
  ctx.fillText(`MEU ${d.year}`, 80, 190);

  ctx.fillStyle = C.ink;
  ctx.font = `700 260px ${serif}`;
  ctx.fillText(String(d.done), 70, 440);
  ctx.font = `700 52px ${serif}`;
  ctx.fillText(d.done === 1 ? "obra concluída" : "obras concluídas", 80, 510);

  let y = 600;
  d.medias.forEach((m, i) => {
    const x = 80 + i * 310;
    ctx.fillStyle = MEDIA_COLOR[m.media];
    ctx.font = `700 90px ${serif}`;
    ctx.fillText(String(m.count), x, y + 40);
    ctx.fillStyle = C.ink;
    ctx.font = `500 30px ${sans}`;
    ctx.fillText(fit(ctx, m.label, 280), x, y + 90);
  });
  y += 180;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(W - 80, y); ctx.stroke();

  y += 70;
  ctx.fillStyle = C.ink;
  ctx.font = `500 34px ${sans}`;
  const lines: string[] = [];
  if (d.average !== null) lines.push(`Nota média ${d.average.toFixed(1).replace(".", ",")}★`);
  if (d.busiestMonth) lines.push(`Mês mais cheio: ${d.busiestMonth}`);
  if (d.vibes.length) lines.push(`Cara do ano: ${d.vibes.join(", ")}`);
  lines.forEach((t) => { ctx.fillText(fit(ctx, t, W - 160), 80, y); y += 54; });

  if (d.best.length) {
    y += 40;
    ctx.fillStyle = C.mute;
    ctx.font = `600 28px ${sans}`;
    ctx.fillText("MELHORES DO ANO", 80, y);
    d.best.forEach((b, i) => {
      const ry = y + 66 + i * 76;
      ctx.fillStyle = MEDIA_COLOR[b.media];
      ctx.fillRect(80, ry - 36, 10, 50);
      ctx.fillStyle = C.ink;
      ctx.font = `700 38px ${serif}`;
      ctx.fillText(fit(ctx, b.title, 640), 110, ry);
      ctx.fillStyle = C.mute;
      ctx.font = `500 26px ${sans}`;
      ctx.fillText(MEDIA_LABEL[b.media], 110, ry + 28);
      ctx.fillStyle = C.accent;
      ctx.font = `500 34px ${sans}`;
      ctx.textAlign = "right";
      ctx.fillText(stars(b.rating), W - 80, ry);
      ctx.textAlign = "left";
    });
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
