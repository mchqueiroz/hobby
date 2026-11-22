-- Etapa 10: respostas (um nível) e edição de comentários.
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists edited_at timestamptz;
create index if not exists comments_parent_idx on public.comments (parent_id);

-- Resposta só vale para um comentário de nível 1 da mesma conversa.
create or replace function public.comments_check_parent() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare p record;
begin
  if new.parent_id is not null then
    select target_user, target_item, parent_id into p from public.comments where id = new.parent_id;
    if not found or p.parent_id is not null or p.target_user <> new.target_user or p.target_item <> new.target_item then
      raise exception 'resposta inválida' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.comments_check_parent() from public, anon, authenticated;
drop trigger if exists comments_parent_check on public.comments;
create trigger comments_parent_check before insert on public.comments for each row execute function public.comments_check_parent();

-- Só o autor edita, e só o texto (e a marca de edição).
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
grant update (body, edited_at) on public.comments to authenticated;
