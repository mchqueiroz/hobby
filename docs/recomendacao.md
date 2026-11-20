# Recomendação do Hobby: método, avaliação e limites

Este documento descreve o recomendador v2, como foi avaliado e o que os resultados **não** provam. Os números vêm de
`scripts/eval-full.ts` e `scripts/eval-tradeoff.ts` (rodar com `npx tsx scripts/eval-full.ts`).

## O método (v2)

Entrada: histórico da pessoa (status, nota, data), vibes das obras e, quando existe, a nota pública da obra (TMDB, IGDB, AniList).

1. **Nota relativa à própria pessoa, com encolhimento.** Cada nota vira (nota − média da pessoa) / dispersão da pessoa, com média e dispersão puxadas para um valor a priori quando há poucas notas. Quem dá 5 em tudo não tem tudo "positivo". Origem: viés de usuário em filtragem colaborativa (Koren e Bell).
2. **Sinais negativos e fracos.** Abandonei, "não é pra mim", concluído sem nota e em andamento sem nota têm valores próprios.
3. **Decaimento no tempo.** O peso de cada registro cai pela metade a cada 720 dias. Registros importados, sem data, contam como de um ano atrás.
4. **Afinidade por vibe como média encolhida**, e não soma. Poucas evidências valem pouco. Misturada (25%) com uma vizinhança por conteúdo (kNN sobre as vibes).
5. **Afinidade por mídia aprendida por pessoa**, no lugar do bônus fixo de 15% entre mídias do método antigo. Motivo: a literatura de recomendação entre domínios aponta a transferência negativa como risco central.
6. **Prior de qualidade da obra**, a nota pública padronizada por mídia, com peso 0,35. Sem nota suficiente vale zero.
7. **Reordenação por diversidade (MMR, λ = 0,8)** no topo da lista, mais o teto de 2 por mídia que já existia.

A explicação "Porque você deu X★ a Y" vem do item do histórico que mais pesou na vizinhança.

## Como foi avaliado

Não há ainda dados de pessoas reais em volume. O laboratório (`src/lib/rec/`) gera um **mundo sintético com verdade conhecida**:
obras com vetor latente e qualidade, vibes como visão ruidosa do vetor, pessoas com gosto, viés e escala de nota, afinidade por mídia,
transferência entre mídias, deriva de gosto e viés de seleção (as pessoas veem o que esperam gostar e o que é popular).

Protocolo (seguindo as recomendações de Widespread Flaws in Offline Evaluation):
- divisão por tempo, por pessoa (70% mais antigos para treino, 30% para teste);
- ranking do catálogo inteiro que a pessoa não viu, sem amostragem de negativos;
- popularidade calculada só com dados de treino;
- ajuste de hiperparâmetros em mundos de validação (sementes 101–103) e resultado em mundos de teste (sementes 1–5), diferentes;
- intervalos de confiança de 95% por bootstrap de diferenças pareadas por pessoa.

Métricas: NDCG@10 contra a utilidade verdadeira de todo o catálogo ("oráculo"), o mesmo só na cauda (sem os 20% de obras mais populares),
acerto@10 contra o que a pessoa de fato viu depois ("logged", sujeito a viés de seleção), diversidade, novidade e quantas mídias aparecem no topo.

> Nota sobre o v1: o baseline do laboratório é uma cópia congelada do método antigo (`legacy.ts`), que o app não usa mais.
> Por um tempo o harness chamou `recommend()`, que já é o v2 integrado, e o "v1" medido saiu 0,320 em vez de 0,229. Isso foi corrigido
> e conferido com `scripts/eval-tradeoff.ts` (v1 0,229, popularidade 0,557, v2 0,640). O laboratório continua usando só as três mídias originais e os 30 vibes originais
> (anime, jogo, filme); mangá, livro, música e os vibes novos entram quando houver dados reais.

## Resultados (5 mundos de teste, 1250 pessoas)

| método | oráculo | cauda | hit@10 logged |
|---|---|---|---|
| popularidade | 0,560 | 0,337 | 0,513 |
| método antigo (v1, congelado em `src/lib/rec/legacy.ts`) | 0,229 | 0,299 | 0,101 |
| v2 com parâmetros padrão | 0,619 | 0,499 | 0,535 |
| **v2 ajustado** | **0,641** | **0,522** | 0,534 |

- **Sem o prior de qualidade** (caso em que a obra não tem nota pública): v2 0,315 e cauda 0,400, contra 0,229 e 0,299 do método antigo. É o ganho que sobra só do lado pessoal.
- **Ablação** (queda no oráculo ao tirar cada ideia): prior de qualidade −0,327; encolhimento por vibe −0,093; afinidade por mídia aprendida −0,041 (e o bônus fixo antigo é pior, −0,064); nota relativa −0,022; decaimento −0,003; kNN −0,001 (soma por vibe encolhida é praticamente equivalente); IDF sem efeito (desligado).
- **Diversidade:** λ = 0,8 sobe a diversidade de 0,771 para 0,785 e custa 0,001 de oráculo.
- **Robustez:** em 13 variações do mundo (ruído nas vibes, deriva, viés de nota, transferência entre mídias, peso da qualidade, viés de seleção, pouco histórico), o v2 ficou acima do melhor baseline em todas, com o IC95 da diferença acima de zero (de +0,047 a +0,125 no oráculo).
- **Começo a frio:** com 3 a 9 itens o v2 já fica acima (0,604 contra 0,576 da popularidade e 0,214 do método antigo), mas a vantagem sobre a popularidade é pequena nessa faixa.

## O que isto NÃO prova

- É um mundo sintético construído por nós. Mostra que o método funciona **sob essas suposições** e ajuda a ver quais ideias importam, não que funciona com pessoas reais.
- O prior de qualidade é a ideia de maior efeito, e seu efeito depende de a popularidade ou a nota pública realmente prever o gosto. No mundo real essa relação pode ser mais fraca. Com qualidade "quase irrelevante" no mundo sintético o v2 ainda supera o método antigo (0,465 contra 0,345), mas a popularidade cai muito.
- Dois parâmetros de produção (IDF desligado e λ de diversidade = 0,8) foram escolhidos olhando mundos de teste (sementes 1–3), então a avaliação neles tem uma contaminação pequena.
- O "logged" mede aderência ao que as pessoas escolheram, que é enviesado pelo que foi exposto. Por isso o oráculo é a métrica principal, e ele só existe no sintético.
- O kNN e o decaimento quase não mudaram o resultado aqui. Em dados reais podem pesar mais, ou nada.
- No app, as obras do catálogo base não têm nota pública, então só o lado pessoal (nota relativa, encolhimento, decaimento, mídia, diversidade) age sobre elas. O prior vale para itens vindos das APIs.

## Próximos passos para virar referência

1. **Dados reais.** Rodar o laboratório sobre históricos reais (MyAnimeList, Letterboxd, Steam), com consentimento, no mesmo formato de `Interaction`.
2. **Medida online.** Usar a telemetria já existente (aceitar no "O que ver hoje", dispensar, registrar depois) e testes A/B contra o método antigo.
3. **Sinal coletivo** (quem gostou de A gostou de B) quando houver contas e usuários.
4. **Onboarding por texto livre** com modelo de linguagem, que a literatura aponta como competitivo no começo a frio (resultado de um estudo pequeno, só com filmes, em inglês).
5. **Exploração** (Thompson Sampling com prior dinâmico para itens novos), a validar com dados online.
6. **Publicar** o protocolo e o benchmark com dados reais anonimizados.

## Referências

- Survey de recomendação entre domínios (2025): https://arxiv.org/abs/2503.14110
- LLMs como recomendadores em quase começo a frio: https://arxiv.org/abs/2307.14225
- Widespread Flaws in Offline Evaluation of Recommender Systems: https://arxiv.org/abs/2307.14951
- Dynamic Prior Thompson Sampling para exploração: https://arxiv.org/abs/2602.00943
- Cold-start na era dos LLMs: https://arxiv.org/abs/2501.01945
- Kaminskas e Bridge, Diversity, Serendipity, Novelty and Coverage (2016)
- Koren e Bell, Advances in Collaborative Filtering (viés de usuário e de item; citado de memória, não consultado nesta pesquisa)
