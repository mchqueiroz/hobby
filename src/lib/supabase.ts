"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente único do Supabase. Sem as variáveis de ambiente o app segue 100% local.
 *
 * O supabase-js pesa cerca de 270 KB e só serve para quem tem conta ou abre uma página social,
 * então ele não entra no carregamento inicial: `loadSupabase()` baixa o código na primeira necessidade.
 * Depois disso `supabase()` devolve o cliente de forma síncrona.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const cloudAvailable = (): boolean => !!URL && !!KEY;

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

/** Cliente já carregado, ou null se ainda não foi pedido (ou se as contas estão desligadas). */
export function supabase(): SupabaseClient | null {
  return client;
}

/** Baixa e cria o cliente uma única vez. Devolve null quando as contas não estão ativadas. */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!cloudAvailable()) return Promise.resolve(null);
  loading ??= import("@supabase/supabase-js").then(({ createClient }) => {
    client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return client;
  });
  return loading;
}

/** Há sessão salva neste aparelho, ou o endereço traz o retorno de um e-mail de confirmação? Só então vale carregar o supabase-js no começo. */
export function mayHaveSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    /* armazenamento bloqueado: sem sessão para restaurar */
  }
  const { hash, search } = window.location;
  return /access_token|refresh_token|error_description/.test(hash) || /[?&]code=/.test(search);
}
