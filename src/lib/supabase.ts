"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Cliente único do Supabase. Sem as variáveis de ambiente o app segue 100% local. */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const cloudAvailable = (): boolean => !!URL && !!KEY;

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!cloudAvailable()) return null;
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
