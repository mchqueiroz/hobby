import type { Media } from "./types";

export interface SearchLink { name: string; url: string; }

/** Links de BUSCA (não garantem que a obra esteja lá). Servem de saída quando a fonte não sabe onde ela está. */
export function searchLinks(media: Media, title: string): SearchLink[] {
  const q = encodeURIComponent(title.trim().slice(0, 100));
  if (!q) return [];
  switch (media) {
    case "filme": return [{ name: "JustWatch", url: `https://www.justwatch.com/br/busca?q=${q}` }];
    case "anime": return [{ name: "Crunchyroll", url: `https://www.crunchyroll.com/pt-br/search?q=${q}` }, { name: "JustWatch", url: `https://www.justwatch.com/br/busca?q=${q}` }];
    case "manga": return [{ name: "Mangá Plus", url: `https://mangaplus.shueisha.co.jp/search_result?keyword=${q}` }, { name: "Amazon", url: `https://www.amazon.com.br/s?k=${q}&i=digital-text` }];
    case "livro": return [{ name: "Open Library", url: `https://openlibrary.org/search?q=${q}` }, { name: "Amazon", url: `https://www.amazon.com.br/s?k=${q}&i=stripbooks` }];
    case "jogo": return [{ name: "Steam", url: `https://store.steampowered.com/search/?term=${q}` }, { name: "Epic Games", url: `https://store.epicgames.com/pt-BR/browse?q=${q}` }];
    case "musica": return [{ name: "Spotify", url: `https://open.spotify.com/search/${q}` }, { name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}` }];
  }
}
