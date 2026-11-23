"use client";

import { useEffect, useState } from "react";
import { mergeResults, rankByRelevance, searchItems } from "./search";
import { useLibrary } from "./store";
import type { Item } from "./types";

/** Busca no catálogo local e, depois de uma pausa na digitação, nas APIs. Falha de rede nunca atrapalha o catálogo local. */
export function useSearch(q: string, limit = 12) {
  const lib = useLibrary();
  const [remote, setRemote] = useState<{ term: string; items: Item[] }>({ term: "", items: [] });
  const term = q.trim();
  const active = term.length >= 2;

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((b: { items?: Item[] }) => setRemote({ term, items: Array.isArray(b.items) ? b.items : [] }))
        .catch((e) => {
          if (e?.name !== "AbortError") setRemote({ term, items: [] });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term]);

  const searching = active && remote.term !== term;
  const results = mergeResults(searchItems(lib, q, limit), active && remote.term === term ? rankByRelevance(term, remote.items) : [], limit);
  return { results, searching, active, term };
}
