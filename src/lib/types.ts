export type Media = "anime" | "manga" | "jogo" | "filme" | "livro" | "musica";
/** Ordem de exibição de todas as mídias. */
export const MEDIAS: Media[] = ["anime", "manga", "jogo", "filme", "livro", "musica"];

/** Cria um objeto com um valor inicial para cada mídia. */
export function perMedia<T>(init: (m: Media) => T): Record<Media, T> {
  return Object.fromEntries(MEDIAS.map((m) => [m, init(m)])) as Record<Media, T>;
}
export type Status = "quero" | "andamento" | "concluido" | "abandonei";

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
};

export interface Item {
  id: string;
  title: string;
  media: Media;
  year?: number;
  /** de 3 a 6 termos do vocabulário comum (ver vibes.ts) */
  vibes: string[];
  brazil?: boolean;
  source: "seed" | "anilist" | "tmdb" | "igdb" | "openlibrary" | "musicbrainz";
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
}

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
