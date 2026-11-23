import { getItem, tasteProfile } from "./recommend";
import { MEDIAS, perMedia, type Library, type Media, type Status } from "./types";

/** Data efetiva de uma entrada: a que a pessoa escolheu, senão a do registro. 0 = histórico importado sem data. */
export const effectiveDate = (e: { date?: number; at: number }) => e.date ?? e.at;

export interface Stats {
  total: number;
  byStatus: Record<Status, number>;
  byMedia: Record<Media, number>;
  rated: number;
  average: number | null;
  averageByMedia: Record<Media, number | null>;
  /** 10 faixas, de 0,5 a 5 */
  histogram: number[];
  topVibes: { vibe: string; weight: number }[];
  /** concluídos em cada mês do ano (jan a dez) */
  doneByMonth: number[];
  doneThisYear: number;
  reviews: number;
}

export function computeStats(lib: Library, now = Date.now()): Stats {
  const year = new Date(now).getFullYear();
  const byStatus: Record<Status, number> = { quero: 0, andamento: 0, concluido: 0, abandonei: 0, pausei: 0 };
  const byMedia = perMedia(() => 0);
  const sums = perMedia(() => ({ s: 0, n: 0 }));
  const histogram = new Array(10).fill(0) as number[];
  const doneByMonth = new Array(12).fill(0) as number[];
  let total = 0, rated = 0, sum = 0, reviews = 0;

  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (!item) continue;
    total++;
    byStatus[e.status]++;
    byMedia[item.media]++;
    if (e.review) reviews++;
    if (e.rating !== undefined) {
      rated++;
      sum += e.rating;
      sums[item.media].s += e.rating;
      sums[item.media].n++;
      histogram[Math.min(9, Math.max(0, Math.round(e.rating * 2) - 1))]++;
    }
    const d = effectiveDate(e);
    if (e.status === "concluido" && d > 0) {
      const dt = new Date(d);
      if (dt.getFullYear() === year) doneByMonth[dt.getMonth()]++;
    }
  }
  const avg = (x: { s: number; n: number }) => (x.n ? Math.round((x.s / x.n) * 100) / 100 : null);
  const topVibes = Object.entries(tasteProfile(lib))
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([vibe, weight]) => ({ vibe, weight: Math.round(weight * 10) / 10 }));

  return {
    total, byStatus, byMedia, rated,
    average: rated ? Math.round((sum / rated) * 100) / 100 : null,
    averageByMedia: perMedia((m) => avg(sums[m])),
    histogram, topVibes, doneByMonth,
    doneThisYear: doneByMonth.reduce((a, b) => a + b, 0),
    reviews,
  };
}

/** Entradas com data, da mais recente para a mais antiga, agrupadas por mês. */
export function diaryGroups(lib: Library, locale = "pt-BR") {
  const rows = Object.values(lib.entries)
    .map((e) => ({ e, item: getItem(lib, e.itemId), d: effectiveDate(e) }))
    .filter((r): r is typeof r & { item: NonNullable<typeof r.item> } => !!r.item && r.d > 0)
    .sort((a, b) => b.d - a.d || a.item.title.localeCompare(b.item.title));
  const groups: { key: string; label: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const dt = new Date(r.d);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(dt), rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}

/** Converte "2026-11-13" (campo de data) em meio-dia local, e de volta. */
export function dateFromInput(v: string): number | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
  return Number.isNaN(t) ? null : t;
}
export function dateToInput(ms?: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dia local como número inteiro (independe do horário), para comparar dias seguidos. */
const dayNum = (ms: number) => {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

export interface Streak {
  /** dias seguidos com algum registro, contando até hoje (ou até ontem, se hoje ainda não teve) */
  current: number;
  best: number;
  today: boolean;
}

/** Sequência de dias com ao menos um registro com data (fora "quero ver"). Hoje ainda sem registro não quebra a sequência de ontem. */
export function dayStreak(lib: Library, now = Date.now()): Streak {
  const days = new Set<number>();
  for (const e of Object.values(lib.entries)) {
    const d = effectiveDate(e);
    // pôr algo em "quero ver" é intenção, não atividade: não mantém a sequência
    if (e.status !== "quero" && d > 0 && getItem(lib, e.itemId)) days.add(dayNum(d));
  }
  const today = dayNum(now);
  let best = 0, run = 0, prev = -Infinity;
  for (const d of [...days].sort((a, b) => a - b)) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let cur = 0;
  for (let d = days.has(today) ? today : today - 1; days.has(d); d--) cur++;
  return { current: cur, best, today: days.has(today) };
}

export interface HeatDay { day: number; count: number; future: boolean; }

/** Contagem de registros por dia nas últimas `weeks` semanas, em colunas de domingo a sábado (a última coluna é a semana atual). */
export function heatmap(lib: Library, weeks = 20, now = Date.now()): HeatDay[][] {
  const counts = new Map<number, number>();
  for (const e of Object.values(lib.entries)) {
    const d = effectiveDate(e);
    if (e.status !== "quero" && d > 0 && getItem(lib, e.itemId)) counts.set(dayNum(d), (counts.get(dayNum(d)) ?? 0) + 1);
  }
  const today = dayNum(now);
  const dow = new Date(now).getDay(); // 0 = domingo
  const start = today - dow - (weeks - 1) * 7;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => { const day = start + w * 7 + i; return { day, count: counts.get(day) ?? 0, future: day > today }; }));
}

/**
 * Horas por unidade de progresso e por obra inteira (quando não há progresso nem total).
 * Referências: episódio de anime de 24 min, episódio de série de 45 min, filme de 2 h, capítulo de mangá de 5 min,
 * 40 páginas por hora, horas de jogo anotadas (ou 20 h, perto da mediana do HowLongToBeat), álbum de 45 min.
 */
const HOURS: Record<Media, { unit: number; whole: number }> = {
  anime: { unit: 0.4, whole: 4.8 },
  filme: { unit: 0.75, whole: 2 },
  manga: { unit: 1 / 12, whole: 8 },
  livro: { unit: 1 / 40, whole: 8 },
  jogo: { unit: 1, whole: 20 },
  musica: { unit: 0.75 / 12, whole: 0.75 },
};

/** Estimativa do tempo dedicado, como o "tempo assistido" do TV Time e do Trakt, só que para todas as mídias. */
export function timeSpent(lib: Library): { total: number; byMedia: Record<Media, number> } {
  const byMedia = Object.fromEntries(MEDIAS.map((m) => [m, 0])) as Record<Media, number>;
  for (const e of Object.values(lib.entries)) {
    const it = getItem(lib, e.itemId);
    if (!it || e.status === "quero") continue;
    const h = HOURS[it.media];
    const units = e.status === "concluido" ? (e.total ?? e.progress) : e.progress;
    // filme com total 1 (ou sem total) é um filme; com mais de 1 são episódios de série
    const whole = it.media === "filme" && (!units || units <= 1);
    let hours = 0;
    if (e.status === "concluido") hours = (units && !whole ? units * h.unit : h.whole) * (e.rounds ?? 1);
    else if (units) hours = units * h.unit;
    byMedia[it.media] += hours;
  }
  for (const m of MEDIAS) byMedia[m] = Math.round(byMedia[m]);
  return { total: MEDIAS.reduce((a, m) => a + byMedia[m], 0), byMedia };
}
