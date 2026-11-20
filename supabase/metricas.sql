-- Métricas do teste do MVP. Rode no SQL Editor do Supabase (a API pública não lê esta tabela).

-- 1. Participantes e eventos
select count(distinct participant) as participantes, count(*) as eventos from public.test_events;

-- 2. Importações concluídas entre as iniciadas
select
  count(*) filter (where type = 'import_done')  as concluidas,
  count(*) filter (where type = 'import_start') as iniciadas,
  round(100.0 * count(*) filter (where type = 'import_done') / nullif(count(*) filter (where type = 'import_start'), 0), 1) as pct
from public.test_events;

-- 3. Tempo (ms) e toques para registrar
select
  percentile_cont(0.5) within group (order by (data->>'ms')::numeric)   as mediana_ms,
  percentile_cont(0.5) within group (order by (data->>'taps')::numeric) as mediana_toques,
  round(100.0 * count(*) filter (where (data->>'ms')::numeric <= 5000 and (data->>'taps')::numeric <= 2) / count(*), 1) as pct_ate_5s_e_2_toques
from public.test_events where type = 'register_save';

-- 4. Sugestões aceitas entre mídias diferentes
select
  count(*) filter (where (data->>'cross')::boolean) as aceitas_entre_midias,
  count(*) as aceitas_total
from public.test_events where type = 'rec_accept';

-- 5. Voltaram em outro dia (aproximação do retorno em 7 dias)
select count(*) as voltaram from (
  select participant from public.test_events group by participant
  having max(at::date) - min(at::date) >= 1
) t;
