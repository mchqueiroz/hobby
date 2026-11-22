import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt24" style={{ borderTop: "1px solid var(--line)", paddingTop: 16, paddingBottom: 24 }}>
      <p className="row gap8" style={{ flexWrap: "wrap", fontSize: 14 }}>
        <Link href="/privacidade" style={{ textDecoration: "underline" }}>Privacidade</Link>
        <Link href="/termos" style={{ textDecoration: "underline" }}>Termos de uso</Link>
        <Link href="/importar" style={{ textDecoration: "underline" }}>Importar histórico</Link>
      </p>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Dados de filmes e séries: este produto usa a API do TMDB, mas não é endorsado nem certificado pelo TMDB. Jogos: IGDB. Anime e mangá: AniList.
        Livros: Open Library. Música: MusicBrainz.
      </p>
    </footer>
  );
}
