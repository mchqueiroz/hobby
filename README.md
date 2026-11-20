# Hobby

Todos os seus hobbies em um perfil. A próxima descoberta vem de qualquer mídia.

MVP de registro e recomendação entre anime, mangá, jogos, filmes e séries, livros e música (álbuns), seguindo o plano do grupo
(promessa: "traga seu histórico de anime e descubra o que assistir ou jogar a seguir").

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 81 testes da lógica (recomendação, importação, busca, armazenamento)
npm run build        # compila e confere tipos
```

**Ver como celular, no notebook:** `npm run celular` sobe o app e abre uma janela de 390×844 (Chrome/Chromium/Brave/Edge). Sem esses navegadores, abra `http://localhost:3000`, aperte F12 e depois Ctrl+Shift+M (modo celular; no Firefox também é Ctrl+Shift+M). **No celular de verdade (iPhone ou Android)**, na mesma rede Wi-Fi: `npm run iphone` (compila e serve em modo produção, que funciona por IP; o modo `dev` do Next 16 bloqueia acesso por IP de rede) e abra `http://IP-DO-NOTEBOOK:3000` no Safari. No Fedora, libere a porta: `sudo firewall-cmd --add-port=3000/tcp`. Redes de universidade costumam isolar os aparelhos: use o roteador de casa ou o roteamento (hotspot) do iPhone.

Para ver rápido sem importar nada: abra o app e toque em **Ver com dados de exemplo**.

## Publicar no GitHub

O repositório já vem com histórico git e uma verificação automática (`.github/workflows/ci.yml`: lint, tipos, testes e build a cada push). Para publicar:

```bash
# 1) crie um repositório VAZIO em github.com/new (sem README, sem .gitignore, sem licença). Sugestão: privado por enquanto.
# 2) na pasta do projeto:
git remote add origin git@github.com:SEU-USUARIO/hobby.git     # ou a URL https que o GitHub mostrar
git push -u origin main
# alternativa com o GitHub CLI já logado:  gh repo create hobby --private --source=. --push
```

Nunca vão para o repositório: `.env.local` (suas chaves), `node_modules` e `.next` (o `.gitignore` já cuida disso; só o `.env.example`, sem valores, vai). Se você pôs uma chave em algum arquivo por engano, troque a chave no painel do serviço. Apagar do git depois não basta. Escolha uma licença (`LICENSE`) só quando decidir como quer compartilhar o código; sem licença, ninguém mais pode reutilizá-lo. Os testes de navegador (`e2e/`) não rodam no CI porque precisam do servidor simulado e do Playwright; rode `bash e2e/run.sh` na sua máquina antes de mudanças grandes.

## O que já funciona

- **Importação do AniList** pelo nome de usuário (lista pública, sem login). Traduz gêneros e tags para "vibes".
- **Biblioteca com filtros na horizontal**: status, categoria (mídia), época (década) e estilo (vibes), cada um numa linha que rola de lado, com a contagem de cada opção. Estilos se combinam (o item precisa ter todos), busca por título ou autor, e os filtros lembram o que você escolheu ao voltar de uma obra.
- **Resenha junto da nota**: no registro, "+ Escrever resenha" (opcional; o registro rápido segue em 2 toques).
- **Registro rápido em 2 toques**: escolher o item e tocar na nota (meia estrela incluída). Com "Desfazer".
- **Biblioteca** com filtro por status e mídia, **perfil** com contagem, vibes e meta do ano.
- **Recomendação entre mídias com explicação** ("Porque você deu 5★ a X (anime): os dois são sombrios e de jornada"),
  no máximo 2 por mídia entre 5, e botão **Não é pra mim** que ajusta as sugestões na hora.
- **Métricas do teste** (tela Perfil → Métricas do teste): tempo e toques para registrar, importações, sugestões aceitas e dispensadas.
- **Importação do MyAnimeList** (animelist.xml ou .gz exportado no site) e **do Letterboxd** (ratings.csv, watched.csv, watchlist.csv do export).
  Os arquivos são lidos no aparelho. O MAL usa o AniList para achar os gêneros (por id do MAL); o Letterboxd usa o TMDB (precisa da chave) e importa até 150 filmes, priorizando os avaliados.
- **Mangá e livros**: mangá vem do AniList (sem chave, mesmo serviço do anime) e livros do Open Library (sem chave; busca, capa, sinopse, autor, nota).
  O catálogo base tem 12 mangás e 13 livros. Mangá e anime com o mesmo nome são obras diferentes e não se confundem (ids `anilist:manga:N` e `anilist:N`).
  O progresso de "em andamento" vira capítulo (mangá) ou página (livro). A importação por arquivo/usuário continua só para anime e filmes.
- **Música (álbuns)**: busca, tags, capa e detalhes pelo MusicBrainz e Cover Art Archive (sem chave, mesmo estilo do Open Library). Só álbum de estúdio entra
  (ao vivo, coletânea e remix são descartados). As tags da comunidade viram vibes, e há 3 vibes novas para música (energético, dançante, introspectivo).
  O catálogo base tem 17 álbuns, 5 brasileiros. Álbum não tem nota pública no prior de qualidade (neutro) e "em andamento" vira "faixa em que você parou".
  O MusicBrainz limita a cerca de 1 pedido por segundo por IP e exige User-Agent identificável. "Descobrir" álbuns usa só tags votadas por várias pessoas, mas o
  MusicBrainz não ordena por popularidade, então a qualidade dessa lista é a parte mais provável de precisar de ajuste.
- **Capas reais**: pôsteres do TMDB, capas do IGDB e do AniList. Itens do catálogo base buscam a capa uma vez (`/api/cover`) e guardam no aparelho. Sem chave ou sem imagem, fica a capa gerada.
- **Resenha e diário**: em cada obra registrada, resenha (até 2000 caracteres) e a data em que você viu ou jogou. O Diário mostra tudo mês a mês.
- **Listas**: crie listas misturando mídias e adicione itens pela página de cada obra.
- **Estatísticas**: totais por mídia e status, nota média, distribuição das notas, concluídos por mês e as vibes que mais pesam no seu gosto.
- **Página da obra com personalidade própria**: o fundo e os realces (botões, vibes, estrelas) usam a tonalidade dominante da capa, lida num canvas no aparelho. Se a imagem não permitir leitura (CORS) ou não houver capa, o tom vem das vibes do título. Contraste mínimo de 4,5:1 garantido em qualquer cor, nos dois temas (`src/lib/palette.ts`).
- **Tema escuro**: segue o sistema; em Perfil dá para forçar Claro ou Escuro. Contraste conferido por script (`e2e/e2e_tema.py`).
- **Instalável** na tela inicial (PWA).
- **Busca e sugestões em catálogos reais**: AniList (sempre ligado, sem chave), TMDB (filmes e séries) e IGDB (jogos) quando as chaves
  estiverem no `.env.local` (veja `.env.example`). Cada fonte falha sozinha: se uma cair, as outras e o catálogo local continuam.
- **Métricas somadas com consentimento**: desligadas por padrão; ao aceitar (Importar ou Perfil), o app envia ao Supabase só tipo do evento,
  números simples e um código anônimo do aparelho. Excluir os dados apaga o código.
- **Privacidade**: exportar e excluir todos os dados (LGPD).

## Publicar (Vercel)

1. Descompacte o zip, entre na pasta e rode `npx vercel` (faz login e cria o projeto) ou envie a pasta para um repositório no GitHub e importe em vercel.com/new.
2. Em Settings → Environment Variables, cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (as duas já estão no seu `.env.local`),
   `TMDB_READ_TOKEN`, `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`. As `NEXT_PUBLIC_*` precisam existir **antes** do build.
3. No celular, abra o link e use "Adicionar à tela inicial": o app é instalável (PWA, `src/app/manifest.ts`).

## O que ainda NÃO está feito (e o que isso significa)

| Falta | Consequência hoje |
|---|---|
| **Importação testada com o AniList de verdade** | O código segue a API pública e foi testado com um servidor simulado. Teste com um usuário público real antes de qualquer coisa. |
| **Open Library, AniList (mangá) e MusicBrainz de verdade** | Testados só com servidor simulado. Busque "Dom Casmurro", "Berserk" e "OK Computer" e confira capa, autor e tags. Para álbuns, veja também a aba Descobrir. O Open Library pede um User-Agent identificável: troque o contato em `src/lib/sources.ts` antes de divulgar. |
| **TMDB e IGDB com chaves reais** | O código foi testado só com servidores simulados. Peça o token de leitura do TMDB e as credenciais do IGDB (Twitch), coloque no `.env.local` e teste buscando "Duna" e "Elden Ring". A consulta de "descobrir" do IGDB (filtro por gênero e tema) é a mais provável de precisar de ajuste. |
| **Contas, sincronização e comunidade com o Supabase de verdade** | Código completo (`src/lib/cloud.ts`, `community.ts`, telas Conta no Perfil, `/comunidade` e `/u/[handle]`). O esquema e as regras de acesso (RLS) **estão aplicados e foram testados no banco real por SQL**. Já o fluxo do navegador (cadastro, e-mail de confirmação, login, sync, seguir) foi testado só contra um servidor simulado (`e2e/mock.mjs`): **nunca rodou com o Auth real**. Faça o roteiro "Ligar as contas" abaixo e teste com duas contas em dois aparelhos antes de convidar alguém. |
| **Consulta das métricas somadas** | Os dados chegam em `test_events`; ninguém lê pela API pública. Some pelo SQL Editor do Supabase (veja `supabase/metricas.sql`). |
| **Importações de MyAnimeList e Letterboxd com dados reais** | Testadas com arquivos de exemplo e servidores simulados. Teste com o seu export de verdade, principalmente o formato do `animelist.xml`. |
| **Afinidade de gosto** | Fórmula simples e explicável (notas nas mesmas obras + vibes, ver `src/lib/social.ts`), com testes de propriedades. Não foi validada com pessoas reais; trate o número como um palpite divertido, não como medida. |
| **Tempo de relógio entre aparelhos** | A sincronização resolve conflitos por carimbo de tempo por registro. Se o relógio de um aparelho estiver muito errado, a edição dele pode "ganhar" ou "perder" injustamente. Listas são resolvidas por lista inteira (a última edição vence). |

## Como a recomendação funciona

1. Cada item tem de 3 a 6 vibes de um vocabulário comum de 30 termos (`src/lib/vibes.ts`).
2. O gosto do usuário soma as vibes dos itens avaliados, com peso `nota - 3` (nota 3 é neutra, abaixo pesa contra).
   Concluído sem nota vale +0,5, abandonado vale -1 e "Quero ver" não entra. "Não é pra mim" tira 1 de cada vibe do item.
3. Cada candidato recebe a soma do gosto nas suas vibes, dividida pela raiz do número de vibes, com bônus de 15% quando o motivo vem de outra mídia.
4. O motivo é o item da biblioteca que mais contribuiu; as vibes citadas são as que os dois têm em comum.

A tabela de vibes é a parte que mais precisa de revisão humana: se ela estiver ruim, as sugestões ficam estranhas.

## Detalhes da obra e "O que ver hoje?"

- A página de cada obra mostra sinopse, elenco ou estúdio, nota na fonte, onde assistir no Brasil (assinatura) e link do trailer. Os dados vêm de `/api/details`, que consulta TMDB, IGDB ou AniList no servidor. **Sem as chaves do TMDB/IGDB, filmes e jogos mostram só um aviso discreto**; anime funciona sem chave.
- Em Descobrir, "O que ver hoje?" sorteia entre as 5 melhores sugestões, com filtros de origem (algo novo ou da sua lista de quero ver), mídia e clima.
- Esse comportamento só foi testado contra respostas simuladas das APIs, não contra as APIs reais.

## Navegação e computador

- Em telas a partir de 900 px o menu vira barra lateral, o registro vira janela no centro e as listas ficam em duas colunas.
- **Buscar** (menu ou tecla `/`): busca global com "+ Quero ver" em um toque e desfazer.
- Biblioteca: ordenar (recentes, nota, A–Z, ano), filtrar pelo título (sem acento) e alternar lista/grade.
- Progresso em "em andamento": episódio (anime e séries) ou horas jogadas, aparece na biblioteca.
- Teste no navegador: `python3 e2e/e2e_nav.py`.

## Perfil

Nome editável, **foto de perfil e banner** (envio de JPG/PNG/WebP com zoom e enquadramento por arrastar ou controles; a imagem é recortada e
reencodada no aparelho, o que remove EXIF/GPS, e fica só no navegador; sem foto, iniciais numa cor à escolha; banner automático pelo seu gosto, degradê por mídia ou
imagem; tudo aparece também no cartão), arquétipo pelo gosto ("Explorador do lado escuro"), sequência semanal, gráfico das vibes por mídia, o que liga as mídias da pessoa,
favoritos, 10 conquistas com progresso, meta do ano, **cartão em imagem** para compartilhar (gerado no aparelho) e uma área **Conexões** que mostra quais
chaves (TMDB, IGDB) estão ativas, sem nunca expor o valor delas. Testes: `python3 e2e/e2e_perfil.py` e `python3 e2e/e2e_foto.py`.

## Recomendação

O recomendador v2 (nota relativa à pessoa, encolhimento, decaimento, afinidade por mídia, nota pública, diversidade) está descrito em `docs/recomendacao.md`,
junto com o protocolo de avaliação, os resultados e o que eles não provam. Para rodar o laboratório: `npx tsx scripts/eval-full.ts` (cerca de 7 minutos) ou `npx tsx scripts/eval-tradeoff.ts` (1 minuto).

## Testes

- `npm test`: lógica pura, em `src/lib/__tests__`.
- `e2e/`: fluxo completo no navegador (importar, favoritos, sugestões, registro, desfazer, exportar, excluir, 360 px).
  Precisa de `pip install playwright`. Passos: `node e2e/mock.mjs` (imita AniList, TMDB, IGDB, Twitch e o Supabase na porta 4010), depois
  `npm run build` e `npm start -p 3100` com `ANILIST_URL`, `TMDB_BASE`, `IGDB_BASE` e `TWITCH_TOKEN_URL` apontando para
  `http://localhost:4010` (`TWITCH_TOKEN_URL` com `/oauth2/token`), `TMDB_READ_TOKEN=tmdbtoken`, `IGDB_CLIENT_ID=cid`,
  `IGDB_CLIENT_SECRET=csecret` e `NEXT_PUBLIC_SUPABASE_URL=http://localhost:4010` (esta no `build`). Reinicie o mock antes de cada
  script e rode `python3 e2e/e2e.py`, `python3 e2e/e2e_remote.py` (inclui as importações por arquivo, em `e2e/fixtures`) `python3 e2e/e2e_tema.py` e `python3 e2e/e2e_obra.py`, `python3 e2e/e2e_diario.py` e `python3 e2e/e2e_detalhes.py` (detalhes da obra e "O que ver hoje?"). Essas variáveis só existem para o teste. O mock também imita o Open Library (`OPENLIB_BASE=http://localhost:4010`). **Atalho:** `bash e2e/run.sh` faz tudo isso e roda todos os scripts, um por vez (`bash e2e/run.sh e2e/e2e_foto.py` roda só um; precisa de `MUSICBRAINZ_BASE=http://localhost:4010`, que o script já define).

## Observações técnicas

- Next.js 16: o scaffold vem com Cache Components ligado, que exige `Suspense` em todo hook de rota. Como o app é todo no cliente, foi desligado em `next.config.ts`.
- O armazenamento fica atrás de `src/lib/store.ts` (`useLibrary` + ações). O app é local primeiro: a conta é opcional e o sync (`src/lib/cloud.ts`) só faz *merge* (soma) entre aparelho e nuvem, sem nunca apagar dado local por conta própria. As regras do merge estão em `src/lib/sync.ts` e têm testes de propriedade (comutativo, idempotente, associativo).
- Termos de uso: AniList, TMDB e IGDB mudam as regras e pedem atribuição; confira antes de qualquer uso comercial.


## Ligar as contas (Supabase) — passo a passo

1. **Esquema:** já está aplicado no projeto `hobby-mvp`. Num projeto novo, rode `supabase/schema.sql` e `supabase/metricas.sql` no SQL Editor.
2. **Chaves:** copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings > API Keys). Nunca use a chave `service_role` no app.
3. **Authentication > URL Configuration:** ponha em *Site URL* o endereço do app (ex.: `https://seu-app.vercel.app`) e em *Redirect URLs* `https://seu-app.vercel.app/**` e `http://localhost:3000/**`. Sem isso o link do e-mail de confirmação aponta para o lugar errado.
4. **Authentication > Providers > Email:** deixe *Confirm email* ligado. Em *Password*, suba o mínimo para 8 e ligue a **proteção contra senhas vazadas** (Leaked password protection; pode exigir plano Pro).
5. **E-mail:** o envio padrão do Supabase é limitado (poucos e-mails por hora) e serve só para testar. Para convidar mais gente, configure um SMTP próprio em *Authentication > SMTP Settings* e traduza os modelos em *Email Templates*.
6. **Vercel:** cadastre as mesmas variáveis em *Settings > Environment Variables* e faça o deploy (feito por você; nenhuma chave passa por mim).
7. **Teste:** crie uma conta no celular, registre algo, abra o app no notebook, entre na mesma conta e veja os registros juntarem. Publique o perfil em Comunidade com um segundo usuário e siga.

### Resenhas e discussão

Escreva a resenha ao registrar (ou depois, na página da obra). Se o seu perfil for público **e** "Mostrar também minhas resenhas" estiver marcado, ela aparece no seu perfil, no feed de quem te segue e na página da obra, em "O que a comunidade achou". Qualquer registro público tem um botão **Comentários** que abre a conversa. Quem tem perfil público comenta (até 500 caracteres; texto puro, nada de HTML). O autor apaga o próprio comentário e **você apaga qualquer comentário no seu perfil**. Em "Comunidade" há a lista "Comentários no seu perfil". Despublicar ou remover o registro apaga a conversa junto (cascata no banco). Há um freio de 10 comentários por minuto por pessoa.

**O que ainda não existe:** denunciar, bloquear alguém, notificações (você vê os comentários novos ao abrir Comunidade), respostas aninhadas e edição de comentário. Para um grupo pequeno de colegas, apagar comentários no próprio perfil basta. Antes de abrir para desconhecidos, isso precisa ser feito.

### Projeto Supabase gratuito pausa

No plano gratuito o Supabase **pausa o projeto depois de cerca de uma semana sem uso**. Pausado, o login e a sincronização falham (o app local continua). Durante o desenvolvimento isso já aconteceu uma vez: reative em *Dashboard > Restore project* (leva alguns minutos). Para apresentar o Hobby, entre no app dois dias antes. Para uso real, o plano Pro não pausa.

### O que a parte social expõe

Por padrão **nada** é público. Quem publica mostra nome, foto, bio, números por mídia, vibes mais fortes e os registros mais recentes (título, status e nota, até 200). Resenhas só com a opção marcada. Despublicar apaga a atividade. "Excluir minha conta" apaga conta, nuvem, perfil, atividade e seguidos. O banco impede, por regras de acesso, que alguém leia a biblioteca de outra pessoa, ou publique/siga em nome de outra.
