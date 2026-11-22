-- Etapa 12: curtidas em atividades (registros e resenhas públicos).
create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_user uuid not null,
  target_item text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_user, target_item),
  check (user_id <> target_user),
  foreign key (target_user, target_item) references public.activity (user_id, item_id) on delete cascade
);
create index if not exists likes_target_idx on public.likes (target_user, target_item);
alter table public.likes enable row level security;
create policy likes_select on public.likes for select to anon, authenticated
  using (
    (user_id = (select auth.uid()) or target_user = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = likes.target_user and p.is_public))
    and not exists (select 1 from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = likes.user_id)
  );
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and exists (select 1 from public.profiles p where p.id = likes.target_user and p.is_public)
    and not public.is_blocked_by(likes.target_user));
create policy likes_delete on public.likes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.likes from anon, authenticated;
grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;
