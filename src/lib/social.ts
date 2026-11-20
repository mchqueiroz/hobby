import { dna, persona } from "./insights";
import { getItem } from "./recommend";
import { effectiveDate } from "./stats";
import { MEDIAS, perMedia, type Library, type Media, type Status } from "./types";

/** Lógica pura da parte social: nada aqui fala com a rede, para dar para testar tudo. */

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
/** Nomes que o banco recusa (espelha a constraint profiles_handle_check1). */
export const RESERVED = ["admin", "hobby", "suporte", "api", "perfil", "entrar", "conta", "comunidade", "u", "root", "support"];
export const MAX_ACTIVITY = 200;
export const MAX_BIO = 160;

export const normalizeHandle = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

export function handleError(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (!HANDLE_RE.test(h)) return "Use de 3 a 20 caracteres: letras minúsculas, números e _ (sem espaço nem acento).";
  if (RESERVED.includes(h)) return "Esse nome é reservado. Escolha outro.";
  return null;
}

/* ------------------------------ resumo público ------------------------------ */

export interface PublicStats {
  total: number;
  perMedia: Record<Media, number>;
  topVibes: string[];
  persona?: string;
}

/** O que o perfil público mostra: só números e vibes, nunca títulos nem notas. */
export function buildStats(lib: Library): PublicStats {
  const counts = perMedia(() => 0);
  let total = 0;
  for (const e of Object.values(lib.entries)) {
    const it = getItem(lib, e.itemId);
    if (!it) continue;
    counts[it.media]++;
    total++;
  }
  const p = persona(lib);
  return { total, perMedia: counts, topVibes: dna(lib, 8).map((d) => d.vibe), ...(p ? { persona: p.title } : {}) };
}

/** Lê o resumo vindo do banco sem confiar no formato. */
export function parseStats(raw: unknown): PublicStats {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pm = (r.perMedia && typeof r.perMedia === "object" ? r.perMedia : {}) as Record<string, unknown>;
  const counts = perMedia((m) => (typeof pm[m] === "number" && Number.isFinite(pm[m]) ? Math.max(0, Math.floor(pm[m] as number)) : 0));
  return {
    total: typeof r.total === "number" && Number.isFinite(r.total) ? Math.max(0, Math.floor(r.total)) : MEDIAS.reduce((a, m) => a + counts[m], 0),
    perMedia: counts,
    topVibes: Array.isArray(r.topVibes) ? r.topVibes.filter((v): v is string => typeof v === "string").slice(0, 8) : [],
    ...(typeof r.persona === "string" ? { persona: r.persona.slice(0, 60) } : {}),
  };
}

/* ------------------------------ atividade ------------------------------ */

export interface ActivityItem {
  id: string;
  title: string;
  media: Media;
  year?: number;
  author?: string;
  cover?: string;
}
export interface ActivityRow {
  item_id: string;
  item: ActivityItem;
  status: Status;
  rating: number | null;
  review: string | null;
}

const STATUSES: Status[] = ["quero", "andamento", "concluido", "abandonei"];
const isMedia = (m: unknown): m is Media => typeof m === "string" && (MEDIAS as string[]).includes(m);

/** O que seria publicado hoje: os registros mais recentes (até 200), com resenha só se a pessoa liberou. */
export function desiredActivity(lib: Library, shareReviews: boolean): ActivityRow[] {
  const rows: { at: number; row: ActivityRow }[] = [];
  for (const e of Object.values(lib.entries)) {
    const it = getItem(lib, e.itemId);
    if (!it || e.itemId.length > 120 || !STATUSES.includes(e.status)) continue;
    const item: ActivityItem = { id: it.id, title: it.title.slice(0, 120), media: it.media };
    if (it.year) item.year = it.year;
    if (it.author) item.author = it.author.slice(0, 80);
    if (it.cover && /^https:\/\//.test(it.cover) && it.cover.length <= 300) item.cover = it.cover;
    const rating = e.rating !== undefined && e.rating >= 0.5 && e.rating <= 5 ? e.rating : null;
    const review = shareReviews && e.review ? e.review.slice(0, 2000) : null;
    rows.push({ at: effectiveDate(e), row: { item_id: e.itemId, item, status: e.status, rating, review } });
  }
  return rows.sort((a, b) => b.at - a.at || a.row.item_id.localeCompare(b.row.item_id)).slice(0, MAX_ACTIVITY).map((r) => r.row);
}

/** Compara o que deveria estar publicado com o que está: só envia o que mudou, remove o que sumiu. */
export function diffActivity(desired: ActivityRow[], existing: Pick<ActivityRow, "item_id" | "status" | "rating" | "review" | "item">[]) {
  const have = new Map(existing.map((r) => [r.item_id, r]));
  const want = new Set(desired.map((r) => r.item_id));
  const upsert = desired.filter((d) => {
    const h = have.get(d.item_id);
    return !h || h.status !== d.status || (h.rating === null ? null : Number(h.rating)) !== d.rating || (h.review ?? null) !== d.review || h.item?.title !== d.item.title;
  });
  const remove = existing.filter((r) => !want.has(r.item_id)).map((r) => r.item_id);
  return { upsert, remove };
}

/** Lê uma linha de atividade do banco; o que não bate vira `null`. */
export function parseActivity(raw: unknown): ActivityRow | null {
  const r = raw as Record<string, unknown> | null;
  const it = r?.item as Record<string, unknown> | undefined;
  if (!r || !it || typeof r.item_id !== "string" || typeof it.title !== "string" || !isMedia(it.media) || !STATUSES.includes(r.status as Status)) return null;
  const rating = r.rating === null || r.rating === undefined ? null : Number(r.rating);
  return {
    item_id: r.item_id,
    item: {
      id: typeof it.id === "string" ? it.id : r.item_id,
      title: it.title.slice(0, 120),
      media: it.media,
      ...(typeof it.year === "number" ? { year: it.year } : {}),
      ...(typeof it.author === "string" ? { author: it.author.slice(0, 80) } : {}),
      ...(typeof it.cover === "string" && /^https:\/\//.test(it.cover) ? { cover: it.cover } : {}),
    },
    status: r.status as Status,
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    review: typeof r.review === "string" ? r.review : null,
  };
}

/* ------------------------------ afinidade de gosto ------------------------------ */

export interface Affinity {
  /** 0 a 100, ou null quando não há base nenhuma para comparar */
  score: number | null;
  /** obras que as duas pessoas avaliaram */
  shared: number;
  /** obras que as duas amaram (nota 4 ou mais) */
  lovedBoth: string[];
  /** vibes em comum entre o seu gosto e o da outra pessoa */
  commonVibes: string[];
  /** em que se baseia: notas nas mesmas obras, vibes ou os dois */
  basis: "notas" | "vibes" | "ambos" | "nenhuma";
}

const RATING_SPAN = 4.5; // diferença máxima possível entre duas notas (0,5 a 5)

/**
 * Afinidade entre o seu gosto e o de outra pessoa.
 * 1) Obras avaliadas pelos dois: concordância = 1 - |nota A - nota B| / 4,5, em média.
 * 2) Vibes: sobreposição (Jaccard ponderada pela posição) entre as suas vibes mais fortes e as dela.
 * Com poucas obras em comum a nota pesa pouco: o peso das notas cresce até 6 obras em comum.
 * É uma heurística explicável, não um modelo treinado: não foi validada com pessoas reais.
 */
export function affinity(mine: Library, theirs: ActivityRow[], theirVibes: string[]): Affinity {
  const my = new Map(Object.values(mine.entries).filter((e) => e.rating !== undefined).map((e) => [e.itemId, e.rating!]));
  const diffs: number[] = [];
  const lovedBoth: string[] = [];
  for (const t of theirs) {
    const a = my.get(t.item_id);
    if (a === undefined || t.rating === null) continue;
    diffs.push(Math.abs(a - t.rating) / RATING_SPAN);
    if (a >= 4 && t.rating >= 4) lovedBoth.push(t.item.title);
  }
  const ratingScore = diffs.length ? 1 - diffs.reduce((s, d) => s + d, 0) / diffs.length : null;

  const mineVibes = dna(mine, 8).map((d) => d.vibe);
  const common = mineVibes.filter((v) => theirVibes.includes(v));
  const union = new Set([...mineVibes, ...theirVibes]).size;
  const vibeScore = mineVibes.length && theirVibes.length ? common.length / union : null;

  let score: number | null;
  let basis: Affinity["basis"];
  if (ratingScore !== null && vibeScore !== null) {
    const w = Math.min(1, diffs.length / 6);
    score = w * ratingScore + (1 - w) * vibeScore;
    basis = "ambos";
  } else if (ratingScore !== null) {
    score = ratingScore * Math.min(1, diffs.length / 6);
    basis = "notas";
  } else if (vibeScore !== null) {
    score = vibeScore;
    basis = "vibes";
  } else {
    score = null;
    basis = "nenhuma";
  }
  return { score: score === null ? null : Math.round(score * 100), shared: diffs.length, lovedBoth: lovedBoth.slice(0, 5), commonVibes: common, basis };
}

/* ------------------------------ comentários ------------------------------ */

export const COMMENT_MAX = 500;

export interface CommentRow {
  id: string;
  author_id: string;
  target_user: string;
  target_item: string;
  body: string;
  created_at: string;
}

/** Texto pronto para enviar, ou o motivo de não poder (vazio, grande demais). */
export function checkComment(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, error: "Escreva algo antes de enviar." };
  if (body.length > COMMENT_MAX) return { ok: false, error: `O comentário aceita até ${COMMENT_MAX} caracteres (tem ${body.length}).` };
  return { ok: true, body };
}

export function parseComment(raw: unknown): CommentRow | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== "string" || typeof r.author_id !== "string" || typeof r.target_user !== "string" || typeof r.target_item !== "string" || typeof r.body !== "string") return null;
  return { id: r.id, author_id: r.author_id, target_user: r.target_user, target_item: r.target_item, body: r.body.slice(0, COMMENT_MAX), created_at: String(r.created_at ?? "") };
}

/** Chave de uma atividade (dono + obra), usada para contar comentários. */
export const threadKey = (user: string, item: string) => `${user}|${item}`;

export function countByThread(rows: Pick<CommentRow, "target_user" | "target_item">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(threadKey(r.target_user, r.target_item), (m.get(threadKey(r.target_user, r.target_item)) ?? 0) + 1);
  return m;
}
