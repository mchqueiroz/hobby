# Hobby

Um perfil para registrar anime, mangá, jogos, filmes e séries, livros e álbuns, com recomendações que cruzam mídias ("porque você deu 5★ a X (anime), veja Y (jogo)").

## Rodar

Precisa de Node 22 (a mesma versão do CI).

```bash
npm install
cp .env.example .env.local   # opcional, veja "Variáveis" abaixo
npm run dev                  # http://localhost:3000
```

Sem nenhuma chave o app já funciona: AniList (anime, mangá), Open Library (livros) e MusicBrainz (música) não pedem chave, e os dados ficam no aparelho. Para ver rápido sem importar nada, toque em **Ver com dados de exemplo** na tela inicial.

### No celular

- **Janela de celular no notebook:** `npm run celular` (abre 390×844 no Chrome/Chromium/Brave/Edge). Também dá pelo F12 e depois Ctrl+Shift+M.
- **Celular de verdade, na mesma rede Wi-Fi:** `npm run iphone` e abra `http://IP-DO-NOTEBOOK:3000`. O `next dev` bloqueia acesso pelo IP da rede, por isso este comando roda em modo produção. No Fedora, libere a porta com `sudo firewall-cmd --add-port=3000/tcp`.

## Variáveis (`.env.local`)

| Variável | Para quê | Sem ela |
|---|---|---|
| `TMDB_READ_TOKEN` | filmes e séries (themoviedb.org/settings/api) | sem busca de filmes e séries; a importação do Letterboxd não funciona |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | jogos (app em dev.twitch.tv/console) | sem busca de jogos |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | conta, sincronização e parte social | o app funciona só no aparelho |
| `NEXT_PUBLIC_SITE_URL` | links de compartilhamento e sitemap | usa o endereço local |
| `CONTACT_URL`, `NEXT_PUBLIC_CONTACT_URL`, `NEXT_PUBLIC_FEEDBACK_URL` | contato no User-Agent, na página de privacidade e no botão de feedback | valores padrão; sem o botão de feedback |

Use a chave **publishable** do Supabase, nunca a `service_role`.

### Supabase (opcional)

1. No SQL Editor, rode `supabase/schema.sql`, `supabase/metricas.sql`, `supabase/moderacao.sql` e depois os arquivos de `supabase/migrations/` em ordem numérica (stage6 → stage12).
2. Em *Authentication > URL Configuration*, ponha o endereço do app em *Site URL* e `http://localhost:3000/**` em *Redirect URLs*.
3. Para testar: crie uma conta, registre algo, entre na mesma conta em outro aparelho e confira que os registros se juntam.

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
- **Catálogos:** as rotas `src/app/api/*` buscam no AniList, TMDB, IGDB, Open Library e MusicBrainz. Cada fonte falha sozinha: se uma cair, as outras e o catálogo local continuam. `src/proxy.ts` limita requisições por IP.
- **Importação:** AniList (nome de usuário), MyAnimeList (`animelist.xml`/`.gz`) e Letterboxd (CSVs do export). Os arquivos são lidos no aparelho.
- **Recomendação** (`src/lib/recommend.ts`, `src/lib/rec/`):
  1. Cada obra tem de 3 a 6 "vibes" tiradas de um vocabulário comum (`src/lib/vibes.ts`).
  2. O gosto soma as vibes das obras avaliadas, com peso `nota − 3`. Concluída sem nota vale +0,5, abandonada vale −1, e "Não é pra mim" desconta.
  3. Cada candidata recebe a soma do gosto nas suas vibes, normalizada pelo número de vibes, com bônus quando o motivo vem de outra mídia. A explicação mostra a obra da biblioteca que mais contribuiu.
- **Social** (precisa do Supabase): perfis públicos, seguir, resenhas, discussão com respostas, curtidas, denúncia/bloqueio e painel de moderação.
- **Offline/PWA:** instalável; `public/sw.js` serve `public/offline.html` quando não há rede.
- **Next.js 16:** Cache Components está desligado em `next.config.ts` porque o app roda todo no cliente.
