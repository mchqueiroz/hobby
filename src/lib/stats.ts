import { getItem, tasteProfile } from "./recommend";
import { perMedia, type Library, type Media, type Status } from "./types";

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
  const byStatus: Record<Status, number> = { quero: 0, andamento: 0, concluido: 0, abandonei: 0 };
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
