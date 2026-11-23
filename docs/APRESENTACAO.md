# Roteiro de apresentação (cerca de 7 minutos)

Endereço: https://hobby-omega-pied.vercel.app

## Antes da aula

- Abra o endereço no navegador que vai ao projetor e toque em **Ver com dados de exemplo** uma vez: a biblioteca fica pronta com animes, mangás, jogos, filmes e livros.
- Para mostrar a versão de celular no notebook: F12 e depois Ctrl+Shift+M (escolha um iPhone). Ou abra no seu celular e espelhe a tela.
- Plano B sem internet: o app abre offline as telas já visitadas e a biblioteca fica no aparelho. Visite Início, Descobrir e Perfil antes de começar.
- Não crie conta ao vivo: o e-mail de confirmação depende do Supabase e pode demorar.

## O problema (1 min)

Cada mídia tem o seu app: Letterboxd para filmes, MyAnimeList para anime, Goodreads para livros, Backloggd para jogos. O gosto da pessoa fica espalhado, e nenhum deles sugere um jogo a partir de um anime.

## Demonstração (4 min)

1. **Apresentação** (`/`): a promessa em uma frase. Toque em **Ver com dados de exemplo**.
2. **Descobrir**: aponte a explicação de cada sugestão, por exemplo "Porque você deu 5★ a Berserk (mangá): os dois são sombrio e jornada épica". Esse é o diferencial: a recomendação cruza mídias e diz por quê. Mostre o filtro por mídia.
3. **Buscar**: digite "Harry Potter". Livro, filme e jogo aparecem juntos, ordenados por relevância.
4. **Registrar** (botão + flutuante no canto de baixo): escolha uma obra e dê nota em dois toques. Mostre o "Desfazer".
5. **Obra** (toque em um jogo, como Hades): sinopse, nota, onde encontrar, obras parecidas, "Fixar na vitrine", "A seguir" e plataforma.
6. **Perfil**: cartão com o arquétipo do gosto, números por mídia, a vitrine e a biblioteca com filtros. Abra Estatísticas para o tempo dedicado e Retrospectiva para a imagem do ano.
7. **Importar** (opcional): explique que dá para trazer o histórico do AniList, MyAnimeList, Letterboxd, Goodreads e StoryGraph.

## Como foi feito (1 min)

- Next.js 16 e React, publicado na Vercel; contas e parte social com Supabase (opcional).
- Catálogos reais: AniList, TMDB, Steam e Open Library, cada fonte falhando sozinha sem derrubar as outras.
- Recomendação própria e explicável: vibes comuns entre mídias, nota relativa à pessoa, diversidade na lista (`docs/recomendacao.md`).
- Benchmark com Letterboxd, Trakt, StoryGraph, Backloggd e outros guiou as funções (`docs/BENCHMARK.md`).
- Testes: mais de 300 testes de lógica e 33 roteiros no navegador, incluindo acessibilidade (contraste AA) e segurança de conteúdo (CSP).

## Próximos passos (30 s)

Beta com 20 a 50 pessoas para medir se a recomendação entre mídias é útil (`docs/BETA.md`), jogos de console (chaves do IGDB) e notificações de lançamento.
