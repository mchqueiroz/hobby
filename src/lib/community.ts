"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { makeThumb } from "./image";
import { readProfile } from "./profile";
import { getLibrary } from "./store";
import { buildStats, checkComment, countByThread, desiredActivity, diffActivity, handleError, MAX_BIO, normalizeHandle, parseActivity, parseComment, parseStats, type ActivityRow, type CommentRow, type PublicStats } from "./social";
import { MEDIAS, type Media } from "./types";

/**
 * Parte social: perfil público, seguir, feed. Tudo passa pelas regras (RLS) do banco, que é quem de fato protege:
 * só perfis marcados como públicos aparecem para os outros, e só o dono altera o que é seu.
 */

const CACHE_KEY = "hobby:social";

export interface MySocial {
  handle: string;
  bio: string;
  is_public: boolean;
  share_reviews: boolean;
}
export interface PublicProfile {
  id: string;
  handle: string;
  name: string;
  bio: string;
  color: Media | null;
  avatar: string | null;
  avatar_thumb: string | null;
  banner: unknown;
  stats: PublicStats;
}
export interface FeedItem {
  user: Pick<PublicProfile, "id" | "handle" | "name" | "avatar_thumb" | "color">;
  row: ActivityRow;
  at: string;
}

const listeners = new Set<() => void>();
let cache: MySocial | null | undefined;

function readCache(): MySocial | null {
  if (cache !== undefined) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    cache = raw && typeof raw.handle === "string" ? { handle: raw.handle, bio: String(raw.bio ?? ""), is_public: !!raw.is_public, share_reviews: !!raw.share_reviews } : null;
  } catch {
    cache = null;
  }
  return cache;
}
function writeCache(v: MySocial | null) {
  cache = v;
  try {
    if (v) localStorage.setItem(CACHE_KEY, JSON.stringify(v));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}
export function forgetSocial() {
  writeCache(null);
}
export function useMySocial(): MySocial | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readCache,
    () => null,
  );
}

const isMedia = (m: unknown): m is Media => typeof m === "string" && (MEDIAS as string[]).includes(m);
const errText = (e: { code?: string; message?: string } | null | undefined) => {
  if (e?.code === "23505") return "Esse nome de usuário já está em uso. Escolha outro.";
  if (e?.code === "23514") return "Nome de usuário ou texto fora das regras. Confira os campos.";
  return e?.message ?? "Não deu certo. Tente de novo.";
};

function toProfile(r: Record<string, unknown>): PublicProfile {
  return {
    id: String(r.id),
    handle: String(r.handle),
    name: typeof r.name === "string" && r.name ? r.name : String(r.handle),
    bio: typeof r.bio === "string" ? r.bio : "",
    color: isMedia(r.color) ? r.color : null,
    avatar: typeof r.avatar === "string" && r.avatar.startsWith("data:image/jpeg;base64,") ? r.avatar : null,
    avatar_thumb: typeof r.avatar_thumb === "string" && r.avatar_thumb.startsWith("data:image/jpeg;base64,") ? r.avatar_thumb : null,
    banner: r.banner ?? null,
    stats: parseStats(r.stats),
  };
}
const LIST_COLS = "id,handle,name,color,avatar_thumb,stats";

/* ------------------------------ meu perfil público ------------------------------ */

export async function loadMine(userId: string): Promise<MySocial | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("handle,bio,is_public,share_reviews").eq("id", userId).maybeSingle();
  const v = data ? { handle: data.handle as string, bio: (data.bio as string) ?? "", is_public: !!data.is_public, share_reviews: !!data.share_reviews } : null;
  writeCache(v);
  return v;
}

export async function saveMine(userId: string, s: MySocial): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: "Contas não estão ativadas nesta versão." };
  const handle = normalizeHandle(s.handle);
  const bad = handleError(handle);
  if (bad) return { ok: false, error: bad };
  if (s.bio.length > MAX_BIO) return { ok: false, error: `A bio aceita até ${MAX_BIO} caracteres.` };
  const local = readProfile();
  const lib = getLibrary();
  const thumb = local.avatar ? await makeThumb(local.avatar) : null;
  const row = {
    id: userId,
    handle,
    name: local.name || handle,
    bio: s.bio.trim(),
    color: local.color ?? null,
    avatar: s.is_public ? local.avatar ?? null : null,
    avatar_thumb: s.is_public ? thumb : null,
    banner: s.is_public ? local.banner ?? null : null,
    stats: s.is_public ? buildStats(lib) : {},
    is_public: s.is_public,
    share_reviews: s.share_reviews,
  };
  if (!s.is_public) {
    // sair do público: apaga a atividade antes, para nada ficar visível
    const { error: e0 } = await sb.from("activity").delete().eq("user_id", userId);
    if (e0) return { ok: false, error: errText(e0) };
  }
  const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, error: errText(error) };
  writeCache({ handle, bio: row.bio, is_public: s.is_public, share_reviews: s.share_reviews });
  if (s.is_public) await reconcileActivity(userId, true);
  return { ok: true };
}

let lastStats = "";
/** Mantém a atividade publicada igual à biblioteca. Só roda para perfil público; envia só as diferenças. */
export async function reconcileActivity(userId: string, force = false): Promise<void> {
  const sb = supabase();
  const me = readCache();
  if (!sb || !me?.is_public) return;
  const lib = getLibrary();
  const want = desiredActivity(lib, me.share_reviews);
  const { data, error } = await sb.from("activity").select("item_id,item,status,rating,review").eq("user_id", userId).limit(1000);
  if (error) throw error;
  const have = (data ?? []).map(parseActivity).filter((r): r is ActivityRow => !!r);
  const { upsert, remove } = diffActivity(want, have);
  for (let i = 0; i < upsert.length; i += 100) {
    const { error: e } = await sb.from("activity").upsert(upsert.slice(i, i + 100).map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,item_id" });
    if (e) throw e;
  }
  for (let i = 0; i < remove.length; i += 100) {
    const { error: e } = await sb.from("activity").delete().eq("user_id", userId).in("item_id", remove.slice(i, i + 100));
    if (e) throw e;
  }
  const stats = buildStats(lib);
  const key = JSON.stringify(stats);
  if (force || key !== lastStats) {
    const { error: e } = await sb.from("profiles").update({ stats }).eq("id", userId);
    if (e) throw e;
    lastStats = key;
  }
}

/* ------------------------------ descobrir pessoas e seguir ------------------------------ */

const clean = (q: string) => q.replace(/[%,()*\\_:"']/g, " ").trim().slice(0, 30);

export async function searchPeople(q: string): Promise<PublicProfile[]> {
  const sb = supabase();
  const t = clean(q);
  if (!sb || t.length < 2) return [];
  const { data, error } = await sb.from("profiles").select(LIST_COLS).or(`handle.ilike.%${t}%,name.ilike.%${t}%`).eq("is_public", true).limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => toProfile(r));
}

export async function follow(me: string, other: string) {
  const { error } = await supabase()!.from("follows").upsert({ follower_id: me, followee_id: other }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (error) throw error;
}
export async function unfollow(me: string, other: string) {
  const { error } = await supabase()!.from("follows").delete().eq("follower_id", me).eq("followee_id", other);
  if (error) throw error;
}
export async function followingIds(me: string): Promise<string[]> {
  const { data, error } = await supabase()!.from("follows").select("followee_id").eq("follower_id", me).limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => r.followee_id as string);
}
export async function listFollowing(me: string): Promise<PublicProfile[]> {
  const ids = await followingIds(me);
  if (!ids.length) return [];
  const { data, error } = await supabase()!.from("profiles").select(LIST_COLS).in("id", ids).eq("is_public", true);
  if (error) throw error;
  return (data ?? []).map((r) => toProfile(r));
}

/** Atividade recente de quem a pessoa segue, mais nova primeiro. */
export async function loadFeed(me: string, limit = 40): Promise<FeedItem[]> {
  const sb = supabase()!;
  const people = await listFollowing(me);
  if (!people.length) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const { data, error } = await sb.from("activity").select("user_id,item_id,item,status,rating,review,updated_at").in("user_id", [...byId.keys()]).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const out: FeedItem[] = [];
  for (const r of data ?? []) {
    const row = parseActivity(r);
    const u = byId.get(r.user_id as string);
    if (row && u) out.push({ user: { id: u.id, handle: u.handle, name: u.name, avatar_thumb: u.avatar_thumb, color: u.color }, row, at: String(r.updated_at) });
  }
  return out;
}

/* ------------------------------ página pública ------------------------------ */

export async function loadPublic(handle: string): Promise<{ profile: PublicProfile; activity: ActivityRow[]; at: string[] } | null> {
  const sb = supabase();
  const h = normalizeHandle(handle);
  if (!sb || handleError(h)) return null;
  const { data, error } = await sb.from("profiles").select("id,handle,name,bio,color,avatar,avatar_thumb,banner,stats").eq("handle", h).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = toProfile(data);
  const { data: act, error: e2 } = await sb.from("activity").select("item_id,item,status,rating,review,updated_at").eq("user_id", profile.id).order("updated_at", { ascending: false }).limit(200);
  if (e2) throw e2;
  const rows: ActivityRow[] = [];
  const at: string[] = [];
  for (const r of act ?? []) {
    const row = parseActivity(r);
    if (row) {
      rows.push(row);
      at.push(String(r.updated_at));
    }
  }
  return { profile, activity: rows, at };
}

/* ------------------------------ comentários e resenhas da comunidade ------------------------------ */

export interface CommentView extends CommentRow {
  author: Pick<PublicProfile, "id" | "handle" | "name" | "avatar_thumb" | "color"> | null;
}
export type ThreadRef = { user: string; item: string };

const tooMany = (e: { code?: string; message?: string }) => (e.code === "54000" ? "Calma: você comentou muito em pouco tempo. Espere um minuto." : errText(e));

async function profilesById(ids: string[]): Promise<Map<string, PublicProfile>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const { data, error } = await supabase()!.from("profiles").select(LIST_COLS).in("id", uniq);
  if (error) throw error;
  return new Map((data ?? []).map((r) => toProfile(r)).map((p) => [p.id, p]));
}
const brief = (p: PublicProfile | undefined) => (p ? { id: p.id, handle: p.handle, name: p.name, avatar_thumb: p.avatar_thumb, color: p.color } : null);

/** Comentários de uma atividade, do mais antigo ao mais novo (leitura de conversa). */
export async function loadComments(t: ThreadRef): Promise<CommentView[]> {
  const { data, error } = await supabase()!.from("comments").select("id,author_id,target_user,target_item,body,created_at").eq("target_user", t.user).eq("target_item", t.item).order("created_at", { ascending: true }).limit(200);
  if (error) throw error;
  const rows = (data ?? []).map(parseComment).filter((c): c is CommentRow => !!c);
  const people = await profilesById(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: brief(people.get(r.author_id)) }));
}

export async function addComment(me: string, t: ThreadRef, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = checkComment(raw);
  if (!c.ok) return c;
  const { error } = await supabase()!.from("comments").insert({ author_id: me, target_user: t.user, target_item: t.item, body: c.body });
  if (error) return { ok: false, error: error.code === "42501" ? "Para comentar, seu perfil precisa estar público (em Comunidade) e o da pessoa também." : tooMany(error) };
  return { ok: true };
}

export async function removeComment(id: string): Promise<void> {
  const { error } = await supabase()!.from("comments").delete().eq("id", id);
  if (error) throw error;
}

/** Quantos comentários cada atividade da lista tem (uma consulta só). */
export async function commentCounts(targets: ThreadRef[]): Promise<Map<string, number>> {
  const users = [...new Set(targets.map((t) => t.user))];
  if (!users.length) return new Map();
  const { data, error } = await supabase()!.from("comments").select("target_user,target_item").in("target_user", users).limit(2000);
  if (error) throw error;
  return countByThread((data ?? []).map((r) => ({ target_user: String(r.target_user), target_item: String(r.target_item) })));
}

/** Comentários mais recentes que as pessoas deixaram no seu perfil. */
export async function recentOnMine(me: string, limit = 15): Promise<(CommentView & { title: string })[]> {
  const sb = supabase()!;
  const { data, error } = await sb.from("comments").select("id,author_id,target_user,target_item,body,created_at").eq("target_user", me).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = (data ?? []).map(parseComment).filter((c): c is CommentRow => !!c).filter((c) => c.author_id !== me);
  if (!rows.length) return [];
  const [people, act] = await Promise.all([
    profilesById(rows.map((r) => r.author_id)),
    sb.from("activity").select("item_id,item,status").eq("user_id", me).in("item_id", [...new Set(rows.map((r) => r.target_item))]),
  ]);
  const titles = new Map((act.data ?? []).map((a) => [String(a.item_id), String((a.item as { title?: string } | null)?.title ?? a.item_id)]));
  return rows.map((r) => ({ ...r, author: brief(people.get(r.author_id)), title: titles.get(r.target_item) ?? r.target_item }));
}

export interface CommunityReview {
  user: NonNullable<CommentView["author"]>;
  row: ActivityRow;
  userId: string;
  at: string;
}
/** Resenhas públicas de uma obra, de todo mundo que liberou resenha. */
export async function loadItemReviews(itemId: string, limit = 20): Promise<CommunityReview[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from("activity").select("user_id,item_id,item,status,rating,review,updated_at").eq("item_id", itemId).not("review", "is", null).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const people = await profilesById((data ?? []).map((r) => String(r.user_id)));
  const out: CommunityReview[] = [];
  for (const r of data ?? []) {
    const row = parseActivity(r);
    const u = brief(people.get(String(r.user_id)));
    if (row && u && row.review) out.push({ user: u, row, userId: String(r.user_id), at: String(r.updated_at) });
  }
  return out;
}
