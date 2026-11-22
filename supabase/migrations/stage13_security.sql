-- Etapa 13: fecha duas brechas de moderação.

-- 1) Editar segue as mesmas regras de comentar: quem foi bloqueado pelo dono do perfil não edita,
--    e comentário escondido por denúncia não pode ser reescrito (o autor ainda o vê e pode apagar).
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and not hidden)
  with check (author_id = (select auth.uid())
    and not hidden
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and not public.is_blocked_by(comments.target_user));

-- 2) Para esconder sozinho, só contam denúncias de contas com perfil público e com pelo menos 3 dias.
--    Contas novas ainda denunciam (a denúncia vai para /moderacao), só não escondem nada por conta própria.
create or replace function public.hide_reported() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(distinct r.reporter)
        from public.reports r
        join auth.users u on u.id = r.reporter
        join public.profiles p on p.id = r.reporter
       where r.comment_id = new.comment_id
         and p.is_public
         and u.created_at < now() - interval '3 days') >= 3 then
    update public.comments set hidden = true where id = new.comment_id;
  end if;
  return new;
end $$;
revoke all on function public.hide_reported() from public, anon, authenticated;
