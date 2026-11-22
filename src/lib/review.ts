import { getItem } from "./recommend";
import { effectiveDate } from "./stats";
import { perMedia, type Item, type Library, type Media } from "./types";

export interface YearReview {
  year: number;
  /** concluídos no ano (só entram registros com data) */
  done: number;
  abandoned: number;
  byMedia: Record<Media, number>;
  average: number | null;
  reviews: number;
  /** as melhores notas do ano (até 5) */
  best: { item: Item; rating: number }[];
  /** vibes mais frequentes entre os concluídos do ano (até 3) */
  topVibes: string[];
  busiestMonth: { month: number; count: number } | null;
  first: { item: Item; date: number } | null;
  last: { item: Item; date: number } | null;
}

/** Anos em que há ao menos um registro com data, do mais novo ao mais antigo. */
export function reviewYears(lib: Library): number[] {
  const ys = new Set<number>();
  for (const e of Object.values(lib.entries)) {
    const d = effectiveDate(e);
    if (d > 0 && getItem(lib, e.itemId)) ys.add(new Date(d).getFullYear());
  }
  return [...ys].sort((a, b) => b - a);
}

/** "Seu ano em Hobby". Conta só o que tem data (histórico importado sem data fica de fora, e a tela avisa). */
export function yearInReview(lib: Library, year: number): YearReview {
  const byMedia = perMedia(() => 0);
  const months = new Array(12).fill(0) as number[];
  const vibes: Record<string, number> = {};
  const rated: { item: Item; rating: number; date: number }[] = [];
  const dones: { item: Item; date: number }[] = [];
  let abandoned = 0, reviews = 0, sum = 0, n = 0;

  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    const d = effectiveDate(e);
    if (!item || d <= 0 || new Date(d).getFullYear() !== year) continue;
    if (e.status === "abandonei") abandoned++;
    if (e.status !== "concluido") continue;
    dones.push({ item, date: d });
    byMedia[item.media]++;
    months[new Date(d).getMonth()]++;
    for (const v of item.vibes) vibes[v] = (vibes[v] ?? 0) + 1;
    if (e.review) reviews++;
    if (e.rating !== undefined) {
      rated.push({ item, rating: e.rating, date: d });
      sum += e.rating;
      n++;
    }
  }

  dones.sort((a, b) => a.date - b.date || a.item.title.localeCompare(b.item.title, "pt-BR"));
  const peak = Math.max(...months);
  return {
    year,
    done: dones.length,
    abandoned,
    byMedia,
    average: n ? Math.round((sum / n) * 100) / 100 : null,
    reviews,
    best: rated
      .sort((a, b) => b.rating - a.rating || b.date - a.date || a.item.title.localeCompare(b.item.title, "pt-BR"))
      .slice(0, 5)
      .map(({ item, rating }) => ({ item, rating })),
    topVibes: Object.entries(vibes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([v]) => v),
    busiestMonth: peak > 0 ? { month: months.indexOf(peak), count: peak } : null,
    first: dones[0] ?? null,
    last: dones[dones.length - 1] ?? null,
  };
}
