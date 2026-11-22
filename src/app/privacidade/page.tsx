import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Privacidade", description: "Como o Hobby trata seus dados." };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_URL || process.env.CONTACT_URL || "";

export default function Privacidade() {
  return (
    <>
      <Link href="/" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center" }}>‹ Início</Link>
      <h1 style={{ marginTop: 8 }}>Privacidade</h1>
      <p className="sub">Última atualização: novembro de 2026. Texto em linguagem simples, escrito para este app.</p>

      <h2 className="label">Seus registros ficam com você</h2>
      <p>Tudo o que você registra (itens, notas, resenhas, listas, etiquetas, metas) fica salvo no seu aparelho. Sem criar conta, nada disso sai daí.</p>

      <h2 className="label">Se você criar uma conta</h2>
      <p>Guardamos seu e-mail e uma cópia da sua biblioteca na nuvem (Supabase), para sincronizar entre aparelhos. Só você acessa essa cópia. Se você tornar o perfil público, ficam visíveis seu nome de usuário, sua bio, números e estilos do seu gosto e a atividade que você decidir mostrar. Resenhas só aparecem se você liberar essa opção. Comentários que você faz em resenhas de outras pessoas ficam visíveis para quem puder ver aquela resenha.</p>

      <h2 className="label">Busca, importação e capas</h2>
      <p>O que você digita na busca e o usuário do AniList que você importa passam pelo nosso servidor apenas para consultar serviços de terceiros (TMDB, IGDB, AniList, Open Library, MusicBrainz). Não guardamos essas consultas.</p>

      <h2 className="label">Métricas de uso (opcional)</h2>
      <p>Só se você aceitar: enviamos de forma anônima quantos toques e quanto tempo o registro levou, e se você aceitou sugestões. Nunca enviamos títulos, notas, e-mail ou usuário do AniList. Dá para desligar a qualquer momento no Perfil.</p>

      <h2 className="label">Erros do app</h2>
      <p>Quando uma tela quebra, o navegador envia o tipo do erro, o começo da pilha técnica e o endereço da página sem o que vem depois do “?”. Não vai nada da sua biblioteca, nem e-mail, nem identificador do aparelho, e não guardamos o seu IP. Serve só para consertar o app.</p>

      <h2 className="label">O que não fazemos</h2>
      <p>Não vendemos dados, não mostramos anúncios e não usamos rastreadores de terceiros.</p>

      <h2 className="label">Seus direitos (LGPD)</h2>
      <p>Você pode levar tudo (Perfil → Exportar meus dados, em JSON, ou planilha CSV) e apagar tudo (Perfil → Excluir meus dados), inclusive a conta e a cópia na nuvem. Para dúvidas ou pedidos sobre seus dados{CONTACT ? <>, fale com a gente em <strong>{CONTACT}</strong></> : ", use o contato informado no site onde o app foi publicado"}.</p>

      <h2 className="label">Menores de 18 anos</h2>
      <p>Menores de 18 anos devem usar o Hobby com o consentimento de um responsável.</p>

      <h2 className="label">Mudanças</h2>
      <p>Se algo importante mudar, avisamos no app e atualizamos a data acima.</p>

      <SiteFooter />
    </>
  );
}
