import type { Item, Media } from "./types";

/**
 * Catálogo base do MVP. Só títulos reais que conhecemos com segurança; as vibes
 * são classificação nossa. Quando TMDB e IGDB forem ligados, isto vira apenas o
 * conjunto inicial de sugestões.
 */
type Row = [title: string, year: number, vibes: string[], brazil?: boolean, author?: string];

function make(media: Media, rows: Row[]): Item[] {
  return rows.map(([title, year, vibes, brazil, author]) => ({
    id: `seed:${media}:${slug(title)}`,
    title,
    media,
    year,
    vibes,
    brazil: brazil || undefined,
    author,
    source: "seed" as const,
  }));
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normaliza título para detectar o mesmo item vindo de fontes diferentes. */
export function norm(s: string): string {
  return slug(s).replace(/-/g, "");
}

/** Chave de "mesma obra": título e mídia. O anime e o mangá de Death Note são obras diferentes. */
export function titleKey(item: Pick<Item, "title" | "media">): string {
  return `${item.media}:${norm(item.title)}`;
}

const ANIME: Row[] = [
  ["Cowboy Bebop", 1998, ["noir", "futurista", "melancólico", "aventura", "ação intensa"]],
  ["Death Note", 2006, ["psicológico", "investigação", "sombrio", "mistério", "narrativa densa"]],
  ["Steins;Gate", 2011, ["ficção científica", "mistério", "psicológico", "drama humano"]],
  ["Attack on Titan", 2013, ["sombrio", "sobrevivência", "guerra", "ação intensa", "político"]],
  ["Fullmetal Alchemist: Brotherhood", 2009, ["jornada épica", "fantasia", "guerra", "drama humano", "aventura"]],
  ["Neon Genesis Evangelion", 1995, ["psicológico", "ficção científica", "sombrio", "filosófico", "melancólico"]],
  ["Mob Psycho 100", 2016, ["sobrenatural", "humor leve", "coming of age", "ação intensa"]],
  ["Your Name", 2016, ["romance", "sobrenatural", "melancólico", "coming of age"]],
  ["Spirited Away", 2001, ["fantasia", "aventura", "coming of age", "sobrenatural"]],
  ["Monster", 2004, ["psicológico", "investigação", "sombrio", "mistério", "narrativa densa", "crime"]],
  ["Haikyu!!", 2014, ["competição", "coming of age", "humor leve", "drama humano"]],
  ["Vinland Saga", 2019, ["guerra", "jornada épica", "drama humano", "sombrio", "filosófico"]],
  ["Violet Evergarden", 2018, ["melancólico", "drama humano", "romance", "guerra"]],
  ["Made in Abyss", 2017, ["exploração", "aventura", "sombrio", "sobrevivência", "fantasia"]],
  ["Ghost in the Shell", 1995, ["futurista", "ficção científica", "filosófico", "noir", "crime"]],
];

const JOGOS: Row[] = [
  ["Dark Souls", 2011, ["sombrio", "fantasia", "sobrevivência", "exploração", "jornada épica"]],
  ["Hades", 2020, ["fantasia", "ação intensa", "aventura", "drama humano"]],
  ["Hollow Knight", 2017, ["sombrio", "exploração", "fantasia", "melancólico", "aventura"]],
  ["The Witcher 3", 2015, ["jornada épica", "fantasia", "político", "sombrio", "drama humano", "exploração"]],
  ["Disco Elysium", 2019, ["psicológico", "investigação", "narrativa densa", "político", "filosófico", "melancólico"]],
  ["Celeste", 2018, ["coming of age", "drama humano", "aventura", "melancólico"]],
  ["Stardew Valley", 2016, ["slice of life", "humor leve", "família", "exploração"]],
  ["Undertale", 2015, ["humor leve", "drama humano", "aventura", "filosófico"]],
  ["Portal 2", 2011, ["ficção científica", "humor leve", "mistério", "futurista"]],
  ["Red Dead Redemption 2", 2018, ["jornada épica", "drama humano", "crime", "exploração", "melancólico"]],
  ["The Last of Us", 2013, ["sobrevivência", "sombrio", "drama humano", "melancólico", "aventura"]],
  ["Outer Wilds", 2019, ["exploração", "mistério", "ficção científica", "filosófico", "melancólico"]],
  ["Return of the Obra Dinn", 2018, ["investigação", "mistério", "sombrio", "narrativa densa"]],
  ["Dandara", 2018, ["exploração", "fantasia", "aventura", "filosófico"], true],
  ["Horizon Chase Turbo", 2018, ["competição", "humor leve", "aventura"], true],
  ["Blazing Chrome", 2019, ["ação intensa", "ficção científica", "futurista", "guerra"], true],
];

const FILMES: Row[] = [
  ["Blade Runner", 1982, ["noir", "futurista", "ficção científica", "melancólico", "filosófico"]],
  ["Parasita", 2019, ["crime", "drama humano", "sombrio", "político", "urbano"]],
  ["Breaking Bad", 2008, ["crime", "drama humano", "sombrio", "narrativa densa", "psicológico"]],
  ["Dark", 2017, ["mistério", "ficção científica", "sombrio", "narrativa densa", "psicológico", "família"]],
  ["Black Mirror", 2011, ["ficção científica", "futurista", "sombrio", "psicológico", "filosófico"]],
  ["Interstellar", 2014, ["ficção científica", "exploração", "jornada épica", "família", "filosófico"]],
  ["Cidade de Deus", 2002, ["crime", "urbano", "drama humano", "ação intensa", "sombrio"], true],
  ["Tropa de Elite", 2007, ["crime", "urbano", "ação intensa", "político", "sombrio"], true],
  ["Central do Brasil", 1998, ["drama humano", "jornada épica", "melancólico", "família"], true],
  ["O Auto da Compadecida", 2000, ["humor leve", "fantasia", "drama humano", "família"], true],
  ["Bacurau", 2019, ["político", "sombrio", "sobrevivência", "ação intensa", "mistério"], true],
  ["Ainda Estou Aqui", 2024, ["drama humano", "político", "família", "melancólico"], true],
  ["3%", 2016, ["futurista", "ficção científica", "sombrio", "sobrevivência", "competição"], true],
  ["Chernobyl", 2019, ["sombrio", "político", "drama humano", "sobrevivência", "melancólico"]],
  ["Her", 2013, ["romance", "futurista", "melancólico", "filosófico", "ficção científica"]],
];

const MANGAS: Row[] = [
  ["Berserk", 1989, ["sombrio", "jornada épica", "fantasia", "ação intensa", "drama humano"]],
  ["Vagabond", 1998, ["jornada épica", "filosófico", "ação intensa", "drama humano"]],
  ["Vinland Saga", 2005, ["guerra", "jornada épica", "sombrio", "drama humano", "político"]],
  ["Monster", 1994, ["psicológico", "mistério", "investigação", "sombrio", "narrativa densa"]],
  ["Death Note", 2003, ["psicológico", "investigação", "sombrio", "mistério"]],
  ["One Piece", 1997, ["aventura", "jornada épica", "humor leve", "fantasia"]],
  ["Fullmetal Alchemist", 2001, ["aventura", "fantasia", "drama humano", "guerra", "jornada épica"]],
  ["Slam Dunk", 1990, ["competição", "humor leve", "coming of age"]],
  ["Uzumaki", 1998, ["terror", "sobrenatural", "sombrio", "psicológico"]],
  ["Nana", 2000, ["romance", "drama humano", "slice of life", "melancólico"]],
  ["Akira", 1982, ["ficção científica", "futurista", "sombrio", "ação intensa", "político"]],
  ["Yotsuba&!", 2003, ["slice of life", "humor leve", "família"]],
];

const LIVROS: Row[] = [
  ["1984", 1949, ["político", "futurista", "sombrio", "filosófico", "ficção científica"], false, "George Orwell"],
  ["O Hobbit", 1937, ["fantasia", "aventura", "jornada épica"], false, "J. R. R. Tolkien"],
  ["Crime e Castigo", 1866, ["psicológico", "crime", "filosófico", "drama humano", "sombrio"], false, "Fiódor Dostoiévski"],
  ["O Nome da Rosa", 1980, ["mistério", "investigação", "filosófico", "narrativa densa"], false, "Umberto Eco"],
  ["Dom Casmurro", 1899, ["drama humano", "melancólico", "romance", "narrativa densa"], true, "Machado de Assis"],
  ["Ensaio sobre a Cegueira", 1995, ["sobrevivência", "sombrio", "drama humano", "político", "filosófico"], false, "José Saramago"],
  ["Grande Sertão: Veredas", 1956, ["jornada épica", "filosófico", "narrativa densa", "drama humano"], true, "João Guimarães Rosa"],
  ["O Pequeno Príncipe", 1943, ["filosófico", "família", "melancólico", "aventura"], false, "Antoine de Saint-Exupéry"],
  ["Neuromancer", 1984, ["ficção científica", "futurista", "noir", "crime", "urbano"], false, "William Gibson"],
  ["Harry Potter e a Pedra Filosofal", 1997, ["fantasia", "aventura", "coming of age", "família", "mistério"], false, "J. K. Rowling"],
  ["A Revolução dos Bichos", 1945, ["político", "sombrio", "filosófico"], false, "George Orwell"],
  ["Cem Anos de Solidão", 1967, ["fantasia", "família", "drama humano", "narrativa densa", "melancólico"], false, "Gabriel García Márquez"],
  ["O Alienista", 1882, ["psicológico", "político", "filosófico", "humor leve"], true, "Machado de Assis"],
];

const MUSICAS: Row[] = [
  ["OK Computer", 1997, ["introspectivo", "melancólico", "futurista", "filosófico", "sombrio"], false, "Radiohead"],
  ["The Dark Side of the Moon", 1973, ["filosófico", "psicológico", "introspectivo", "narrativa densa", "melancólico"], false, "Pink Floyd"],
  ["Kind of Blue", 1959, ["introspectivo", "noir", "urbano", "melancólico"], false, "Miles Davis"],
  ["To Pimp a Butterfly", 2015, ["político", "urbano", "drama humano", "narrativa densa", "energético"], false, "Kendrick Lamar"],
  ["Thriller", 1982, ["dançante", "energético", "urbano", "sobrenatural"], false, "Michael Jackson"],
  ["Abbey Road", 1969, ["romance", "slice of life", "aventura", "introspectivo"], false, "The Beatles"],
  ["Nevermind", 1991, ["energético", "sombrio", "coming of age", "psicológico"], false, "Nirvana"],
  ["Random Access Memories", 2013, ["dançante", "futurista", "ficção científica", "romance", "energético"], false, "Daft Punk"],
  ["Rumours", 1977, ["romance", "drama humano", "melancólico", "introspectivo"], false, "Fleetwood Mac"],
  ["Back to Black", 2006, ["melancólico", "romance", "noir", "drama humano"], false, "Amy Winehouse"],
  ["Illmatic", 1994, ["urbano", "crime", "drama humano", "sombrio", "narrativa densa"], false, "Nas"],
  ["Currents", 2015, ["introspectivo", "psicológico", "dançante", "melancólico"], false, "Tame Impala"],
  ["Clube da Esquina", 1972, ["introspectivo", "melancólico", "slice of life", "coming of age"], true, "Milton Nascimento e Lô Borges"],
  ["Tropicália: ou Panis et Circencis", 1968, ["político", "humor leve", "aventura", "energético"], true, "Vários artistas"],
  ["Sobrevivendo no Inferno", 1997, ["político", "urbano", "sobrevivência", "sombrio", "crime", "drama humano"], true, "Racionais MC's"],
  ["Elis & Tom", 1974, ["romance", "introspectivo", "melancólico", "slice of life"], true, "Elis Regina e Tom Jobim"],
  ["Selvagem?", 1986, ["energético", "dançante", "político", "humor leve"], true, "Os Paralamas do Sucesso"],
];

export const SEED: Item[] = [
  ...make("anime", ANIME),
  ...make("manga", MANGAS),
  ...make("livro", LIVROS),
  ...make("musica", MUSICAS),
  ...make("jogo", JOGOS),
  ...make("filme", FILMES),
];

export const SEED_BY_ID: Record<string, Item> = Object.fromEntries(SEED.map((i) => [i.id, i]));
