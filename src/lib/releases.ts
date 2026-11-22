import type { Release } from "./details";
import type { Item, Media } from "./types";

export interface Upcoming {
  item: Item;
  release: Release;
  /** dias até a data, no calendário local (0 = hoje) */
  days: number;
}

const DAY = 86_400_000;
const localDay = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

/** Quantos dias faltam para uma data AAAA-MM-DD, contando dias do calendário local. Data inválida dá NaN. */
export function daysUntil(date: string, now: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return NaN;
  return Math.round((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - localDay(now)) / DAY);
}

export function dueLabel(days: number): string {
  return days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
}

export function releaseLabel(r: Release, media: Media): string {
  if (r.kind === "episodio") return r.ep ? `Episódio ${r.ep}` : "Novo episódio";
  return media === "jogo" ? "Lançamento" : "Estreia";
}

/** Só o que ainda vai acontecer (hoje em diante, até 1 ano), da data mais próxima para a mais distante. */
export function upcoming(rows: { item: Item; release?: Release | null }[], now: number): Upcoming[] {
  const out: Upcoming[] = [];
  for (const r of rows) {
    if (!r.release) continue;
    const days = daysUntil(r.release.date, now);
    if (Number.isFinite(days) && days >= 0 && days <= 365) out.push({ item: r.item, release: r.release, days });
  }
  return out.sort((a, b) => a.days - b.days || a.item.title.localeCompare(b.item.title, "pt-BR"));
}

export const RELEASE_GROUPS = [
  { key: "semana", label: "Esta semana", max: 7 },
  { key: "mes", label: "Este mês", max: 31 },
  { key: "depois", label: "Mais para frente", max: 365 },
] as const;

export function groupUpcoming(list: Upcoming[]): { key: string; label: string; rows: Upcoming[] }[] {
  const groups = RELEASE_GROUPS.map((g) => ({ key: g.key as string, label: g.label as string, rows: [] as Upcoming[] }));
  for (const u of list) groups[u.days <= 7 ? 0 : u.days <= 31 ? 1 : 2].rows.push(u);
  return groups.filter((g) => g.rows.length > 0);
}
