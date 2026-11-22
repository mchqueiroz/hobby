# Roteiro do beta fechado

Objetivo: trocar as hipóteses do pitch por números reais. Dois pontos têm de ser provados: **a pessoa volta ao app** e **a recomendação entre mídias é útil**.

## Quem convidar
- 20 a 50 pessoas que consomem **pelo menos três mídias** (filme, anime, jogo, livro, música). Comece por colegas da UFSCar e comunidades de nicho.
- Evite só amigos próximos: eles elogiam por educação. Peça a pelo menos 10 pessoas que você não conhece bem.

## Antes de convidar (checklist)
- [ ] App publicado e com domínio; `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_CONTACT_URL` configurados.
- [ ] Chaves reais de TMDB, IGDB e Supabase na Vercel; fazer **um cadastro completo de verdade** (e-mail de confirmação, login, recuperar senha, apagar conta).
- [ ] Abrir no iPhone e no Android: instalar na tela inicial, registrar uma obra, importar do Letterboxd.
- [ ] Você virou administrador (`docs/LAUNCH.md`, seção Moderação) e abriu `/moderacao`.
- [ ] Formulário de feedback configurado (`NEXT_PUBLIC_FEEDBACK_URL`).

## Duas semanas
| Dia | O que acontece |
|---|---|
| 0 | Convite com link e uma frase: "Registre o que você viu, jogou e leu e veja o que o Hobby sugere." Peça para **ativar as métricas** (opcional) no Perfil. |
| 1 | Mensagem: "Importou ou registrou pelo menos 10 obras? Abra Descobrir." |
| 3 | Pergunta curta no WhatsApp: "Alguma recomendação te fez falar 'nossa, boa'? Qual?" |
| 7 | Lembrete: "Veja Em breve (lançamentos) e a página Início." |
| 10 | Entrevista de 15 minutos com 5 pessoas (roteiro abaixo). |
| 14 | Formulário final e fechamento. |

## Entrevista (15 minutos)
1. Como você anota o que assiste, joga e lê hoje?
2. Mostre como você usou o Hobby na última vez. (Observe, não explique.)
3. Qual recomendação você aceitou? Qual achou ruim? Por quê?
4. O que faltou para você abrir de novo amanhã?
5. Você pagaria por algo no app? O quê, e quanto seria justo? (Pergunte o valor **antes** de dizer R$ 49,90.)
6. Para quem você mostraria o app?

## Métricas (com os eventos que o app já envia, só de quem aceitou)
| Pergunta | Evento | Meta inicial (hipótese) |
|---|---|---|
| Registrou algo? | `register_save` | 70% dos convidados |
| Importou histórico? | `import_done` | 30% |
| Viu recomendações? | `rec_view` | 60% |
| Aceitou alguma? | `rec_accept` ÷ `rec_view` | 15% ou mais |
| Voltou na semana 2? | pessoas com evento em dias diferentes | 30% |
| Pagaria? | pergunta 5 da entrevista | 2% a 5% dizem sim com valor |

Observação: as métricas só contam quem consentiu, então leia como **mínimo**. Combine com as respostas diretas.

## Como decidir depois
- **Voltou e aceita recomendações:** vá para lançamento público e corrija o que mais atrapalhou.
- **Registra, mas não volta:** invista em lembretes (lançamentos, retrospectiva) antes de mais funções.
- **Não registra:** o problema é a entrada (importação e primeiros 5 minutos), não a recomendação.
- Atualize o slide de números do pitch com o que você medir, e troque "hipótese" por "medido em beta com N pessoas".
