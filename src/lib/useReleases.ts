"use client";

import { useEffect, useState } from "react";
import type { Details, Release } from "./details";
import type { Library } from "./types";
import { getItem } from "./recommend";
import { type Upcoming, upcoming } from "./releases";

const KEY = "hobby:releases:v1";
const TTL = 12 * 3_600_000;
const MAX = 40;
const SOURCES = ["tmdb", "igdb", "anilist"];
type Cache = Record<string, { at: number; release: Release | null }>;

const read = (): Cache => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Cache; } catch { return {}; } };
const write = (c: Cache) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sem espaço: tudo bem */ } };

/**
 * Datas de lançamento do que a pessoa quer ver, está vendo ou pausou (filmes, séries, jogos e animes).
 * Busca nos detalhes das fontes, 4 por vez, e guarda por 12 horas neste aparelho.
 */
export function useReleases(lib: Library, ready: boolean): { list: Upcoming[]; loading: boolean; checked: number } {
  const [state, setState] = useState<{ list: Upcoming[]; loading: boolean; checked: number }>({ list: [], loading: true, checked: 0 });

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const now = Date.now();
    const wanted = Object.values(lib.entries)
      .filter((e) => e.status === "quero" || e.status === "andamento" || e.status === "pausei")
      .map((e) => getItem(lib, e.itemId))
      .filter((it): it is NonNullable<typeof it> => !!it && SOURCES.includes(it.source))
      .slice(0, MAX);
    const cache = read();
    const rows = () => wanted.map((item) => ({ item, release: cache[item.id]?.release ?? undefined }));
    const publish = (loading: boolean) => setState({ list: upcoming(rows(), Date.now()), loading, checked: wanted.length });
    const stale = wanted.filter((it) => !cache[it.id] || now - cache[it.id].at > TTL);
    publish(stale.length > 0);
    if (stale.length === 0) return;
    let i = 0;
    const worker = async () => {
      while (i < stale.length && !ctrl.signal.aborted) {
        const it = stale[i++];
        const q = new URLSearchParams({ id: it.id, title: it.title, media: it.media });
        if (it.year) q.set("year", String(it.year));
        try {
          const r = await fetch(`/api/details?${q}`, { signal: ctrl.signal });
          const b = (r.ok ? await r.json() : { details: null }) as { details?: Details | null };
          cache[it.id] = { at: Date.now(), release: b.details?.release ?? null };
        } catch { /* sem rede: tenta de novo na próxima visita */ }
        if (!ctrl.signal.aborted) publish(true);
      }
    };
    Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      if (ctrl.signal.aborted) return;
      write(cache);
      publish(false);
    });
    return () => ctrl.abort();
  }, [lib, ready]);

  return state;
}
