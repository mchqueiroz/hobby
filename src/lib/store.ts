"use client";

import { forgetProfile } from "./profile";
import { useSyncExternalStore } from "react";
import { SEED_BY_ID, titleKey } from "./catalog";
import { ownedTitles } from "./recommend";
import { EMPTY_LIBRARY, type Entry, type Item, type Library, type Status, type UserList } from "./types";
import type { Imported } from "./anilist";
import { forgetParticipant, sendEvent } from "./telemetry";
import { touch } from "./sync";

/**
 * Armazenamento do MVP: localStorage, com cópia em memória caso o navegador bloqueie.
 * A interface (useLibrary + actions) é a mesma que o Supabase vai atender depois.
 */
const KEY = "hobby:v1";

let state: Library = EMPTY_LIBRARY;
let loaded = false;
const listeners = new Set<() => void>();

function isLibrary(x: unknown): x is Library {
  const l = x as Library;
  return (
    !!l &&
    typeof l === "object" &&
    typeof l.items === "object" &&
    l.items !== null &&
    typeof l.entries === "object" &&
    l.entries !== null &&
    Array.isArray(l.dismissed) &&
    typeof l.goal === "number"
  );
}

function load(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      // dados antigos não tinham listas: completa o que faltar
      if (isLibrary(parsed)) return { ...EMPTY_LIBRARY, ...parsed, lists: (parsed as Library).lists ?? {} };
    }
  } catch {
    /* navegador bloqueou o armazenamento ou o dado está corrompido: começa vazio */
  }
  return EMPTY_LIBRARY;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaço ou bloqueado: o estado segue em memória durante a sessão */
  }
}

function set(next: Library) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function snapshot(): Library {
  if (!loaded && typeof window !== "undefined") {
    state = load();
    loaded = true;
  }
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLibrary(): Library {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_LIBRARY);
}

/** true depois que o cliente leu o armazenamento (evita piscar "vazio" na hidratação) */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------ ações ------------------------------ */

let lastUndo: (() => void) | null = null;

export function saveEntry(item: Item, status: Status, rating?: number, review?: string) {
  const lib = snapshot();
  const prev = lib.entries[item.id];
  const prevItem = lib.items[item.id];
  // refazer o registro mantém a resenha e a data que a pessoa já escreveu
  // se veio uma resenha nova, ela vale; vazia mantém a que já existia
  const typed = review?.trim().slice(0, MAX_REVIEW);
  const entry: Entry = { itemId: item.id, status, rating, at: Date.now(), review: typed || prev?.review, date: prev?.date };
  if (status === "andamento" && prev?.progress) entry.progress = prev.progress;
  const isSeed = !!SEED_BY_ID[item.id];
  const wasDismissed = lib.dismissed.includes(item.id);
  set({
    ...lib,
    items: isSeed ? lib.items : { ...lib.items, [item.id]: item },
    entries: { ...lib.entries, [item.id]: entry },
    dismissed: lib.dismissed.filter((d) => d !== item.id),
    ts: touch(lib, wasDismissed ? [`e:${item.id}`, `d:${item.id}`] : [`e:${item.id}`]),
  });
  lastUndo = () => {
    const cur = snapshot();
    const entries = { ...cur.entries };
    if (prev) entries[item.id] = prev;
    else delete entries[item.id];
    const items = { ...cur.items };
    if (prevItem) items[item.id] = prevItem;
    else if (!isSeed) delete items[item.id];
    set({ ...cur, entries, items, ts: touch(cur, [`e:${item.id}`]) });
  };
}

/** Guarda um item vindo de API para que a página dele abra mesmo sem registro. */
export function cacheItem(item: Item) {
  const lib = snapshot();
  if (SEED_BY_ID[item.id] || lib.items[item.id]) return;
  set({ ...lib, items: { ...lib.items, [item.id]: item } });
}

export function removeEntry(itemId: string) {
  const lib = snapshot();
  const entries = { ...lib.entries };
  delete entries[itemId];
  set({ ...lib, entries, ts: touch(lib, [`e:${itemId}`]) });
}

export function undoLast(): boolean {
  if (!lastUndo) return false;
  lastUndo();
  lastUndo = null;
  return true;
}

/** Passe o item quando ele não é do catálogo base, para o gosto poder lembrar das vibes dele. */
export function dismiss(itemId: string, item?: Item) {
  const lib = snapshot();
  if (lib.dismissed.includes(itemId)) return;
  const items = item && !SEED_BY_ID[itemId] ? { ...lib.items, [itemId]: item } : lib.items;
  set({ ...lib, items, dismissed: [...lib.dismissed, itemId], ts: touch(lib, [`d:${itemId}`]) });
}

export function undismiss(itemId: string) {
  const lib = snapshot();
  set({ ...lib, dismissed: lib.dismissed.filter((d) => d !== itemId), ts: touch(lib, [`d:${itemId}`]) });
}

/**
 * Junta o histórico importado sem sobrescrever o que o usuário já registrou à mão.
 * Se o título já existe na biblioteca (mesmo vindo de outra fonte), o registro dele vale.
 */
export function importHistory(imp: Imported): { added: number; skipped: number } {
  const lib = snapshot();
  const items = { ...lib.items };
  const entries = { ...lib.entries };
  const owned = ownedTitles(lib);
  const byId = new Map(imp.items.map((i) => [i.id, i]));
  let added = 0;
  let skipped = 0;
  for (const e of imp.entries) {
    const item = byId.get(e.itemId);
    if (!item || entries[e.itemId] || owned.has(titleKey(item))) {
      skipped++;
      continue;
    }
    items[item.id] = item;
    // histórico antigo: sem data, para não contar na meta do ano
    entries[e.itemId] = { ...e, at: 0 };
    owned.add(titleKey(item));
    added++;
  }
  set({ ...lib, items, entries });
  return { added, skipped };
}

export function setFavorites(ids: string[]) {
  const lib = snapshot();
  const entries = { ...lib.entries };
  const now = Date.now();
  for (const id of ids) entries[id] = { itemId: id, status: "concluido", rating: 5, at: now };
  set({ ...lib, entries, ts: touch(lib, ids.map((id) => `e:${id}`), now) });
}

export function setGoal(goal: number) {
  const lib = snapshot();
  set({ ...lib, goal: Math.max(1, Math.min(999, Math.round(goal))), ts: touch(lib, ["g"]) });
}

/** Resenha e data de um item já registrado. `undefined` mantém, texto vazio apaga a resenha. */
export function setNote(itemId: string, patch: { review?: string; date?: number | null; progress?: number | null }) {
  const lib = snapshot();
  const e = lib.entries[itemId];
  if (!e) return;
  const next: Entry = { ...e };
  if (patch.review !== undefined) {
    const r = patch.review.trim().slice(0, MAX_REVIEW);
    if (r) next.review = r;
    else delete next.review;
  }
  if (patch.date !== undefined) {
    if (patch.date === null) delete next.date;
    else next.date = patch.date;
  }
  if (patch.progress !== undefined) {
    if (patch.progress === null || !Number.isFinite(patch.progress) || patch.progress <= 0) delete next.progress;
    else next.progress = Math.min(99999, Math.round(patch.progress * 10) / 10);
  }
  set({ ...lib, entries: { ...lib.entries, [itemId]: next }, ts: touch(lib, [`e:${itemId}`]) });
}
export const MAX_REVIEW = 2000;

/* ------------------------------ listas ------------------------------ */

export function createList(name: string): string | null {
  const n = name.trim().slice(0, 60);
  if (!n) return null;
  const lib = snapshot();
  const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const list: UserList = { id, name: n, itemIds: [], createdAt: Date.now() };
  set({ ...lib, lists: { ...lib.lists, [id]: list }, ts: touch(lib, [`l:${id}`]) });
  return id;
}

export function renameList(id: string, name: string) {
  const lib = snapshot();
  const l = lib.lists[id];
  const n = name.trim().slice(0, 60);
  if (!l || !n) return;
  set({ ...lib, lists: { ...lib.lists, [id]: { ...l, name: n } }, ts: touch(lib, [`l:${id}`]) });
}

export function deleteList(id: string) {
  const lib = snapshot();
  const lists = { ...lib.lists };
  delete lists[id];
  set({ ...lib, lists, ts: touch(lib, [`l:${id}`]) });
}

/** Põe ou tira o item da lista. Itens de API são guardados na biblioteca para a lista poder mostrá-los. */
export function toggleInList(listId: string, item: Item): boolean {
  const lib = snapshot();
  const l = lib.lists[listId];
  if (!l) return false;
  const has = l.itemIds.includes(item.id);
  const items = !has && !SEED_BY_ID[item.id] && !lib.items[item.id] ? { ...lib.items, [item.id]: item } : lib.items;
  const itemIds = has ? l.itemIds.filter((i) => i !== item.id) : [...l.itemIds, item.id];
  set({ ...lib, items, lists: { ...lib.lists, [listId]: { ...l, itemIds } }, ts: touch(lib, [`l:${listId}`]) });
  return !has;
}

/* ------------------------------ ponte para a sincronização ------------------------------ */

export function getLibrary(): Library {
  return snapshot();
}

/** Troca a biblioteca pelo resultado de um merge com a nuvem. */
export function applySynced(next: Library) {
  set(next);
}

/** Avisa a cada mudança da biblioteca (inclusive as que o próprio sync fez). */
export function subscribeLibrary(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Dados de exemplo para demonstração. Itens do catálogo base, notas inventadas. */
export function loadDemo() {
  const pick: [string, Status, number?][] = [
    ["seed:anime:cowboy-bebop", "concluido", 5],
    ["seed:anime:death-note", "concluido", 5],
    ["seed:anime:monster", "concluido", 4.5],
    ["seed:anime:steins-gate", "concluido", 5],
    ["seed:anime:spirited-away", "concluido", 4],
    ["seed:anime:haikyu", "andamento"],
    ["seed:jogo:hades", "concluido", 5],
    ["seed:jogo:hollow-knight", "concluido", 5],
    ["seed:jogo:the-witcher-3", "concluido", 4],
    ["seed:jogo:stardew-valley", "concluido", 3.5],
    ["seed:filme:cidade-de-deus", "concluido", 5],
    ["seed:filme:blade-runner", "concluido", 4],
    ["seed:filme:parasita", "concluido", 4],
    ["seed:filme:bacurau", "quero"],
  ];
  const now = Date.now();
  const entries: Record<string, Entry> = {};
  pick.forEach(([id, status, rating], i) => {
    entries[id] = { itemId: id, status, rating, at: now - i * 86_400_000 };
  });
  set({ ...EMPTY_LIBRARY, entries });
}

export function exportData(): string {
  return JSON.stringify(snapshot(), null, 2);
}

export function deleteAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(EVENTS_KEY);
  } catch {
    /* ignora */
  }
  forgetParticipant();
  forgetProfile();
  set(EMPTY_LIBRARY);
}

/* ------------------------- métricas de uso (local) ------------------------- */

export const EVENTS_KEY = "hobby:events";
export interface AppEvent {
  type: string;
  at: number;
  data?: Record<string, number | string | boolean>;
}

export function track(type: string, data?: AppEvent["data"]) {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list: AppEvent[] = raw ? (JSON.parse(raw) as AppEvent[]) : [];
    list.push({ type, at: Date.now(), data });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* métrica nunca pode quebrar o app */
  }
  sendEvent(type, data);
}

export function readEvents(): AppEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as AppEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearEvents() {
  try {
    localStorage.removeItem(EVENTS_KEY);
  } catch {
    /* ignora */
  }
}
