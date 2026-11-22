import type { Entry, Item, Library, UserList } from "./types";
import { EMPTY_LIBRARY } from "./types";

/**
 * Junta duas bibliotecas (a do aparelho e a da nuvem) sem perder o que cada uma tem.
 *
 * Regra: para cada "coisa" (um registro, um "não é pra mim", uma lista, a meta) vale a versão mais recente.
 * Apagar também é uma mudança com data (carimbo sem valor), senão o dado apagado voltaria no próximo sync.
 * A comparação é uma ordem total, (carimbo, existe, texto), então o resultado não depende de quem é "a" e quem é "b",
 * juntar duas vezes dá o mesmo, e juntar três em qualquer agrupamento dá o mesmo. Há testes de propriedade para isso.
 *
 * Limites honestos: o relógio de cada aparelho decide quem é "mais recente"; uma lista editada em dois aparelhos
 * ao mesmo tempo fica com a versão mais nova inteira (não mistura os itens).
 */

type Slot<T> = { ts: number; present: boolean; value?: T };

const DEFAULT_GOAL = EMPTY_LIBRARY.goal;

/** JSON com chaves em ordem fixa: serve de desempate e de comparação entre bibliotecas. */
export function canonical(x: unknown): string {
  if (x === undefined) return "";
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  const o = x as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}

/** Ordem total entre versões da mesma coisa. */
function pick<T>(a: Slot<T>, b: Slot<T>): Slot<T> {
  if (a.ts !== b.ts) return a.ts > b.ts ? a : b;
  if (a.present !== b.present) return a.present ? a : b;
  return canonical(a.value) >= canonical(b.value) ? a : b;
}

/** Carimbo de uma chave. Sem carimbo gravado, dado antigo vale pela própria data; sem dado nenhum, "nunca soube" (-1). */
function slot<T>(ts: Record<string, number> | undefined, key: string, value: T | undefined, legacy: number): Slot<T> {
  const present = value !== undefined;
  const t = ts?.[key];
  return { ts: t !== undefined ? t : present ? legacy : -1, present, value };
}

export function mergeLibraries(a: Library, b: Library): Library {
  const ts: Record<string, number> = {};
  const note = (key: string, s: Slot<unknown>) => {
    if (s.ts >= 0) ts[key] = s.ts; // grava também o carimbo que veio de dado antigo, para a conta fechar em qualquer ordem
  };

  const entries: Record<string, Entry> = {};
  for (const id of new Set([...Object.keys(a.entries), ...Object.keys(b.entries), ...keysOf(a.ts, "e:"), ...keysOf(b.ts, "e:")])) {
    const ea = a.entries[id];
    const eb = b.entries[id];
    const w = pick(slot(a.ts, `e:${id}`, ea, ea?.at ?? 0), slot(b.ts, `e:${id}`, eb, eb?.at ?? 0));
    note(`e:${id}`, w);
    if (w.present) entries[id] = w.value!;
  }

  const dismissed: string[] = [];
  const da = new Set(a.dismissed);
  const db = new Set(b.dismissed);
  for (const id of new Set([...da, ...db, ...keysOf(a.ts, "d:"), ...keysOf(b.ts, "d:")])) {
    const w = pick(slot(a.ts, `d:${id}`, da.has(id) ? true : undefined, 0), slot(b.ts, `d:${id}`, db.has(id) ? true : undefined, 0));
    note(`d:${id}`, w);
    if (w.present) dismissed.push(id);
  }
  dismissed.sort();

  const lists: Record<string, UserList> = {};
  for (const id of new Set([...Object.keys(a.lists), ...Object.keys(b.lists), ...keysOf(a.ts, "l:"), ...keysOf(b.ts, "l:")])) {
    const la = a.lists[id];
    const lb = b.lists[id];
    const w = pick(slot(a.ts, `l:${id}`, la, la?.createdAt ?? 0), slot(b.ts, `l:${id}`, lb, lb?.createdAt ?? 0));
    note(`l:${id}`, w);
    if (w.present) lists[id] = w.value!;
  }

  // meta: sem carimbo, a que a pessoa mexeu (diferente do padrão) vale mais que a padrão
  const g = pick(
    slot(a.ts, "g", a.goal, a.goal === DEFAULT_GOAL ? -1 : 0),
    slot(b.ts, "g", b.goal, b.goal === DEFAULT_GOAL ? -1 : 0),
  );
  note("g", g);

  // cache de itens: só o que algum registro, lista ou "não é pra mim" ainda usa; versões diferentes: desempate fixo
  const needed = new Set<string>([...Object.keys(entries), ...dismissed, ...Object.values(lists).flatMap((l) => l.itemIds)]);
  const items: Record<string, Item> = {};
  for (const id of needed) {
    const ia = a.items[id];
    const ib = b.items[id];
    const it = ia && ib ? (canonical(ia) >= canonical(ib) ? ia : ib) : (ia ?? ib);
    if (it) items[id] = it;
  }

  const out: Library = { items, entries, dismissed, goal: g.value ?? DEFAULT_GOAL, lists };
  if (Object.keys(ts).length) out.ts = ts;
  return out;
}

function keysOf(ts: Record<string, number> | undefined, prefix: string): string[] {
  return ts ? Object.keys(ts).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)) : [];
}

/** Duas bibliotecas dizem a mesma coisa? (ignora a ordem das chaves) */
export function sameLibrary(a: Library, b: Library): boolean {
  return canonical(mergeLibraries(a, a)) === canonical(mergeLibraries(b, b));
}

/** Carimba as chaves que acabaram de mudar. */
export function touch(lib: Library, keys: string[], now = Date.now()): Library["ts"] {
  const ts = { ...lib.ts };
  for (const k of keys) ts[k] = Math.max(now, (ts[k] ?? 0) + 1); // sempre maior que o anterior, mesmo com relógio travado
  return ts;
}

/** O que sobe para a nuvem. A versão do formato permite mudar isto no futuro sem quebrar aparelhos antigos. */
export const REMOTE_VERSION = 1;
export interface RemoteLibrary {
  v: number;
  lib: Library;
}

/** Lê o que veio da nuvem sem confiar no formato: o que não bate vira biblioteca vazia (nunca apaga o local, pois o merge só soma). */
export function parseRemote(data: unknown): Library {
  const raw = (data as RemoteLibrary | null)?.lib as Partial<Library> | undefined;
  if (!raw || typeof raw !== "object") return EMPTY_LIBRARY;
  const obj = <T,>(x: unknown): Record<string, T> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, T>) : {});
  const lists = obj<UserList>(raw.lists);
  for (const [id, l] of Object.entries(lists)) {
    if (!l || typeof l.name !== "string" || !Array.isArray(l.itemIds)) delete lists[id];
  }
  const entries = obj<Entry>(raw.entries);
  for (const [id, e] of Object.entries(entries)) {
    if (!e || typeof e.status !== "string" || e.itemId !== id) delete entries[id];
  }
  const ts: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj<number>(raw.ts))) if (typeof v === "number" && Number.isFinite(v)) ts[k] = v;
  const out: Library = {
    items: obj<Item>(raw.items),
    entries,
    dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((d): d is string => typeof d === "string") : [],
    goal: typeof raw.goal === "number" && Number.isFinite(raw.goal) ? raw.goal : DEFAULT_GOAL,
    lists,
  };
  if (Object.keys(ts).length) out.ts = ts;
  return out;
}

/**
 * Lê um arquivo de backup ("Exportar meus dados") sem confiar nele. Devolve a biblioteca limpa ou o motivo da recusa.
 * Só aceita JSON com cara de biblioteca (precisa ter `entries` ou `lists`), para não "restaurar" um arquivo qualquer.
 */
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
export function parseBackup(text: string): { ok: true; lib: Library } | { ok: false; error: string } {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "Arquivo grande demais para ser um backup do Hobby." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Esse arquivo não é um JSON válido." };
  }
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || Array.isArray(o) || (typeof o.entries !== "object" && typeof o.lists !== "object")) {
    return { ok: false, error: "Esse arquivo não parece um backup do Hobby (exportado em Perfil > Seus dados)." };
  }
  return { ok: true, lib: parseRemote({ lib: o }) };
}
