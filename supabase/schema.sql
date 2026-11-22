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
  status text not null check (status in ('quero','andamento','concluido','abandonei','pausei')),
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


-- ===== Etapa 6: moderação (bloquear pessoas, denunciar comentários). Já aplicado no projeto "hobby-mvp"; também em supabase/migrations/stage6_moderation.sql =====
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

-- Etapa 7: quem me segue pode ser lido por mim (para "novos seguidores").
-- Antes só era possível ler as linhas em que EU era o seguidor.
-- Efeito: cada pessoa vê a lista de quem a segue (todos têm perfil público); nada além disso.
create policy follows_select_incoming on public.follows for select to authenticated
  using (followee_id = (select auth.uid()));
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
