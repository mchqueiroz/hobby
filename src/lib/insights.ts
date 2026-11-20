import { entryWeight, getItem } from "./recommend";
import { computeStats, effectiveDate } from "./stats";
import { MEDIAS, perMedia, type Entry, type Item, type Library, type Media } from "./types";

const DAY = 86_400_000;

/** Arquétipo por vibe: um apelido afetuoso para a vibe que mais aparece no gosto da pessoa. */
export const ARCHETYPE: Record<string, string> = {
  sombrio: "Explorador do lado escuro",
  energético: "Movido a volume alto",
  dançante: "Pé na pista",
  introspectivo: "Ouvinte de fone no ouvido",
  psicológico: "Mente inquieta",
  investigação: "Detetive de sofá",
  mistério: "Caçador de pistas",
  "jornada épica": "Viajante de grandes jornadas",
  aventura: "Aventureiro de plantão",
  fantasia: "Habitante de outros mundos",
  "ficção científica": "Viajante do futuro",
  futurista: "Visionário",
  noir: "Alma noir",
  crime: "Cronista do submundo",
  urbano: "Observador da cidade",
  político: "Estrategista de bastidores",
  guerra: "Veterano de batalhas",
  sobrevivência: "Sobrevivente nato",
  terror: "Corajoso do escuro",
  sobrenatural: "Amigo do sobrenatural",
  "ação intensa": "Movido a adrenalina",
  competição: "Competidor nato",
  "humor leve": "Coração leve",
  romance: "Romântico assumido",
  "slice of life": "Colecionador de dias comuns",
  "drama humano": "Sensível às pessoas",
  melancólico: "Poeta melancólico",
  "coming of age": "Eterno em crescimento",
  filosófico: "Filósofo de sofá",
  "narrativa densa": "Leitor de camadas",
  exploração: "Explorador curioso",
  estratégia: "Mente estratégica",
  família: "Coração de família",
};

/** Peso positivo de cada vibe, por mídia, a partir do que a pessoa registrou. */
export function vibeByMedia(lib: Library): Map<string, Record<Media, number>> {
  const out = new Map<string, Record<Media, number>>();
  for (const e of Object.values(lib.entries)) {
    const item = getItem(lib, e.itemId);
    if (!item) continue;
    const w = entryWeight(e);
    if (w <= 0) continue;
    for (const v of item.vibes) {
      const row = out.get(v) ?? perMedia(() => 0);
      row[item.media] += w;
      out.set(v, row);
    }
  }
  return out;
}

const total = (r: Record<Media, number>) => MEDIAS.reduce((a, m) => a + r[m], 0);

/** As vibes mais fortes do gosto, com a contribuição de cada mídia. */
export function dna(lib: Library, n = 8) {
  return [...vibeByMedia(lib).entries()]
    .map(([vibe, by]) => ({ vibe, by, weight: total(by) }))
    .sort((a, b) => b.weight - a.weight || a.vibe.localeCompare(b.vibe))
    .slice(0, n);
}

/** Vibes que aparecem em mais de uma mídia: o "fio condutor" que o Hobby enxerga e outros apps não. */
export function bridgeVibes(lib: Library, minShare = 0.2) {
  return [...vibeByMedia(lib).entries()]
    .map(([vibe, by]) => {
      const t = total(by);
      const medias = MEDIAS.filter((m) => t > 0 && by[m] / t >= minShare && by[m] > 0);
      return { vibe, medias, weight: t };
    })
    .filter((r) => r.medias.length >= 2)
    .sort((a, b) => b.medias.length - a.medias.length || b.weight - a.weight || a.vibe.localeCompare(b.vibe));
}

export interface Persona {
  title: string;
  top: string[];
  /** mídia onde a pessoa mais registrou */
  mainMedia?: Media;
}

export function persona(lib: Library): Persona | null {
  const d = dna(lib, 5);
  if (d.length === 0) return null;
  const counts = perMedia(() => 0);
  for (const e of Object.values(lib.entries)) {
    const it = getItem(lib, e.itemId);
    if (it) counts[it.media]++;
  }
  const mainMedia = MEDIAS.slice().sort((a, b) => counts[b] - counts[a])[0];
  return { title: ARCHETYPE[d[0].vibe] ?? "Colecionador de histórias", top: d.map((x) => x.vibe), mainMedia: counts[mainMedia] ? mainMedia : undefined };
}

/** Os melhores registros: nota mais alta primeiro, depois o mais recente. */
export function favorites(lib: Library, n = 4): { entry: Entry; item: Item }[] {
  return Object.values(lib.entries)
    .filter((e) => e.status === "concluido" && e.rating !== undefined)
    .sort((a, b) => b.rating! - a.rating! || effectiveDate(b) - effectiveDate(a) || a.itemId.localeCompare(b.itemId))
    .map((entry) => ({ entry, item: getItem(lib, entry.itemId) }))
    .filter((r): r is { entry: Entry; item: Item } => !!r.item)
    .slice(0, n);
}

/** Data do primeiro registro com data conhecida. */
export function memberSince(lib: Library): number | null {
  let min = Infinity;
  for (const e of Object.values(lib.entries)) if (e.at > 0 && e.at < min) min = e.at;
  return Number.isFinite(min) ? min : null;
}

/** Semanas seguidas com pelo menos um registro. A semana atual ainda vazia não quebra a sequência. */
export function weeklyStreak(lib: Library, now = Date.now()): { current: number; best: number } {
  const week = (t: number) => Math.floor(t / (7 * DAY));
  const weeks = new Set<number>();
  for (const e of Object.values(lib.entries)) {
    const d = effectiveDate(e);
    if (e.status !== "quero" && d > 0 && d <= now + DAY) weeks.add(week(d));
  }
  if (weeks.size === 0) return { current: 0, best: 0 };
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const cur = week(now);
  let start = weeks.has(cur) ? cur : weeks.has(cur - 1) ? cur - 1 : -1;
  let current = 0;
  while (start >= 0 && weeks.has(start)) {
    current++;
    start--;
  }
  return { current, best };
}

export interface Badge {
  id: string;
  label: string;
  desc: string;
  value: number;
  target: number;
  earned: boolean;
}

export function badges(lib: Library, now = Date.now()): Badge[] {
  const st = computeStats(lib, now);
  const doneByMedia = perMedia(() => 0);
  let bestMonth = 0;
  for (const e of Object.values(lib.entries)) {
    const it = getItem(lib, e.itemId);
    if (it && e.status === "concluido") doneByMedia[it.media]++;
  }
  bestMonth = Math.max(0, ...st.doneByMonth);
  const mediasDone = MEDIAS.filter((m) => doneByMedia[m] > 0).length;
  const bridges = bridgeVibes(lib).length;
  const bigList = Math.max(0, ...Object.values(lib.lists).map((l) => l.itemIds.length));
  const streak = weeklyStreak(lib, now);
  const mk = (id: string, label: string, desc: string, value: number, target: number): Badge => ({
    id, label, desc, value: Math.min(value, target), target, earned: value >= target,
  });
  return [
    mk("primeiro", "Primeiro passo", "Registre a sua primeira obra", st.total, 1),
    mk("dez", "Dez na estante", "Registre 10 obras", st.total, 10),
    mk("cinquenta", "Estante cheia", "Registre 50 obras", st.total, 50),
    mk("tres-midias", "Três mundos", "Conclua ao menos uma obra em três mídias diferentes", mediasDone, 3),
    mk("ponte", "Sem fronteiras", "Tenha 3 vibes fortes em mais de uma mídia", bridges, 3),
    mk("critico", "Voz própria", "Escreva 5 resenhas", st.reviews, 5),
    mk("meta", "Meta batida", `Cumpra a meta de ${lib.goal} obras no ano`, st.doneThisYear, Math.max(1, lib.goal)),
    mk("maratona", "Maratonista", "Conclua 5 obras em um mês", bestMonth, 5),
    mk("sequencia", "Hábito", "Registre algo por 4 semanas seguidas", streak.best, 4),
    mk("curador", "Curador", "Monte uma lista com 5 obras", bigList, 5),
  ];
}
