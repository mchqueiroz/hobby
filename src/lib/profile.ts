"use client";

import { useSyncExternalStore } from "react";
import { isStoredImage } from "./image";
import { MEDIAS, type Media } from "./types";

export const PROFILE_KEY = "hobby:profile";
export const MAX_NAME = 40;

/** "auto" segue o seu gosto; "media" é uma cor fixa; "image" é a foto que você enviou. */
export type Banner = { kind: "auto" } | { kind: "media"; media: Media } | { kind: "image"; data: string };

export interface Profile {
  name: string;
  /** JPEG já recortado (data URL) */
  avatar?: string;
  banner?: Banner;
  /** cor do avatar quando não há foto */
  color?: Media;
}
export const EMPTY_PROFILE: Profile = Object.freeze({ name: "" }) as Profile;

const isMedia = (m: unknown): m is Media => typeof m === "string" && (MEDIAS as string[]).includes(m);

/** Lê o que veio do armazenamento sem confiar em nada: o que não bate com o formato é descartado. */
export function parseProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== "object") return EMPTY_PROFILE;
  const r = raw as Record<string, unknown>;
  const p: Profile = { name: typeof r.name === "string" ? r.name.slice(0, MAX_NAME) : "" };
  if (isStoredImage(r.avatar)) p.avatar = r.avatar;
  if (isMedia(r.color)) p.color = r.color;
  const b = r.banner as Record<string, unknown> | undefined;
  if (b && typeof b === "object") {
    if (b.kind === "media" && isMedia(b.media)) p.banner = { kind: "media", media: b.media };
    else if (b.kind === "image" && isStoredImage(b.data)) p.banner = { kind: "image", data: b.data };
  }
  return p;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/** Aplica uma mudança; `undefined` mantém, `null` apaga. Perfil vazio vira `null` (remove a chave). */
export function mergeProfile(
  p: Profile,
  patch: { name?: string; avatar?: string | null; banner?: Banner | null; color?: Media | null },
): Profile | null {
  const next: Profile = { name: patch.name !== undefined ? cleanName(patch.name) : p.name };
  const avatar = patch.avatar === undefined ? p.avatar : (patch.avatar ?? undefined);
  const banner = patch.banner === undefined ? p.banner : (patch.banner ?? undefined);
  const color = patch.color === undefined ? p.color : (patch.color ?? undefined);
  if (avatar) next.avatar = avatar;
  if (banner && banner.kind !== "auto") next.banner = banner;
  if (color) next.color = color;
  return next.name || next.avatar || next.banner || next.color ? next : null;
}

/* ------------------------------ armazenamento ------------------------------ */

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());

let cache: { raw: string | null; value: Profile } = { raw: null, value: EMPTY_PROFILE };

/** Mesmo objeto enquanto o texto guardado não muda (exigência do useSyncExternalStore). */
export function readProfile(): Profile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROFILE_KEY);
  } catch {
    return cache.value;
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY_PROFILE;
  try {
    value = raw ? parseProfile(JSON.parse(raw)) : EMPTY_PROFILE;
  } catch {
    /* dado corrompido: perfil vazio */
  }
  cache = { raw, value };
  return value;
}

/** false quando o navegador não deixou gravar (sem espaço, bloqueado). Nesse caso nada muda. */
export function updateProfile(patch: Parameters<typeof mergeProfile>[1]): boolean {
  const next = mergeProfile(readProfile(), patch);
  try {
    if (next) localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    return false;
  }
  emit();
  return true;
}

export function readName(): string {
  return readProfile().name;
}

export function setProfileName(name: string) {
  updateProfile({ name });
}

export function forgetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignora */
  }
  emit();
}

/** No servidor e na primeira pintura o perfil é vazio, para a hidratação bater. */
export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, readProfile, () => EMPTY_PROFILE);
}

export function useProfileName(): string {
  return useProfile().name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "H";
  const first = Array.from(parts[0])[0] ?? "H";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}
