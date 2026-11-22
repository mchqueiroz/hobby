import type { Library, Media } from "./types";
import { dayStreak } from "./stats";

export interface Achievement { id: string; title: string; desc: string; done: boolean; value: number; goal: number; }

/** Conquistas calculadas na hora a partir da biblioteca: nada é guardado, então nunca ficam fora de sincronia. */
export function achievements(lib: Library, mediaOf: (itemId: string) => Media | undefined, now = Date.now()): Achievement[] {
  const entries = Object.values(lib.entries);
  const done = entries.filter((e) => e.status === "concluido");
  const mediaDone = new Set(done.map((e) => mediaOf(e.itemId)).filter(Boolean));
  const reviews = entries.filter((e) => (e.review ?? "").trim().length > 0).length;
  const redone = entries.filter((e) => (e.rounds ?? 1) > 1).length;
  const rated = entries.filter((e) => e.rating !== undefined).length;
  const best = dayStreak(lib, now).best;
  const mk = (id: string, title: string, desc: string, value: number, goal: number): Achievement => ({ id, title, desc, value: Math.min(value, goal), goal, done: value >= goal });
  return [
    mk("primeiro", "Primeiro passo", "Conclua seu primeiro item", done.length, 1),
    mk("dez", "Pegando o jeito", "Conclua 10 itens", done.length, 10),
    mk("cinquenta", "Colecionador", "Conclua 50 itens", done.length, 50),
    mk("variado", "De tudo um pouco", "Conclua itens de 4 mídias diferentes", mediaDone.size, 4),
    mk("critico", "Crítico", "Escreva 5 resenhas", reviews, 5),
    mk("avaliador", "Opinião formada", "Dê nota a 10 itens", rated, 10),
    mk("rever", "Vale a pena de novo", "Reveja ou releia 3 itens", redone, 3),
    mk("sequencia", "Constância", "Registre algo por 7 dias seguidos", best, 7),
    mk("meta", "Meta batida", "Alcance a meta de conclusões do ano", done.filter((e) => new Date(e.date ?? e.at).getFullYear() === new Date(now).getFullYear()).length, lib.goal),
  ];
}
