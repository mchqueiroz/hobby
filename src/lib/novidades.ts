"use client";

import { useEffect, useState } from "react";
import { recentFollowers, recentLikesOnMine, recentOnMine } from "./community";

const KEY = "hobby:seen";
const EVT = "hobby:seen-changed";

/** Quantos itens são mais novos que a última visita. Puro, para testar. */
export function countNewer(times: string[], since: number): number {
  return times.filter((t) => { const ms = Date.parse(t); return Number.isFinite(ms) && ms > since; }).length;
}

export function seenAt(userId: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    const n = v[userId];
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
export function markSeen(userId: string, now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    localStorage.setItem(KEY, JSON.stringify({ ...v, [userId]: now }));
  } catch { /* ignora */ }
  window.dispatchEvent(new Event(EVT));
}

/** Contagem de novidades (seguidores, comentários e curtidas) para o selo do menu. Falha em silêncio: é só um aviso. */
export function useNovidades(userId: string | null): number {
  const [n, setN] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(EVT, bump);
    const vis = () => { if (document.visibilityState === "visible") bump(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener(EVT, bump); document.removeEventListener("visibilitychange", vis); };
  }, []);
  useEffect(() => {
    let live = true;
    Promise.resolve(userId)
      .then(async (id) => {
        if (!id) return 0;
        const since = seenAt(id);
        const [f, c, l] = await Promise.all([recentFollowers(id), recentOnMine(id), recentLikesOnMine(id).catch(() => [])]);
        return countNewer(f.map((x) => x.at), since) + countNewer(c.map((x) => x.created_at), since) + countNewer(l.map((x) => x.at), since);
      })
      .catch(() => 0)
      .then((v) => { if (live) setN(v); });
    return () => { live = false; };
  }, [userId, tick]);
  return userId ? n : 0;
}
