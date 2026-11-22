-- Moderação: bloquear pessoas e denunciar comentários.

-- ---------- bloqueios ----------
create table public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);
alter table public.blocks enable row level security;
create policy blocks_select on public.blocks for select to authenticated using (blocker = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker = (select auth.uid()));
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;  -- criar bloqueio só pela função block_user

-- bloqueia e já desfaz o "seguir" nos dois sentidos
create or replace function public.block_user(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'alvo inválido' using errcode = '22023'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_user) on conflict do nothing;
  delete from public.follows where (follower_id = me and followee_id = p_user) or (follower_id = p_user and followee_id = me);
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- "esta pessoa me bloqueou?" (precisa ser security definer: quem foi bloqueado não enxerga a tabela)
create or replace function public.is_blocked_by(p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where blocker = p_user and blocked = auth.uid());
$$;
revoke all on function public.is_blocked_by(uuid) from public, anon;
grant execute on function public.is_blocked_by(uuid) to authenticated;

-- quem foi bloqueado não segue nem comenta no perfil de quem bloqueou
drop policy follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = followee_id and p.is_public)
    and not public.is_blocked_by(followee_id));

-- ---------- denúncias ----------
alter table public.comments add column hidden boolean not null default false;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  reason text not null check (reason in ('spam', 'ofensivo', 'outro')),
  created_at timestamptz not null default now(),
  unique (reporter, comment_id)
);
create index reports_comment_idx on public.reports (comment_id);
alter table public.reports enable row level security;
create policy reports_select on public.reports for select to authenticated using (reporter = (select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id and c.author_id <> (select auth.uid())));
revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;

-- teto de 20 denúncias por hora por pessoa (evita denúncia em massa)
create or replace function public.limit_report_rate() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'muitas denúncias em pouco tempo' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger reports_rate before insert on public.reports for each row execute function public.limit_report_rate();

-- 3 denúncias de pessoas diferentes escondem o comentário (o autor e o dono do perfil ainda o veem)
create or replace function public.hide_reported() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(distinct reporter) from public.reports where comment_id = new.comment_id) >= 3 then
    update public.comments set hidden = true where id = new.comment_id;
  end if;
  return new;
end $$;
revoke all on function public.hide_reported() from public, anon, authenticated;
create trigger reports_hide after insert on public.reports for each row execute function public.hide_reported();

-- ---------- comentários: esconder denunciados e bloqueados; barrar quem foi bloqueado ----------
drop policy comments_select on public.comments;
create policy comments_select on public.comments for select to anon, authenticated
  using (
    (author_id = (select auth.uid()) or target_user = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = comments.target_user and p.is_public))
    and (not hidden or author_id = (select auth.uid()) or target_user = (select auth.uid()))
    and not exists (select 1 from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = comments.author_id)
  );
drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and exists (select 1 from public.profiles p where p.id = comments.target_user and p.is_public)
    and not public.is_blocked_by(comments.target_user));
