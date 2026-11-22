"use client";

import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { cloudAvailable, loadSupabase, mayHaveSession, supabase } from "./supabase";
import { forgetProfile } from "./profile";
import { forgetSocial, loadMine, reconcileActivity } from "./community";
import { applySynced, deleteAll, getLibrary, subscribeLibrary } from "./store";
import { REMOTE_VERSION, mergeLibraries, parseRemote, sameLibrary } from "./sync";

/**
 * Conta e sincronização. Tudo é opcional: sem as variáveis do Supabase o app segue 100% local.
 * Regra de ouro: a nuvem nunca apaga dado local sem a pessoa pedir. O sync só faz merge (soma) e
 * o merge é comutativo/idempotente (ver sync.ts), então repetir ou reordenar nunca perde nada.
 */
export { cloudAvailable, supabase };

/* ------------------------------ estado observável ------------------------------ */

export type SyncPhase = "off" | "idle" | "syncing" | "error";
export interface CloudState {
  ready: boolean; // já checamos se há sessão salva
  email: string | null;
  userId: string | null;
  phase: SyncPhase;
  lastSync: number | null;
  error: string | null;
}
let state: CloudState = { ready: false, email: null, userId: null, phase: "off", lastSync: null, error: null };
const listeners = new Set<() => void>();
function setState(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function useCloud(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/* ------------------------------ motor de sincronização ------------------------------ */

let rev = 0; // versão da nuvem que conhecemos (0 = ainda não existe linha)
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let offLib: (() => void) | undefined;

const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "falha de rede");

/** Um ciclo: baixa, junta, aplica local e sobe se a nuvem ainda não tem o resultado. Repete se a nuvem mudou no meio. */
export async function syncNow(): Promise<boolean> {
  const sb = supabase();
  if (!sb || !state.userId) return false;
  if (running) {
    again = true;
    return false;
  }
  running = true;
  setState({ phase: "syncing", error: null });
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await sb.from("libraries").select("data, rev").maybeSingle();
      if (error) throw error;
      const remote = data ? parseRemote(data.data) : null;
      rev = data?.rev ?? 0;
      const local = getLibrary();
      const merged = remote ? mergeLibraries(local, remote) : local;
      if (!sameLibrary(merged, local)) applySynced(merged);
      if (remote && sameLibrary(merged, remote)) break; // nuvem já tem tudo
      const { data: newRev, error: e2 } = await sb.rpc("save_library", { p_data: { v: REMOTE_VERSION, lib: merged }, p_expected: rev });
      if (e2) throw e2;
      if (newRev != null) {
        rev = newRev as number;
        break;
      }
      // null = outro aparelho gravou antes (compare-and-set falhou): baixa de novo e junta
    }
    await reconcileActivity(state.userId).catch(() => {}); // vitrine pública: falhar aqui não é falha do sync
    setState({ phase: "idle", lastSync: Date.now() });
    return true;
  } catch (e) {
    setState({ phase: "error", error: msg(e) });
    return false;
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(500);
    }
  }
}

function schedule(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

function start(session: Session) {
  setState({ ready: true, email: session.user.email ?? null, userId: session.user.id, phase: "idle" });
  offLib?.();
  offLib = subscribeLibrary(() => {
    if (!running) schedule();
  });
  void loadMine(session.user.id).then(() => syncNow()).catch(() => syncNow());
}
function stop() {
  forgetSocial();
  clearTimeout(timer);
  offLib?.();
  offLib = undefined;
  rev = 0;
  setState({ ready: true, email: null, userId: null, phase: "off", lastSync: null, error: null });
}

let booted = false;
let attached: Promise<void> | null = null;

/** Baixa o supabase-js e passa a acompanhar entradas e saídas. Idempotente: a primeira chamada faz o trabalho, as outras esperam por ele. */
function attach(): Promise<void> {
  attached ??= loadSupabase().then((sb) => {
    if (!sb) {
      setState({ ready: true });
      return;
    }
    sb.auth.onAuthStateChange((event, session) => {
      if (session && state.userId !== session.user.id) start(session);
      else if (!session && event === "SIGNED_OUT") stop();
    });
    // volta para a aba / reconecta: sincroniza de novo
    window.addEventListener("online", () => schedule(300));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.userId) schedule(300);
    });
    return sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (state.userId !== data.session.user.id) start(data.session);
      } else setState({ ready: true });
    });
  });
  return attached;
}

/** Chamado uma vez pelo Shell. Sem sessão salva nada é baixado: o supabase-js só chega quando a pessoa entra numa conta. */
export function bootCloud() {
  if (booted) return;
  booted = true;
  if (!cloudAvailable() || !mayHaveSession()) {
    setState({ ready: true });
    return;
  }
  void attach();
}

/** Cliente pronto para uma ação da conta (entrar, criar, recuperar senha). */
async function client() {
  await attach();
  return supabase();
}

/* ------------------------------ ações da conta ------------------------------ */

export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).",
  user_already_exists: "Esse e-mail já tem conta. Tente entrar.",
  weak_password: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.",
  over_email_send_rate_limit: "Muitos e-mails enviados. Espere alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas. Espere um pouco.",
};
function authError(e: { code?: string; message?: string } | null): string {
  return (e?.code && ERRORS[e.code]) || e?.message || "Algo deu errado. Tente de novo.";
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = await client();
  if (!sb) return { ok: false, error: "Contas não estão ativadas nesta versão." };
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + "/perfil" } });
  if (error) return { ok: false, error: authError(error) };
  // e-mail já cadastrado: o Supabase devolve um usuário "falso" sem identidades (evita revelar quem tem conta)
  if (data.user && (data.user.identities?.length ?? 1) === 0) return { ok: false, error: ERRORS.user_already_exists };
  return { ok: true, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = await client();
  if (!sb) return { ok: false, error: "Contas não estão ativadas nesta versão." };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: authError(error) } : { ok: true };
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const sb = await client();
  if (!sb) return { ok: false, error: "Contas não estão ativadas nesta versão." };
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/perfil" });
  return error ? { ok: false, error: authError(error) } : { ok: true };
}

/** Sair mantém os dados neste aparelho (a pessoa pode continuar usando offline). */
export async function signOut() {
  await supabase()?.auth.signOut();
  stop();
}

/** Apaga conta e tudo na nuvem (perfil, biblioteca, atividade, seguidores) e também os dados locais. */
export async function deleteAccount(): Promise<AuthResult> {
  const sb = supabase();
  if (!sb || !state.userId) return { ok: false, error: "Você não está numa conta." };
  const { error } = await sb.rpc("delete_my_account");
  if (error) return { ok: false, error: authError(error) };
  await sb.auth.signOut().catch(() => {});
  stop();
  deleteAll();
  forgetProfile();
  return { ok: true };
}

/** "Excluir meus dados" com conta: apaga a nuvem junto. Se a nuvem falhar, NÃO apaga só o local (senão o próximo sync traria tudo de volta). */
export async function deleteEverything(): Promise<AuthResult> {
  if (state.userId) return deleteAccount();
  deleteAll();
  return { ok: true };
}
