-- Moderação do Hobby: rode no SQL Editor do Supabase (você é a única pessoa com acesso; o app não tem painel).
-- Os comandos de leitura são seguros. Os de ação estão comentados: descomente um de cada vez e troque o <id>.

-- 1) Comentários denunciados, os mais denunciados primeiro (hidden = true quando 3+ pessoas denunciaram)
select c.id, c.hidden, count(distinct r.reporter) as denuncias,
       string_agg(distinct r.reason, ', ') as motivos,
       left(c.body, 120) as trecho, pa.handle as autor, pt.handle as no_perfil_de, max(r.created_at) as ultima
from public.reports r
join public.comments c on c.id = r.comment_id
left join public.profiles pa on pa.id = c.author_id
left join public.profiles pt on pt.id = c.target_user
group by c.id, c.hidden, c.body, pa.handle, pt.handle
order by denuncias desc, ultima desc
limit 50;

-- 2) Quem mais recebe denúncias (reincidentes)
select pa.handle, count(distinct r.comment_id) as comentarios_denunciados, count(distinct r.reporter) as denunciantes
from public.reports r
join public.comments c on c.id = r.comment_id
left join public.profiles pa on pa.id = c.author_id
group by pa.handle
order by comentarios_denunciados desc
limit 20;

-- 3) AÇÃO: a denúncia era injusta. Reexibe o comentário e limpa as denúncias dele
-- update public.comments set hidden = false where id = '<id>';
-- delete from public.reports where comment_id = '<id>';

-- 4) AÇÃO: apagar o comentário de vez (as denúncias dele somem junto, por cascata)
-- delete from public.comments where id = '<id>';

-- 5) AÇÃO: tirar um perfil da vitrine pública (some da busca, do feed e dos comentários dele para terceiros)
-- update public.profiles set is_public = false where handle = '<handle>';

-- 6) AÇÃO (grave): apagar a conta inteira de alguém que abusa. Apaga perfil, biblioteca, atividade, comentários e denúncias dela.
-- delete from auth.users where id = (select id from public.profiles where handle = '<handle>');
