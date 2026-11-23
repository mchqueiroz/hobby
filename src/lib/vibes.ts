/**
 * Vocabulário comum de "vibes". É a ponte entre as mídias: cada API traz os
 * seus próprios gêneros e tags, e aqui eles são traduzidos para os mesmos termos.
 * Esta tabela é a parte do produto que mais precisa de revisão humana.
 */
export const VIBES = [
  "sombrio",
  "psicológico",
  "investigação",
  "mistério",
  "jornada épica",
  "aventura",
  "fantasia",
  "ficção científica",
  "futurista",
  "noir",
  "crime",
  "urbano",
  "político",
  "guerra",
  "sobrevivência",
  "terror",
  "sobrenatural",
  "ação intensa",
  "competição",
  "humor leve",
  "romance",
  "slice of life",
  "drama humano",
  "melancólico",
  "coming of age",
  "filosófico",
  "narrativa densa",
  "exploração",
  "estratégia",
  "família",
  "energético",
  "dançante",
  "introspectivo",
] as const;

export type Vibe = (typeof VIBES)[number];

const VALID = new Set<string>(VIBES);

export function onlyValid(list: string[]): string[] {
  return Array.from(new Set(list.filter((v) => VALID.has(v))));
}

/* ---------- AniList (anime) ---------- */

export const ANILIST_GENRES: Record<string, Vibe[]> = {
  Action: ["ação intensa"],
  Adventure: ["aventura"],
  Comedy: ["humor leve"],
  Drama: ["drama humano"],
  Fantasy: ["fantasia"],
  Horror: ["terror", "sombrio"],
  "Mahou Shoujo": ["fantasia"],
  Mecha: ["ficção científica"],
  Mystery: ["mistério"],
  Psychological: ["psicológico"],
  Romance: ["romance"],
  "Sci-Fi": ["ficção científica"],
  "Slice of Life": ["slice of life"],
  Sports: ["competição"],
  Supernatural: ["sobrenatural"],
  Thriller: ["mistério", "sombrio"],
};

export const ANILIST_TAGS: Record<string, Vibe[]> = {
  Dystopian: ["sombrio", "futurista"],
  Cyberpunk: ["futurista", "noir"],
  Detective: ["investigação"],
  War: ["guerra"],
  Military: ["guerra"],
  Politics: ["político"],
  Philosophy: ["filosófico"],
  Survival: ["sobrevivência"],
  "Post-Apocalyptic": ["sobrevivência", "sombrio"],
  "Coming of Age": ["coming of age"],
  Tragedy: ["melancólico", "drama humano"],
  Noir: ["noir"],
  Gore: ["sombrio"],
  Crime: ["crime"],
  "Urban Fantasy": ["urbano", "fantasia"],
  "Time Manipulation": ["ficção científica"],
  Space: ["ficção científica", "exploração"],
  "Anti-Hero": ["sombrio"],
  Family: ["família"],
  Travel: ["exploração"],
  Strategy: ["estratégia"],
  Isekai: ["fantasia", "aventura"],
};

/* ---------- TMDB (filmes e séries). Usado quando a integração for ligada ---------- */

export const TMDB_GENRES: Record<number, Vibe[]> = {
  28: ["ação intensa"],
  12: ["aventura"],
  35: ["humor leve"],
  80: ["crime"],
  18: ["drama humano"],
  10751: ["família"],
  14: ["fantasia"],
  36: ["político"],
  27: ["terror", "sombrio"],
  9648: ["mistério"],
  10749: ["romance"],
  878: ["ficção científica"],
  53: ["mistério", "sombrio"],
  10752: ["guerra"],
  10759: ["ação intensa", "aventura"],
  10765: ["ficção científica", "fantasia"],
  10768: ["guerra", "político"],
};

/* ---------- IGDB (jogos). Usado quando a integração for ligada ---------- */

export const IGDB_TERMS: Record<string, Vibe[]> = {
  "Role-playing (RPG)": ["jornada épica"],
  Adventure: ["aventura"],
  Strategy: ["estratégia"],
  "Turn-based strategy (TBS)": ["estratégia"],
  Puzzle: ["filosófico"],
  Sport: ["competição"],
  Racing: ["competição"],
  Fighting: ["competição", "ação intensa"],
  Shooter: ["ação intensa"],
  Action: ["ação intensa"],
  Fantasy: ["fantasia"],
  "Science fiction": ["ficção científica"],
  Horror: ["terror", "sombrio"],
  Thriller: ["mistério", "sombrio"],
  Survival: ["sobrevivência"],
  Mystery: ["mistério"],
  Drama: ["drama humano"],
  Warfare: ["guerra"],
  Historical: ["político"],
  "Open world": ["exploração"],
  Stealth: ["mistério"],
  Comedy: ["humor leve"],
};

/** Climas para "o que ver hoje": cada um é um conjunto de vibes. */
export const MOODS = {
  leve: { label: "Algo leve", vibes: ["humor leve", "slice of life", "família", "romance", "aventura", "dançante"] },
  intenso: { label: "Algo intenso", vibes: ["ação intensa", "terror", "sobrevivência", "guerra", "crime", "sombrio", "energético"] },
  pensar: { label: "Para pensar", vibes: ["filosófico", "psicológico", "narrativa densa", "mistério", "investigação", "ficção científica", "introspectivo"] },
  emocionar: { label: "Para sentir", vibes: ["drama humano", "melancólico", "coming of age", "romance", "jornada épica", "introspectivo"] },
} as const satisfies Record<string, { label: string; vibes: readonly Vibe[] }>;
export type Mood = keyof typeof MOODS;

/** Junta os vibes de uma lista de termos, do mais frequente ao menos, no máximo `max`. */
export function collect(terms: string[], table: Record<string, Vibe[]>, max = 6): string[] {
  const count = new Map<string, number>();
  for (const t of terms) {
    for (const v of table[t] ?? []) count.set(v, (count.get(v) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([v]) => v);
}

/* ---------- Open Library (livros): assuntos em minúsculas; vale se o assunto contém a chave ---------- */

export const OL_SUBJECTS: Record<string, Vibe[]> = {
  fantasy: ["fantasia"],
  "science fiction": ["ficção científica"],
  dystopia: ["futurista", "sombrio"],
  cyberpunk: ["futurista", "noir"],
  mystery: ["mistério"],
  detective: ["investigação", "mistério"],
  crime: ["crime"],
  thriller: ["mistério", "sombrio"],
  horror: ["terror", "sombrio"],
  "ghost": ["sobrenatural"],
  supernatural: ["sobrenatural"],
  romance: ["romance"],
  "love stories": ["romance"],
  war: ["guerra"],
  politic: ["político"],
  philosoph: ["filosófico"],
  psycholog: ["psicológico"],
  adventure: ["aventura"],
  "coming of age": ["coming of age"],
  "family": ["família"],
  survival: ["sobrevivência"],
  humor: ["humor leve"],
  satire: ["humor leve", "político"],
  tragedy: ["drama humano", "melancólico"],
  "social life": ["drama humano"],
  epic: ["jornada épica"],
  "historical fiction": ["drama humano"],
  "magic realism": ["fantasia", "narrativa densa"],
  "magical realism": ["fantasia", "narrativa densa"],
  "city and town life": ["urbano"],
  exploration: ["exploração"],
  strategy: ["estratégia"],
  noir: ["noir"],
  // assuntos comuns que ficavam de fora (inglês, português e espanhol aparecem misturados no Open Library)
  magic: ["fantasia"],
  wizard: ["fantasia"],
  witch: ["fantasia", "sobrenatural"],
  dragon: ["fantasia", "jornada épica"],
  vampire: ["sobrenatural", "sombrio"],
  monster: ["sobrenatural"],
  "school stories": ["coming of age"],
  "young adult": ["coming of age"],
  orphan: ["drama humano"],
  "suspense": ["mistério"],
  "police": ["investigação", "crime"],
  murder: ["crime", "mistério"],
  spies: ["mistério", "político"],
  "time travel": ["ficção científica"],
  space: ["ficção científica", "exploração"],
  robot: ["futurista", "ficção científica"],
  "post-apocalyptic": ["sobrevivência", "sombrio"],
  dystopian: ["futurista", "político"],
  biography: ["drama humano"],
  memoir: ["introspectivo", "drama humano"],
  poetry: ["introspectivo"],
  "short stories": ["narrativa densa"],
  "classic": ["narrativa densa"],
  fantasia: ["fantasia"],
  "fantástica": ["fantasia"],
  "fantástico": ["fantasia"],
  magia: ["fantasia"],
  aventura: ["aventura"],
  "ficção científica": ["ficção científica"],
  "ciencia ficción": ["ficção científica"],
  misterio: ["mistério"],
  "mistério": ["mistério"],
  policial: ["investigação", "crime"],
  terror: ["terror", "sombrio"],
  guerra: ["guerra"],
  "romance brasileiro": ["drama humano"],
  amor: ["romance"],
  distopia: ["futurista", "sombrio"],
  "filosofia": ["filosófico"],
};

/** Tags da comunidade da Steam (via SteamSpy) para vibes. Bem mais ricas que os gêneros da loja. */
export const STEAM_TAG_VIBES: Record<string, Vibe[]> = {
  Metroidvania: ["exploração", "aventura"],
  "Souls-like": ["sombrio", "ação intensa"],
  "Story Rich": ["narrativa densa"],
  "Choices Matter": ["narrativa densa"],
  Exploration: ["exploração"],
  "Open World": ["exploração"],
  Atmospheric: ["introspectivo"],
  Horror: ["terror", "sombrio"],
  "Psychological Horror": ["psicológico", "terror"],
  Psychological: ["psicológico"],
  Dark: ["sombrio"],
  Mystery: ["mistério"],
  Detective: ["investigação", "mistério"],
  Investigation: ["investigação"],
  "Sci-fi": ["ficção científica"],
  Space: ["ficção científica", "exploração"],
  Cyberpunk: ["futurista", "noir"],
  Futuristic: ["futurista"],
  Dystopian: ["futurista", "político"],
  Fantasy: ["fantasia"],
  "Dark Fantasy": ["fantasia", "sombrio"],
  Survival: ["sobrevivência"],
  "Post-apocalyptic": ["sobrevivência", "sombrio"],
  Strategy: ["estratégia"],
  "Turn-Based Strategy": ["estratégia"],
  "Grand Strategy": ["estratégia", "político"],
  RPG: ["jornada épica"],
  JRPG: ["jornada épica"],
  "Action RPG": ["jornada épica", "ação intensa"],
  Funny: ["humor leve"],
  Comedy: ["humor leve"],
  Cute: ["slice of life"],
  Relaxing: ["slice of life"],
  Cozy: ["slice of life"],
  "Life Sim": ["slice of life"],
  Farming: ["slice of life"],
  Wholesome: ["família"],
  "Family Friendly": ["família"],
  Emotional: ["drama humano"],
  Sad: ["melancólico"],
  Philosophical: ["filosófico"],
  Romance: ["romance"],
  "Dating Sim": ["romance"],
  War: ["guerra"],
  Military: ["guerra"],
  Crime: ["crime"],
  Noir: ["noir"],
  Competitive: ["competição"],
  PvP: ["competição"],
  Sports: ["competição"],
  Racing: ["competição"],
  Action: ["ação intensa"],
  Shooter: ["ação intensa"],
  "Hack and Slash": ["ação intensa"],
  Adventure: ["aventura"],
  Supernatural: ["sobrenatural"],
  Lovecraftian: ["sobrenatural", "terror"],
  Political: ["político"],
  "Coming of Age": ["coming of age"],
  Rhythm: ["energético"],
  Surreal: ["psicológico"],
  Thriller: ["mistério", "sombrio"],
  Puzzle: ["filosófico"],
};

/** Gêneros do Deezer (ids da API) para vibes; o Deezer cobre bem a música brasileira. */
export const DEEZER_GENRES: Record<number, Vibe[]> = {
  132: ["dançante"],
  80: ["romance", "melancólico"],
  78: ["introspectivo", "melancólico"],
  472: ["urbano", "dançante"],
  116: ["urbano"],
  122: ["dançante"],
  152: ["energético"],
  113: ["dançante", "energético"],
  165: ["romance"],
  85: ["introspectivo", "melancólico"],
  79: ["dançante", "humor leve"],
  106: ["dançante", "futurista"],
  76: ["dançante", "energético"],
  466: ["introspectivo", "slice of life"],
  144: ["slice of life"],
  129: ["introspectivo", "noir"],
  98: ["introspectivo", "filosófico"],
  173: ["jornada épica"],
  464: ["energético", "sombrio"],
  169: ["dançante"],
  153: ["melancólico"],
};

const OL_KEY_RE: Record<string, RegExp> = Object.fromEntries(
  Object.keys(OL_SUBJECTS).map((k) => [k, new RegExp(`(^|[^\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u")]),
);

/** Vibes de uma lista de assuntos do Open Library. */
export function olVibes(subjects: string[], max = 6): string[] {
  const hit: string[][] = [];
  for (const raw of subjects) {
    const s = raw.toLowerCase();
    // a chave vale no começo de uma palavra: "war" pega "war" e "wars", mas não "Hogwarts" nem "award"
    for (const [key, vs] of Object.entries(OL_SUBJECTS)) if (OL_KEY_RE[key].test(s)) hit.push(vs);
  }
  const count = new Map<string, number>();
  for (const vs of hit) for (const v of vs) count.set(v, (count.get(v) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v]) => v);
}

/** Assunto do Open Library que melhor representa cada vibe, para a descoberta. */
export const OL_DISCOVER: Partial<Record<Vibe, string>> = {
  fantasia: "fantasy",
  "ficção científica": "science fiction",
  futurista: "dystopia",
  mistério: "mystery",
  investigação: "detective",
  crime: "crime",
  terror: "horror",
  sobrenatural: "supernatural",
  romance: "romance",
  guerra: "war",
  político: "politics",
  filosófico: "philosophy",
  psicológico: "psychology",
  aventura: "adventure",
  "coming of age": "coming of age",
  família: "family",
  sobrevivência: "survival",
  "humor leve": "humor",
  "jornada épica": "epic",
  noir: "noir",
  "drama humano": "tragedy",
  melancólico: "tragedy",
};

/* ---------- MusicBrainz (álbuns): tags da comunidade, em minúsculas; vale se a tag contém a chave ---------- */

export const MB_TAGS: Record<string, Vibe[]> = {
  "progressive rock": ["filosófico", "narrativa densa", "introspectivo"],
  "psychedelic": ["psicológico", "introspectivo"],
  "hard rock": ["energético", "ação intensa"],
  "heavy metal": ["energético", "ação intensa", "sombrio"],
  metal: ["energético", "sombrio"],
  punk: ["energético", "político"],
  grunge: ["sombrio", "energético"],
  "alternative rock": ["introspectivo", "energético"],
  "indie": ["introspectivo"],
  "post-rock": ["introspectivo", "jornada épica"],
  "rock": ["energético"],
  "folk": ["introspectivo", "slice of life"],
  acoustic: ["introspectivo"],
  "singer-songwriter": ["introspectivo", "drama humano"],
  ambient: ["introspectivo", "exploração"],
  "downtempo": ["introspectivo"],
  jazz: ["introspectivo", "noir"],
  blues: ["melancólico", "drama humano"],
  soul: ["romance", "drama humano"],
  "r&b": ["romance", "dançante"],
  funk: ["dançante", "energético"],
  disco: ["dançante"],
  house: ["dançante", "futurista"],
  techno: ["dançante", "futurista", "energético"],
  electronic: ["futurista", "dançante"],
  synth: ["futurista"],
  "synthpop": ["dançante", "futurista"],
  pop: ["dançante", "romance"],
  "hip hop": ["urbano", "político", "narrativa densa"],
  "hip-hop": ["urbano", "político", "narrativa densa"],
  rap: ["urbano", "político"],
  gangsta: ["crime", "urbano", "sombrio"],
  reggae: ["político", "slice of life"],
  "bossa nova": ["romance", "introspectivo", "slice of life"],
  samba: ["dançante", "slice of life"],
  mpb: ["introspectivo", "melancólico", "slice of life"],
  tropic: ["dançante", "político"],
  "brazil": ["slice of life"],
  classical: ["jornada épica", "introspectivo"],
  orchestral: ["jornada épica"],
  soundtrack: ["jornada épica", "aventura"],
  "dark": ["sombrio"],
  melanchol: ["melancólico"],
  sad: ["melancólico"],
  love: ["romance"],
  political: ["político"],
  "protest": ["político"],
  "concept album": ["narrativa densa", "filosófico"],
  experimental: ["psicológico", "narrativa densa"],
  industrial: ["sombrio", "futurista"],
  "new wave": ["dançante", "urbano"],
  "country": ["slice of life", "drama humano"],
  "emo": ["melancólico", "coming of age"],
  "shoegaze": ["introspectivo", "melancólico"],
  "trip hop": ["sombrio", "introspectivo", "noir"],
  "dream pop": ["introspectivo", "romance"],
};

/** Vibes de uma lista de tags do MusicBrainz. Só conta tag votada mais de uma vez (ruído de uma pessoa só fica de fora). */
export function mbVibes(tags: { name: string; count?: number }[], max = 6): string[] {
  const count = new Map<string, number>();
  for (const t of tags) {
    if ((t.count ?? 1) < 1) continue;
    const name = t.name.toLowerCase();
    const w = Math.min(5, Math.max(1, t.count ?? 1));
    // a tag mais específica ganha da genérica: "progressive rock" não soma também o "rock"
    const keys = Object.keys(MB_TAGS).filter((k) => name.includes(k)).sort((a, b) => b.length - a.length);
    const key = keys[0];
    if (!key) continue;
    for (const v of MB_TAGS[key]) count.set(v, (count.get(v) ?? 0) + w);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([v]) => v);
}

/** Tag do MusicBrainz que melhor representa cada vibe, para a descoberta de álbuns. */
export const MB_DISCOVER: Partial<Record<Vibe, string>> = {
  energético: "rock",
  dançante: "electronic",
  introspectivo: "indie",
  melancólico: "blues",
  sombrio: "post-punk",
  romance: "soul",
  político: "hip hop",
  urbano: "hip hop",
  noir: "jazz",
  psicológico: "psychedelic",
  filosófico: "progressive rock",
  futurista: "synthpop",
  "jornada épica": "post-rock",
  "slice of life": "folk",
  aventura: "soundtrack",
  "narrativa densa": "concept album",
};
