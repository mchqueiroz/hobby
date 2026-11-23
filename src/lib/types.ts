export type Media = "anime" | "manga" | "jogo" | "filme" | "livro" | "musica";
/** Ordem de exibição de todas as mídias. */
export const MEDIAS: Media[] = ["anime", "manga", "jogo", "filme", "livro", "musica"];

/** Cria um objeto com um valor inicial para cada mídia. */
export function perMedia<T>(init: (m: Media) => T): Record<Media, T> {
  return Object.fromEntries(MEDIAS.map((m) => [m, init(m)])) as Record<Media, T>;
}
export type Status = "quero" | "andamento" | "concluido" | "abandonei" | "pausei";

export const MEDIA_LABEL: Record<Media, string> = {
  anime: "Anime",
  manga: "Mangá",
  jogo: "Jogo",
  filme: "Filme ou série",
  livro: "Livro",
  musica: "Álbum",
};

/** Plural, para contagens e filtros: "12 mangás". */
export const MEDIA_PLURAL: Record<Media, string> = {
  anime: "animes",
  manga: "mangás",
  jogo: "jogos",
  filme: "filmes e séries",
  livro: "livros",
  musica: "álbuns",
};

/** Plural curto, para listas corridas: "animes, jogos e filmes". */
export const MEDIA_SHORT: Record<Media, string> = {
  anime: "animes",
  manga: "mangás",
  jogo: "jogos",
  filme: "filmes",
  livro: "livros",
  musica: "álbuns",
};

/** Verbo de progresso de cada mídia. */
export const PROGRESS_LABEL: Record<Media, string> = {
  anime: "Episódio em que você está",
  manga: "Capítulo em que você está",
  jogo: "Horas jogadas",
  filme: "Episódio em que você está (séries)",
  livro: "Página em que você está",
  musica: "Faixa em que você parou",
};

/** Abreviação do progresso, para a biblioteca: "ep. 12", "cap. 80", "35 h", "pág. 120". */
export function progressText(media: Media, n: number): string {
  return media === "jogo" ? `${n} h` : media === "livro" ? `pág. ${n}` : media === "manga" ? `cap. ${n}` : media === "musica" ? `faixa ${n}` : `ep. ${n}`;
}

export const STATUS_LABEL: Record<Status, string> = {
  quero: "Quero ver",
  andamento: "Em andamento",
  concluido: "Concluído",
  abandonei: "Abandonei",
  pausei: "Pausei",
};

/** O verbo de "quero ...": quem quer um jogo quer jogar, quem quer um livro quer ler. */
const WANT_VERB: Record<Media, string> = { anime: "ver", filme: "ver", manga: "ler", livro: "ler", jogo: "jogar", musica: "ouvir" };
export const wantVerb = (m: Media) => WANT_VERB[m];
/** "Quero ver", "Quero jogar"... */
export const wantLabel = (m: Media) => `Quero ${WANT_VERB[m]}`;
/** Nome do status para uma obra específica (só "quero" muda de acordo com a mídia). */
export const statusLabel = (s: Status, m: Media) => (s === "quero" ? wantLabel(m) : STATUS_LABEL[s]);

export interface Item {
  id: string;
  title: string;
  media: Media;
  year?: number;
  /** de 3 a 6 termos do vocabulário comum (ver vibes.ts) */
  vibes: string[];
  brazil?: boolean;
  source: "seed" | "anilist" | "tmdb" | "igdb" | "steam" | "openlibrary" | "musicbrainz" | "deezer";
  /** URL da capa/pôster quando a API fornece */
  cover?: string;
  /** autoria: escritor (livro) ou artista (álbum). Só informativo. */
  author?: string;
  /** nota pública da obra, de 0 a 10, vinda da API (TMDB, IGDB, AniList). Só entra com votos suficientes. */
  quality?: number;
}

export interface Entry {
  itemId: string;
  status: Status;
  /** de 0,5 a 5, em passos de 0,5. Ausente quando o usuário não deu nota. */
  rating?: number;
  at: number;
  /** resenha pessoal (até 2000 caracteres) */
  review?: string;
  /** dia em que a pessoa viu/jogou, escolhido por ela (meio-dia local, em ms). Sem isso vale `at`. */
  date?: number;
  /** episódio em que parou (anime/série) ou horas jogadas (jogo). Só vale em "em andamento". */
  progress?: number;
  /** quantos episódios/capítulos/páginas/horas a obra tem. Com isso o progresso vira barra e, ao chegar no total, a obra é concluída. */
  total?: number;
  /** etiquetas da própria pessoa ("para ver com a Ana", "reconfortante") */
  tags?: string[];
  /** quantas vezes a pessoa já fez (1 = só a primeira). Ausente vale 1. */
  rounds?: number;
  /** na vitrine do perfil (até 4): quando foi fixada, para manter a ordem */
  pin?: number;
  /** na fila "A seguir" (só vale em "quero"): quando entrou, para manter a ordem */
  queue?: number;
  /** plataforma ou formato: "Switch", "E-book", "Vinil"… (ver FORMATS) */
  format?: string;
}

/** Onde/como a pessoa viu, jogou, leu ou ouviu. Inspirado em Backloggd (plataforma) e StoryGraph (formato). */
export const FORMATS: Record<Media, string[]> = {
  jogo: ["PC", "PlayStation", "Xbox", "Switch", "Celular", "Outro"],
  livro: ["Físico", "E-book", "Audiolivro"],
  manga: ["Físico", "Digital"],
  filme: ["Cinema", "Streaming", "TV", "Mídia física"],
  anime: ["Streaming", "TV", "Mídia física"],
  musica: ["Streaming", "Vinil", "CD"],
};
export const FORMAT_LABEL: Record<Media, string> = { jogo: "Plataforma", livro: "Formato", manga: "Formato", filme: "Onde viu", anime: "Onde viu", musica: "Formato" };

/** Progresso pronto para exibir: valor, total (se houver) e porcentagem (0 a 100). null quando não há progresso. */
export function entryProgress(e: Pick<Entry, "progress" | "total">): { value: number; total?: number; pct?: number } | null {
  const value = typeof e.progress === "number" && Number.isFinite(e.progress) && e.progress > 0 ? e.progress : 0;
  const total = typeof e.total === "number" && Number.isFinite(e.total) && e.total > 0 ? e.total : undefined;
  if (!value && !total) return null;
  return { value, total, pct: total ? Math.min(100, Math.round((value / total) * 100)) : undefined };
}

/** Unidade do progresso, no singular, para rótulos como "+1 episódio". */
export const PROGRESS_UNIT: Record<Media, string> = { anime: "episódio", filme: "episódio", manga: "capítulo", livro: "página", jogo: "hora", musica: "faixa" };

export const MAX_TAGS = 8;
export const MAX_TAG_LEN = 24;
/** Limpa uma lista de etiquetas: sem espaços sobrando, minúsculas, sem repetidas, no máximo MAX_TAGS. */
export function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const t of input) {
    if (typeof t !== "string") continue;
    const v = t.replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_TAG_LEN).trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** "Rever", "Reler", "Rejogar", "Reouvir". */
export const REDO_LABEL: Record<Media, string> = { anime: "Rever", filme: "Rever", manga: "Reler", livro: "Reler", jogo: "Rejogar", musica: "Reouvir" };

export interface UserList {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: number;
}

export interface Library {
  /** itens que vieram de importação (os do catálogo base não são copiados) */
  items: Record<string, Item>;
  entries: Record<string, Entry>;
  /** itens marcados como "não é pra mim" */
  dismissed: string[];
  /** meta de itens concluídos no ano */
  goal: number;
  /** listas criadas pela pessoa */
  lists: Record<string, UserList>;
  /**
   * Quando cada coisa mudou pela última vez (ms), para juntar bibliotecas de aparelhos diferentes.
   * Chaves: `e:<id>` registro, `d:<id>` "não é pra mim", `l:<id>` lista, `g` meta.
   * Uma chave com carimbo e sem valor significa "apagado nesse momento".
   */
  ts?: Record<string, number>;
}

export const EMPTY_LIBRARY: Library = {
  items: {},
  entries: {},
  dismissed: [],
  goal: 80,
  lists: {},
};
