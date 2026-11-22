import type { Item, Media } from "./types";

/**
 * "Já é da mesma franquia?" Serve para não oferecer como descoberta a "Segunda temporada" de um anime
 * que a pessoa já viu, nem "Stranger Things (Temporada 3)" para quem tem a série.
 *
 * É uma heurística de título, sem id de franquia (as APIs não dão um que valha entre fontes). Por isso é conservadora:
 *  - filmes e séries: só tiram marcas de temporada/parte e comparam por igualdade;
 *  - anime e mangá: além disso, "Fullmetal Alchemist: Brotherhood" conta como a mesma franquia de "Fullmetal Alchemist"
 *    (um título começa com o outro), mas só quando o título curto tem 2 palavras ou mais, para "Monster" não engolir "Monster Musume";
 *  - jogos, livros e álbuns não entram: "Hades II" é uma sugestão boa para quem zerou "Hades".
 */

const SEASON_WORDS = "(?:\\d+(?:st|nd|rd|th)|second|third|fourth|fifth|final|ultimate|new)";
const STRIP: RegExp[] = [
  new RegExp(`\\b${SEASON_WORDS}\\s+(?:season|cour)\\b`, "g"),
  /\b(?:season|cour|temporada|parte|part|saga)\s*(?:\d+|[ivx]+)\b/g,
  /\b(?:\d+)(?:a|ª)\s+temporada\b/g,
  /\bthe\s+(?:movie|animation)\b/g,
  /\b(?:ova|oad|specials?|dublado|legendado)\b/g,
];

function words(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ") // "(2019)", "(dublado)"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const ROMAN = /^(?:ii|iii|iv|v|vi|vii|viii|ix|x)$/;

/** Palavras do título sem as marcas de continuação. Vazio quando sobra nada. */
export function franchiseWords(title: string, media: Media): string[] {
  let t = words(title).join(" ");
  for (const re of STRIP) t = t.replace(re, " ");
  const w = t.split(/\s+/).filter(Boolean);
  // sobrou "the" ou "of" pendurado depois de tirar "The Final Season Part 2"
  while (w.length > 1 && /^(?:the|a|of|and)$/.test(w[w.length - 1])) w.pop();
  // "Haikyu 2", "Mob Psycho 100 III": numeral solto no fim só vale como temporada em anime e mangá
  if ((media === "anime" || media === "manga") && w.length > 1) {
    const last = w[w.length - 1];
    if (/^[2-9]$/.test(last) || ROMAN.test(last)) w.pop();
  }
  return w;
}

const FAMILY: ReadonlySet<Media> = new Set<Media>(["anime", "manga", "filme"]);

export interface FranchiseIndex {
  /** por mídia: lista de títulos já conhecidos, em palavras */
  byMedia: Map<Media, string[][]>;
}

export function indexFranchises(items: Iterable<Pick<Item, "title" | "media">>): FranchiseIndex {
  const byMedia = new Map<Media, string[][]>();
  for (const it of items) {
    if (!FAMILY.has(it.media)) continue;
    const w = franchiseWords(it.title, it.media);
    if (w.length === 0) continue;
    const list = byMedia.get(it.media) ?? [];
    list.push(w);
    byMedia.set(it.media, list);
  }
  return { byMedia };
}

function startsWith(long: string[], short: string[]): boolean {
  return short.length <= long.length && short.every((w, i) => long[i] === w);
}

/** O candidato é continuação (ou versão) de algo que já está no índice? */
export function inKnownFranchise(idx: FranchiseIndex, c: Pick<Item, "title" | "media">): boolean {
  const known = idx.byMedia.get(c.media);
  if (!known) return false;
  const w = franchiseWords(c.title, c.media);
  if (w.length === 0) return false;
  const prefixOk = c.media !== "filme";
  return known.some((k) => {
    if (k.length === w.length && startsWith(w, k)) return true;
    if (!prefixOk) return false;
    const [short, long] = k.length <= w.length ? [k, w] : [w, k];
    return short.length >= 2 && startsWith(long, short);
  });
}
