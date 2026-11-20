"use client";

import { useSyncExternalStore } from "react";

/**
 * Métricas somadas do teste. Só enviam depois de consentimento explícito (desligado por padrão).
 * O envio é anônimo: um código aleatório do aparelho, o tipo do evento e números simples.
 * Nunca vão títulos, notas, nome de usuário do AniList ou e-mail.
 */
const CONSENT_KEY = "hobby:consent";
const PID_KEY = "hobby:pid";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const listeners = new Set<() => void>();

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setConsent(on: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, on ? "1" : "0");
  } catch {
    /* sem armazenamento: o consentimento não persiste, então nada é enviado depois */
  }
  listeners.forEach((l) => l());
}

export function useConsent(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readConsent,
    () => false,
  );
}

/** true quando o projeto de métricas está configurado neste ambiente */
export const telemetryAvailable = () => !!URL && !!KEY;

function participant(): string | null {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Esquece o código do aparelho: eventos já enviados deixam de poder ser ligados a você. */
export function forgetParticipant() {
  try {
    localStorage.removeItem(PID_KEY);
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

type Data = Record<string, number | string | boolean>;

export function cleanData(data?: Data): Data | null {
  if (!data) return null;
  const out: Data = {};
  for (const [k, v] of Object.entries(data).slice(0, 10)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 40);
  }
  return out;
}

export function sendEvent(type: string, data?: Data) {
  if (!URL || !KEY || !readConsent()) return;
  const pid = participant();
  if (!pid) return;
  try {
    void fetch(`${URL}/rest/v1/test_events`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ participant: pid, type: type.slice(0, 40), data: cleanData(data) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* métrica nunca quebra o app */
  }
}
