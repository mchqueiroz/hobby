"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Item } from "./types";

/**
 * Capas dos itens do catálogo base, que não trazem imagem própria.
 * Resolvidas uma vez pelo servidor e guardadas no aparelho. Se a fonte estiver desligada ou falhar, fica a capa gerada.
 */
const KEY = "hobby:covers";
let cache: Record<string, string> | null = null;
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(id: string, url: string) {
  const c = load();
  c[id] = url;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* sem espaço: a capa vale só nesta sessão */
  }
  listeners.forEach((l) => l());
}

type Ref = Pick<Item, "id" | "title" | "media" | "year" | "cover" | "source" | "author">;

function request(item: Ref) {
  if (pending.has(item.id) || failed.has(item.id)) return;
  pending.add(item.id);
  const q = new URLSearchParams({ title: item.title, media: item.media });
  if (item.year) q.set("year", String(item.year));
  if (item.author) q.set("artist", item.author);
  fetch(`/api/cover?${q}`)
    .then((r) => (r.ok ? r.json() : { url: null }))
    .then((b: { url?: string | null }) => {
      if (b.url) save(item.id, b.url);
      else failed.add(item.id);
    })
    .catch(() => failed.add(item.id))
    .finally(() => pending.delete(item.id));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** URL da capa real, ou undefined enquanto não houver (a tela mostra a capa gerada). */
export function useCover(item: Ref): string | undefined {
  // o servidor só conhece a capa que vem no próprio item; a do cache local entra depois da hidratação
  const url = useSyncExternalStore(
    subscribe,
    () => item.cover ?? load()[item.id],
    () => item.cover,
  );
  useEffect(() => {
    if (!url && item.source === "seed") request(item);
  }, [url, item]);
  return url;
}
