"use client";

import { forgetProfile } from "./profile";
import { useSyncExternalStore } from "react";
import { SEED_BY_ID, titleKey } from "./catalog";
import { ownedTitles } from "./recommend";
import { EMPTY_LIBRARY, cleanTags, type Entry, type Item, type Library, type Status, type UserList } from "./types";
import type { Imported } from "./anilist";
import { forgetParticipant, sendEvent } from "./telemetry";
import { mergeLibraries, sameLibrary, touch } from "./sync";

/**
 * Armazenamento do MVP: localStorage, com cópia em memória caso o navegador bloqueie.
 * A interface (useLibrary + actions) é a mesma que o Supabase vai atender depois.
 */
const KEY = "hobby:v1";
/** Carimbo gravado por "Excluir meus dados": avisa as outras abas abertas para esvaziarem também (senão elas ressuscitariam o que foi apagado). */
const DELETED_KEY = "hobby:deleted";
/** Cópia do dado ilegível, guardada antes de começar vazio, para nunca perder a chance de recuperar. */
const CORRUPT_KEY = "hobby:v1:corrupt";

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
      keepCorrupt(raw);
    }
  } catch (e) {
    // JSON quebrado: guarda o texto original antes de começar vazio (o próximo registro sobrescreveria a chave)
    if (e instanceof SyntaxError) {
      try { keepCorrupt(localStorage.getItem(KEY) ?? ""); } catch { /* ignora */ }
    }
    /* navegador bloqueou o armazenamento: começa vazio */
  }
  return EMPTY_LIBRARY;
}

function keepCorrupt(raw: string) {
  try {
    if (raw) localStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    /* sem espaço: nada a fazer */
  }
}

/** true quando a última tentativa de gravar neste aparelho falhou (cheio ou bloqueado): a pessoa precisa saber, senão perde o dado ao fechar. */
let persistFailed = false;
function persist() {
  let failed = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    failed = true; // o estado segue em memória durante a sessão
  }
  if (failed !== persistFailed) {
    persistFailed = failed;
    listeners.forEach((l) => l());
  }
}

export function useStorageProblem(): boolean {
  return useSyncExternalStore(subscribe, () => persistFailed, () => false);
}

let watching = false;
/** Várias abas abertas: junta o que outra aba gravou (sem apagar nada) e esvazia se outra aba excluiu tudo. */
export function watchOtherTabs() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("storage", (e) => {
    if (e.key === DELETED_KEY && e.newValue) {
      state = EMPTY_LIBRARY;
      loaded = true;
      listeners.forEach((l) => l());
      return;
    }
    if (e.key !== KEY || !e.newValue) return;
    let parsed: unknown;
    try { parsed = JSON.parse(e.newValue); } catch { return; }
    if (!isLibrary(parsed)) return;
    const other: Library = { ...EMPTY_LIBRARY, ...parsed, lists: parsed.lists ?? {} };
    const merged = mergeLibraries(snapshot(), other);
    if (sameLibrary(merged, state)) return;
    state = merged;
    listeners.forEach((l) => l());
    if (!sameLibrary(merged, other)) persist(); // esta aba tinha algo que a outra não tinha: grava o resultado da soma
  });
}

function set(next: Library) {
  // garante que o que estava gravado foi lido (e, se estava ilegível, copiado) antes de ser sobrescrito
  if (!loaded && typeof window !== "undefined") snapshot();
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
  if (prev?.total) entry.total = prev.total;
  if (prev?.rounds) entry.rounds = prev.rounds;
  if (prev?.tags?.length) entry.tags = prev.tags;
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
export function setNote(itemId: string, patch: { review?: string; date?: number | null; progress?: number | null; total?: number | null }) {
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
  if (patch.total !== undefined) {
    if (patch.total === null || !Number.isFinite(patch.total) || patch.total <= 0) delete next.total;
    else next.total = Math.min(99999, Math.round(patch.total));
  }
  set({ ...lib, entries: { ...lib.entries, [itemId]: next }, ts: touch(lib, [`e:${itemId}`]) });
}
export const MAX_REVIEW = 2000;

/** Define as etiquetas de um registro (limpa, limita e ordena como a pessoa digitou). */
export function setTags(itemId: string, tags: string[]) {
  const lib = snapshot();
  const e = lib.entries[itemId];
  if (!e) return;
  const next: Entry = { ...e };
  const clean = cleanTags(tags);
  if (clean.length) next.tags = clean;
  else delete next.tags;
  set({ ...lib, entries: { ...lib.entries, [itemId]: next }, ts: touch(lib, [`e:${itemId}`]) });
}

/** meio-dia de hoje, no horário local (o mesmo formato do campo de data) */
const todayNoon = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
};

/**
 * Avança (ou recua) o progresso de uma obra. Sair de "quero" começa a obra; chegar no total conclui,
 * com a data de hoje se a pessoa ainda não escolheu uma. Devolve o que aconteceu, para a tela avisar.
 */
export function stepProgress(itemId: string, delta = 1): { ok: boolean; completed: boolean; value: number } {
  const lib = snapshot();
  const prev = lib.entries[itemId];
  if (!prev || prev.status === "concluido" || prev.status === "abandonei") return { ok: false, completed: false, value: prev?.progress ?? 0 };
  const total = typeof prev.total === "number" && prev.total > 0 ? prev.total : undefined;
  let value = Math.max(0, Math.round(((prev.progress ?? 0) + delta) * 10) / 10);
  if (total) value = Math.min(value, total);
  const completed = !!total && value >= total && delta > 0;
  const next: Entry = { ...prev, status: completed ? "concluido" : "andamento", at: Date.now() };
  if (value > 0) next.progress = value;
  else delete next.progress;
  if (completed) next.date = prev.date ?? todayNoon();
  set({ ...lib, entries: { ...lib.entries, [itemId]: next }, ts: touch(lib, [`e:${itemId}`]) });
  lastUndo = () => {
    const cur = snapshot();
    set({ ...cur, entries: { ...cur.entries, [itemId]: prev }, ts: touch(cur, [`e:${itemId}`]) });
  };
  return { ok: true, completed, value };
}

/** "Rever/reler/rejogar": soma uma vez no contador e põe a data de hoje. A obra continua concluída. */
export function redo(itemId: string): number | null {
  const lib = snapshot();
  const prev = lib.entries[itemId];
  if (!prev || prev.status !== "concluido") return null;
  const rounds = Math.min(99, (typeof prev.rounds === "number" && prev.rounds >= 1 ? Math.floor(prev.rounds) : 1) + 1);
  set({ ...lib, entries: { ...lib.entries, [itemId]: { ...prev, rounds, date: todayNoon(), at: Date.now() } }, ts: touch(lib, [`e:${itemId}`]) });
  lastUndo = () => {
    const cur = snapshot();
    set({ ...cur, entries: { ...cur.entries, [itemId]: prev }, ts: touch(cur, [`e:${itemId}`]) });
  };
  return rounds;
}

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

/** Move um item uma posição para cima (-1) ou para baixo (+1) na lista. Devolve a nova posição, ou null se não mexeu. */
export function moveInList(listId: string, itemId: string, delta: -1 | 1): number | null {
  const lib = snapshot();
  const l = lib.lists[listId];
  if (!l) return null;
  const i = l.itemIds.indexOf(itemId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= l.itemIds.length) return null;
  const ids = l.itemIds.slice();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  set({ ...lib, lists: { ...lib.lists, [listId]: { ...l, itemIds: ids } }, ts: touch(lib, [`l:${listId}`]) });
  return j;
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

/** Dados de exemplo para demonstração. Itens do catálogo base, notas inventadas. Nunca sobrescreve registros reais. */
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
    ["seed:manga:berserk", "concluido", 5],
    ["seed:manga:vinland-saga", "andamento"],
    ["seed:livro:o-hobbit", "concluido", 5],
    ["seed:livro:dom-casmurro", "concluido", 4.5],
    ["seed:livro:crime-e-castigo", "concluido", 4],
    ["seed:livro:neuromancer", "quero"],
    ["seed:musica:kind-of-blue", "concluido", 5],
    ["seed:musica:clube-da-esquina", "concluido", 4.5],
  ];
  const now = Date.now();
  const entries: Record<string, Entry> = {};
  pick.forEach(([id, status, rating], i) => {
    entries[id] = { itemId: id, status, rating, at: now - i * 86_400_000 };
  });
  // soma ao que já existe: o que a pessoa registrou de verdade tem prioridade e nada é apagado
  const cur = snapshot();
  set({ ...cur, entries: { ...entries, ...cur.entries } });
}

/**
 * Restaura um backup SOMANDO ao que já existe (nunca apaga nada). Para cada registro vale o mais recente.
 * Devolve quantos registros e listas passaram a existir por causa do backup.
 */
export function restoreBackup(backup: Library): { entries: number; lists: number } {
  const cur = snapshot();
  const merged = mergeLibraries(cur, backup);
  const entries = Object.keys(merged.entries).filter((id) => !cur.entries[id]).length;
  const lists = Object.keys(merged.lists).filter((id) => !cur.lists[id]).length;
  set(merged);
  return { entries, lists };
}

export function exportData(): string {
  return JSON.stringify(snapshot(), null, 2);
}

export function deleteAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(CORRUPT_KEY);
    localStorage.removeItem(EVENTS_KEY);
    localStorage.setItem(DELETED_KEY, String(Date.now()));
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
