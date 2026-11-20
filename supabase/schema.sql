-- Hobby: esquema de contas, sincronização e parte social (já aplicado no projeto "hobby-mvp").
-- Reconstituído do banco real (colunas, restrições, políticas, funções, gatilhos). Rode no SQL Editor de um projeto novo.
-- A tabela test_events (métricas anônimas) está em supabase/metricas.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  name text not null default '',
  bio text not null default '',
  color text,
  avatar text,
  avatar_thumb text,
  banner jsonb,
  stats jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  share_reviews boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handle ~ '^[a-z0-9_]{3,20}$'),
  check (handle <> all (array['admin','hobby','suporte','api','perfil','entrar','conta','comunidade','u','root','support'])),
  check (char_length(name) <= 40),
  check (char_length(bio) <= 160),
  check (color in ('anime','manga','jogo','filme','livro','musica')),
  check (avatar is null or (char_length(avatar) <= 300000 and avatar ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')),
  check (avatar_thumb is null or (char_length(avatar_thumb) <= 20000 and avatar_thumb ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')),
  check (banner is null or pg_column_size(banner) <= 300000),
  check (pg_column_size(stats) <= 8000)
);

-- cópia completa da biblioteca (privada). rev serve ao compare-and-set de save_library.
create table if not exists public.libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  rev integer not null default 1,
  updated_at timestamptz not null default now(),
  check (pg_column_size(data) <= 3000000)
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- vitrine pública: só existe para quem tem perfil público; resenha só com share_reviews.
create table if not exists public.activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) <= 120),
  item jsonb not null check (pg_column_size(item) <= 2000),
  status text not null check (status in ('quero','andamento','concluido','abandonei')),
  rating numeric check (rating is null or (rating >= 0.5 and rating <= 5)),
  review text check (review is null or char_length(review) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists activity_user_updated_idx on public.activity (user_id, updated_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger activity_touch  before update on public.activity  for each row execute function public.touch_updated_at();
create trigger profiles_touch  before update on public.profiles  for each row execute function public.touch_updated_at();
create trigger libraries_touch before update on public.libraries for each row execute function public.touch_updated_at();

-- grava a biblioteca só se a versão no banco ainda for a que o aparelho conhece (devolve a nova versão, ou null se houve conflito).
create or replace function public.save_library(p_data jsonb, p_expected integer) returns integer
language plpgsql set search_path = '' as $$
declare r integer;
begin
  if (select auth.uid()) is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if p_expected = 0 then
    insert into public.libraries (user_id, data, rev) values ((select auth.uid()), p_data, 1)
    on conflict (user_id) do nothing returning rev into r;
  else
    update public.libraries set data = p_data, rev = rev + 1, updated_at = now()
    where user_id = (select auth.uid()) and rev = p_expected returning rev into r;
  end if;
  return r;
end $$;

-- "Excluir minha conta": apaga o usuário; tudo acima some em cascata.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

alter table public.profiles  enable row level security;
alter table public.libraries enable row level security;
alter table public.follows   enable row level security;
alter table public.activity  enable row level security;

create policy profiles_select on public.profiles for select to anon, authenticated using (is_public or id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy libraries_select on public.libraries for select to authenticated using (user_id = (select auth.uid()));
create policy libraries_insert on public.libraries for insert to authenticated with check (user_id = (select auth.uid()));
create policy libraries_update on public.libraries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy libraries_delete on public.libraries for delete to authenticated using (user_id = (select auth.uid()));

create policy follows_select on public.follows for select to authenticated using (follower_id = (select auth.uid()));
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = followee_id and p.is_public));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy activity_select on public.activity for select to anon, authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = activity.user_id and p.is_public));
create policy activity_insert on public.activity for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and (review is null or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.share_reviews)));
create policy activity_update on public.activity for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and (review is null or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.share_reviews)));
create policy activity_delete on public.activity for delete to authenticated using (user_id = (select auth.uid()));

-- o app só precisa de select/insert/update/delete; RLS não limita TRUNCATE/TRIGGER/REFERENCES
revoke truncate, trigger, references on public.profiles, public.libraries, public.follows, public.activity from authenticated, anon;

-- ------------------------------ comentários (discussão) ------------------------------
-- Comentário em atividade pública. Some junto com a atividade (ON DELETE CASCADE): despublicar ou remover o registro apaga a conversa.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  target_user uuid not null,
  target_item text not null,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(btrim(body)) between 1 and 500),
  foreign key (target_user, target_item) references public.activity (user_id, item_id) on delete cascade
);
create index comments_target_idx on public.comments (target_user, target_item, created_at);
create index comments_author_idx on public.comments (author_id);
create index activity_item_review_idx on public.activity (item_id, updated_at desc) where review is not null;

alter table public.comments enable row level security;
create policy comments_select on public.comments for select to anon, authenticated
  using (author_id = (select auth.uid()) or target_user = (select auth.uid())
         or exists (select 1 from public.profiles p where p.id = comments.target_user and p.is_public));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_public)
    and exists (select 1 from public.profiles p where p.id = comments.target_user and p.is_public));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or target_user = (select auth.uid()));
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create or replace function public.limit_comment_rate() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.comments where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'muitos comentários em pouco tempo' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger comments_rate before insert on public.comments for each row execute function public.limit_comment_rate();
