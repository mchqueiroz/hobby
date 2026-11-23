import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Termos de uso", description: "Regras de uso do Hobby." };

export default function Termos() {
  return (
    <>
      <Link href="/" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><CaretLeft size={16} weight="bold" aria-hidden="true" />Início</Link>
      <h1 style={{ marginTop: 8 }}>Termos de uso</h1>
      <p className="sub">Última atualização: novembro de 2026.</p>

      <h2 className="label">O que é o Hobby</h2>
      <p>Um app gratuito para registrar e descobrir filmes, séries, anime, mangá, livros e jogos. É um projeto em evolução e é oferecido como está, sem garantia de que ficará sempre disponível ou livre de erros.</p>

      <h2 className="label">Seu conteúdo</h2>
      <p>Resenhas, comentários e demais textos são de sua responsabilidade. Não publique conteúdo ofensivo, ilegal, spam ou que viole direitos de terceiros. Você continua dono do que escreve e nos autoriza apenas a exibi-lo conforme as opções de privacidade que você escolher.</p>

      <h2 className="label">Moderação</h2>
      <p>Qualquer pessoa pode denunciar e bloquear. Comentários muito denunciados são ocultados automaticamente e podem ser removidos. Contas que abusem do serviço podem ser limitadas ou encerradas.</p>

      <h2 className="label">Dados de terceiros</h2>
      <p>Capas, sinopses e notas vêm de serviços como TMDB, IGDB, AniList, Open Library e MusicBrainz e pertencem aos respectivos donos. O Hobby não é afiliado a eles.</p>

      <h2 className="label">Sua conta e seus dados</h2>
      <p>Você pode exportar e apagar tudo quando quiser, em Perfil. Veja a <Link href="/privacidade" style={{ textDecoration: "underline" }}>Política de privacidade</Link>.</p>

      <h2 className="label">Responsabilidade</h2>
      <p>Na medida permitida pela lei, não nos responsabilizamos por perdas decorrentes do uso do app. Recomendamos exportar um backup de vez em quando.</p>

      <SiteFooter />
    </>
  );
}
