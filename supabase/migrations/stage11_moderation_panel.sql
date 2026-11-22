-- Etapa 11: painel de moderação. Administradores ficam numa tabela que ninguém lê pela API;
-- só as funções abaixo (security definer) consultam. Para virar admin, rode no SQL Editor:
--   insert into public.admins (user_id) values ('<seu uuid de auth.users>');
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Comentários denunciados, os mais denunciados primeiro.
create or replace function public.admin_reports()
returns table (comment_id uuid, body text, author_id uuid, author_handle text, target_user uuid, target_item text, hidden boolean, reports int, reasons text[], last_report timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'não autorizado' using errcode = '42501'; end if;
  return query
    select c.id, c.body, c.author_id, p.handle, c.target_user, c.target_item, c.hidden,
           count(r.id)::int, array_agg(distinct r.reason), max(r.created_at)
      from public.reports r
      join public.comments c on c.id = r.comment_id
      left join public.profiles p on p.id = c.author_id
     group by c.id, c.body, c.author_id, p.handle, c.target_user, c.target_item, c.hidden
     order by count(r.id) desc, max(r.created_at) desc
     limit 100;
end $$;
revoke all on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

-- hide: esconde; restore: mostra de novo e limpa as denúncias; delete: apaga o comentário.
create or replace function public.admin_moderate(p_comment uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'não autorizado' using errcode = '42501'; end if;
  if p_action = 'hide' then update public.comments set hidden = true where id = p_comment;
  elsif p_action = 'restore' then
    update public.comments set hidden = false where id = p_comment;
    delete from public.reports where comment_id = p_comment;
  elsif p_action = 'delete' then delete from public.comments where id = p_comment;
  else raise exception 'ação inválida' using errcode = '22023';
  end if;
end $$;
revoke all on function public.admin_moderate(uuid, text) from public, anon;
grant execute on function public.admin_moderate(uuid, text) to authenticated;
