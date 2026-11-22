# Checklist de lançamento do Hobby

Passo a passo para colocar no ar. O que depende de você (contas, chaves, domínio) está marcado com **[você]**.

## 1. GitHub **[você]**
1. Crie um repositório vazio (privado ou público) em github.com/new, sem README.
2. Na pasta do projeto: `git remote add origin https://github.com/SEU_USUARIO/hobby.git` e `git push -u origin main`.
3. O arquivo `.env.local` **nunca** vai para o Git (já está no `.gitignore`).
4. Escolha uma licença (ex.: MIT) e adicione um arquivo `LICENSE`. Eu não escolho isso por você.

## 2. Chaves das APIs **[você]**
| Serviço | Onde pegar | Variável |
|---|---|---|
| TMDB (filmes/séries) | themoviedb.org/settings/api → "Token de leitura da API" | `TMDB_READ_TOKEN` |
| IGDB (jogos) | dev.twitch.tv/console → criar app | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` |
| Supabase (contas e social) | Project Settings → API | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave *publishable*, nunca a service_role) |

AniList, Open Library e MusicBrainz não precisam de chave. Sem as chaves o app funciona, só com menos fontes.

## 3. Vercel **[você]**
1. vercel.com → Add New → Project → importe o repositório. O framework (Next.js) é detectado sozinho.
2. Em *Environment Variables* coloque as variáveis do passo 2 e também:
   - `NEXT_PUBLIC_SITE_URL` = endereço final (ex.: `https://hobby.vercel.app` ou seu domínio)
   - `NEXT_PUBLIC_CONTACT_URL` = e-mail ou site de contato (aparece na Privacidade; exigido pela LGPD na prática)
   - `CONTACT_URL` = o mesmo contato (vai no User-Agent do Open Library/MusicBrainz)
   - `NEXT_PUBLIC_FEEDBACK_URL` (opcional) = formulário ou `mailto:`; liga o botão "Enviar feedback" no Perfil
3. As variáveis `NEXT_PUBLIC_*` entram **na hora do build**. Se mudar uma, faça *Redeploy*.
4. Deploy. Abra o endereço, instale como app (PWA) no celular e teste.

## 4. Supabase **[você]**
1. O projeto `hobby-mvp` já tem as tabelas e regras. Em um projeto novo, rode `supabase/schema.sql` inteiro no SQL Editor e depois `supabase/migrations/stage6_moderation.sql` e `stage7_followers.sql` se não estiverem incluídos.
2. *Authentication → URL Configuration*: **Site URL** = o endereço do app; em **Redirect URLs** adicione o mesmo endereço (e `http://localhost:3000` para desenvolvimento).
3. *Authentication → Providers → Email*: decida se exige confirmação de e-mail. Se exigir, configure um **SMTP próprio** (Resend, Brevo…): o e-mail padrão do Supabase tem limite muito baixo e cai em spam.
4. O plano gratuito **pausa o projeto após ~7 dias sem uso**. Para lançar de verdade, considere o plano Pro ou um ping periódico.
5. Moderação: leia `supabase/moderacao.sql` (como ver denúncias e remover conteúdo). Não existe painel dentro do app.

## 5. Antes de divulgar
- [ ] Criar uma conta de teste, publicar o perfil, seguir outra conta, comentar, denunciar, bloquear, excluir a conta.
- [ ] Testar no celular (Android e iPhone): instalar, usar offline, importar do AniList.
- [ ] Conferir a prévia do link no WhatsApp/Telegram (imagem `public/og.png`).
- [ ] Preencher o contato na Privacidade (`NEXT_PUBLIC_CONTACT_URL`).
- [ ] Ler as páginas /privacidade e /termos e ajustar ao que você realmente fizer. São textos simples, **não substituem um advogado**.
- [ ] Exportar um backup seu (Perfil → Exportar) antes de cada atualização grande.

## 6. O que ainda não existe (seja transparente com os usuários)
- Calendário de lançamentos, "onde assistir" e registro automático de episódios (dependem de serviços externos).
- Painel de moderação dentro do app (hoje é por SQL).
- Notificações push.
- Os resultados do laboratório do recomendador na apresentação são sintéticos; o recomendador ainda não foi validado com usuários reais.


## Antes de cobrar: licença do TMDB e créditos

- O TMDB é gratuito só para uso **não comercial**. Assim que o Hobby cobrar (Pro) ou exibir anúncios, é preciso licença comercial: peça em developer.themoviedb.org (FAQ) informando seu país. Um blog de terceiros cita US$ 149/mês para empresas pequenas; confirme direto com o TMDB.
- Mantenha na tela o crédito “Dados de filmes e séries: TMDB” e, em “Onde encontrar”, o crédito ao JustWatch.
- Alternativa se a licença não couber no orçamento: lançar o Pro só depois de fechar a licença, ou trocar a fonte de filmes/séries.


## Erros em produção

O app relata erros do navegador para `/api/erro`, que os escreve no log do servidor. Na Vercel: projeto → Logs → busque `[hobby-erro]`. Cada linha tem a mensagem, o começo da pilha e o caminho da página. Se o volume incomodar ou você preferir um serviço próprio (Sentry etc.), defina `NEXT_PUBLIC_ERROR_REPORTS=off` e troque `reportError` em `src/lib/errorReport.ts`.

## Moderação

Denúncias aparecem em `/moderacao` (página sem link no menu; só administradores veem algo). Para virar administrador, rode uma vez no SQL Editor do Supabase, com o seu UUID em Authentication → Users:

```sql
insert into public.admins (user_id) values ('SEU-UUID-AQUI');
```

Ações: esconder, mostrar de novo (limpa as denúncias) e apagar. Três denúncias de pessoas diferentes já escondem o comentário sozinhas. Combine um prazo de resposta (por exemplo 48 horas) e escreva no contato dos Termos.

## Beta fechado

Roteiro, entrevista e métricas em `docs/BETA.md`.
