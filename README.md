# Hobby

Um perfil para registrar anime, mangá, jogos, filmes e séries e livros, com recomendações que cruzam mídias ("porque você deu 5★ a X (anime), veja Y (jogo)").

## Rodar

Precisa de Node 22 (a mesma versão do CI).

```bash
npm install
cp .env.example .env.local   # opcional, veja "Variáveis" abaixo
npm run dev                  # http://localhost:3000
```

Sem nenhuma chave o app já funciona: AniList (anime, mangá), Open Library (livros) e Steam (jogos de PC) não pedem chave, e os dados ficam no aparelho. Para ver rápido sem importar nada, toque em **Ver com dados de exemplo** na tela inicial.

### No celular

- **Janela de celular no notebook:** `npm run celular` (abre 390×844 no Chrome/Chromium/Brave/Edge). Também dá pelo F12 e depois Ctrl+Shift+M.
- **Celular de verdade, na mesma rede Wi-Fi:** `npm run iphone` e abra `http://IP-DO-NOTEBOOK:3000`. O `next dev` bloqueia acesso pelo IP da rede, por isso este comando roda em modo produção. No Fedora, libere a porta com `sudo firewall-cmd --add-port=3000/tcp`.

## Variáveis (`.env.local`)

| Variável | Para quê | Sem ela |
|---|---|---|
| `TMDB_READ_TOKEN` | filmes e séries (themoviedb.org/settings/api) | sem busca de filmes e séries; a importação do Letterboxd não funciona |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | jogos de todas as plataformas (app em dev.twitch.tv/console) | jogos vêm da loja da Steam (sem chave, só PC) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | conta, sincronização e parte social | o app funciona só no aparelho |
| `NEXT_PUBLIC_SITE_URL` | links de compartilhamento e sitemap | usa o endereço local |
| `CRON_SECRET` | só o cron da Vercel chama `/api/keepalive` | a rota fica aberta (inofensiva) |
| `CONTACT_URL`, `NEXT_PUBLIC_CONTACT_URL`, `NEXT_PUBLIC_FEEDBACK_URL` | contato no User-Agent, na página de privacidade e no botão de feedback | valores padrão; sem o botão de feedback |

Use a chave **publishable** do Supabase, nunca a `service_role`.

### Supabase (opcional)

1. No SQL Editor, rode `supabase/schema.sql`, `supabase/metricas.sql`, `supabase/moderacao.sql` e depois os arquivos de `supabase/migrations/` em ordem numérica (stage6 → stage12).
2. Em *Authentication > URL Configuration*, ponha o endereço do app em *Site URL* e, em *Redirect URLs*, `https://SEU-APP/**` e `http://localhost:3000/**`. Sem isso os links de confirmação e de nova senha apontam para o lugar errado.
3. Login com Google ou Apple: ligue o provedor em *Authentication > Providers*. O botão aparece no app sozinho, sem novo deploy (o app lê `/auth/v1/settings`).
4. Para testar: crie uma conta, registre algo, entre na mesma conta em outro aparelho e confira que os registros se juntam.

## Testar

```bash
npm test             # testes de lógica (vitest, src/lib/__tests__)
npm run typecheck    # tipos
npm run lint
npm run build
```

O CI (`.github/workflows/ci.yml`) roda lint, tipos, testes e build a cada push.

### E2E (navegador)

```bash
pip install playwright && playwright install chromium
bash e2e/run.sh                     # todos os scripts
bash e2e/run.sh e2e/e2e_social.py   # só um
```

O `run.sh` sobe `e2e/mock.mjs` na porta 4010, que imita AniList, TMDB, IGDB, Open Library, MusicBrainz e Supabase. Depois compila o app apontando para o mock, serve na porta 3100 e roda cada script com o mock reiniciado. Nenhuma chave real é usada. Os logs ficam em `/tmp/e2e-*.log` e `/tmp/last-e2e.log`.

## Como funciona

- **Local primeiro:** a biblioteca fica no aparelho (`src/lib/store.ts`). Com uma conta, `src/lib/cloud.ts` junta aparelho e nuvem sem apagar nada local (regras em `src/lib/sync.ts`).
- **Telas:** Início (painel do dia; vazio, só importar e adicionar o primeiro item), Buscar, Descobrir, Social e Perfil. O Perfil reúne o cartão, a vitrine e a biblioteca (com Diário, Lançamentos, Listas e Estatísticas); conta, meta, tema e dados ficam em Ajustes (engrenagem). No celular o "+" fica no canto superior direito.
- **Música saiu do app:** registros antigos de álbuns continuam guardados, mas não aparecem (`isActiveMedia` em `src/lib/types.ts`). O código do MusicBrainz e do Deezer ficou desligado em `src/lib/sources.ts`.
- **Catálogos:** as rotas `src/app/api/*` buscam no AniList, TMDB, IGDB (ou Steam, sem chave) e Open Library. A busca ordena por relevância alternando as mídias e tem filtro por mídia. Cada fonte falha sozinha: se uma cair, as outras e o catálogo local continuam. `src/proxy.ts` limita requisições por IP.
- **Importação:** AniList (nome de usuário), MyAnimeList (`animelist.xml`/`.gz`), Letterboxd (CSVs do export) e Goodreads ou StoryGraph (CSV, livros achados no Open Library). Os arquivos são lidos no aparelho. No primeiro uso dá para escrever os favoritos ("Dark, Persona 5, Kafka à beira-mar") e cada um é buscado nas fontes reais.
- **Recomendação** (`src/lib/recommend.ts`, `src/lib/rec/`):
  1. Cada obra tem de 3 a 6 "vibes" tiradas de um vocabulário comum (`src/lib/vibes.ts`).
  2. O gosto soma as vibes das obras avaliadas, com peso `nota − 3`. Concluída sem nota vale +0,5, abandonada vale −1, e "Não é pra mim" desconta.
  3. Cada candidata recebe a soma do gosto nas suas vibes, normalizada pelo número de vibes, com bônus quando o motivo vem de outra mídia. A explicação mostra a obra da biblioteca que mais contribuiu.
- **Do benchmark** (`docs/BENCHMARK.md`): vitrine com 4 obras fixadas no perfil (também no público), fila "A seguir" no Início, plataforma ou formato por registro com filtro na Biblioteca, tempo dedicado estimado em Estatísticas e lista compartilhada por link (`/listas/ver#d=…`, a lista vai no fragmento e não passa pelo servidor).
- **Social** (precisa do Supabase): perfis públicos, seguir, resenhas, discussão com respostas, curtidas, denúncia/bloqueio e painel de moderação.
- **Supabase acordado:** `vercel.json` agenda `/api/keepalive` uma vez por dia (protegido por `CRON_SECRET`), porque o plano gratuito pausa após ~7 dias sem uso.
- **Falhas de fonte:** saem no log da Vercel como `[hobby-fonte]`; erros do navegador como `[hobby-erro]`.
- **Offline/PWA:** instalável; `public/sw.js` serve `public/offline.html` quando não há rede.
- **Next.js 16:** Cache Components está desligado em `next.config.ts` porque o app roda todo no cliente.
