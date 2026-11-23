import Link from "next/link";
import { DemoButton } from "@/components/DemoButton";
import { RedirectHome } from "@/components/RedirectHome";
import { SiteFooter } from "@/components/SiteFooter";

export default function Landing() {
  return (
    <>
      <RedirectHome />
      <div className="word">hobby</div>
      <h1 style={{ marginTop: 30, fontSize: 34, lineHeight: 1.15 }}>Todos os seus hobbies em um perfil.</h1>
      <p className="sub" style={{ fontSize: 17 }}>A próxima descoberta vem de qualquer mídia.</p>

      <div className="stack gap8 mt24">
        <Link href="/importar" className="btn" data-testid="cta-comecar">Começar</Link>
        <DemoButton />
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Grátis, sem anúncios e sem precisar de conta.</p>

      <div className="mt24" style={{ fontSize: 15, lineHeight: 1.6 }}>
        <p>O Hobby guarda o que você assistiu, jogou e leu num lugar só: filmes e séries, animes, mangás, jogos e livros. Você dá nota, marca o episódio ou a página em que parou e vê o ano inteiro na retrospectiva.</p>
        <p style={{ marginTop: 12 }}>As sugestões olham o seu gosto, não a mídia. Se você amou um anime sombrio, o próximo pode ser um jogo ou um livro, e o app diz por quê.</p>
        <p style={{ marginTop: 12 }}>Funciona sem conta, no seu aparelho. Dá para importar do AniList, do MyAnimeList e do Letterboxd, exportar tudo em JSON ou planilha e apagar quando quiser.</p>
      </div>

      <SiteFooter />
    </>
  );
}
