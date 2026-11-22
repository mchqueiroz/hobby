"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SEED, titleKey } from "@/lib/catalog";
import { pickBest, splitFavorites } from "@/lib/search";
import { ownedTitles } from "@/lib/recommend";
import { importHistory, setFavorites, track, useLibrary } from "@/lib/store";
import { Cover } from "@/components/ui";
import { MEDIA_LABEL, type Item } from "@/lib/types";

const MAX = 5;
const MIN = 3;

export default function Favoritos() {
  const router = useRouter();
  const lib = useLibrary();
  const [sel, setSel] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState<string[]>([]);
  const count = sel.length + found.length;

  /** Cada termo escrito vira uma busca nas fontes reais; fica o resultado que mais parece com o que foi digitado. */
  async function findTyped(e: React.FormEvent) {
    e.preventDefault();
    const terms = splitFavorites(typed, MAX - count);
    if (terms.length === 0 || busy) return;
    setBusy(true);
    const hits = await Promise.all(
      terms.map(async (t) => {
        try {
          const r = await fetch(`/api/search?q=${encodeURIComponent(t)}`);
          const b = (await r.json()) as { items?: Item[] };
          return pickBest(t, b.items ?? []);
        } catch {
          return null;
        }
      }),
    );
    setBusy(false);
    setMiss(terms.filter((_, i) => !hits[i]));
    setFound((f) => {
      const ids = new Set(f.map((i) => i.id));
      return [...f, ...hits.filter((h): h is Item => !!h && !ids.has(h.id) && !ids.add(h.id))].slice(0, MAX - sel.length);
    });
    setTyped("");
  }
  const options = useMemo(() => {
    const owned = ownedTitles(lib);
    return SEED.filter((i) => !lib.entries[i.id] && !owned.has(titleKey(i)));
  }, [lib]);

  function toggle(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length + found.length >= MAX ? s : [...s, id]));
  }

  function done() {
    setFavorites(sel);
    if (found.length) {
      const at = Date.now();
      importHistory({
        items: found,
        entries: found.map((i) => ({ itemId: i.id, status: "concluido", rating: 5, at })),
        counts: { quero: 0, andamento: 0, concluido: found.length, abandonei: 0, pausei: 0 },
        withoutVibes: found.filter((i) => i.vibes.length === 0).length,
      });
    }
    track("favorites_done", { n: count, typed: found.length });
    router.push("/descobrir");
  }

  return (
    <>
      <div className="word">hobby</div>
      <h1 style={{ marginTop: 24 }}>O que você ama?</h1>
      <p className="sub">Escolha de {MIN} a {MAX} favoritos, de qualquer mídia. É com eles que começamos a sugerir.</p>

      <form onSubmit={findTyped} className="mt16">
        <label className="label" htmlFor="fav-texto">Escreva seus favoritos</label>
        <div className="row gap8">
          <input id="fav-texto" className="field" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="Dark, Persona 5, Kafka à beira-mar" disabled={count >= MAX} />
          <button type="submit" className="btn small" style={{ width: "auto" }} disabled={busy || count >= MAX || splitFavorites(typed).length === 0}>
            {busy ? "Buscando…" : "Adicionar"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Qualquer mídia, separados por vírgula. Ou toque nas capas abaixo.</p>
        {miss.length > 0 && <p role="status" className="muted" style={{ fontSize: 13 }}>Não achamos: {miss.join(", ")}.</p>}
        {found.length > 0 && (
          <div className="row gap8 mt8" style={{ flexWrap: "wrap" }} aria-label="Favoritos escritos" role="group">
            {found.map((it) => (
              <button key={it.id} type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`Remover ${it.title}`}
                onClick={() => setFound((f) => f.filter((x) => x.id !== it.id))}>
                {it.title} · {MEDIA_LABEL[it.media]} ✕
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="grid3 mt24" role="group" aria-label="Favoritos">
        {options.map((it) => {
          const on = sel.includes(it.id);
          return (
            <button
              key={it.id} type="button" aria-pressed={on} aria-label={`${it.title}, ${MEDIA_LABEL[it.media]}`} onClick={() => toggle(it.id)}
              style={{ textAlign: "left", opacity: !on && count >= MAX ? 0.45 : 1 }}
            >
              <div style={{ position: "relative" }}>
                <Cover item={it} w={106} h={140} fs={12} />
                {on && (
                  <span aria-hidden="true" style={{ position: "absolute", top: 6, right: 6, background: "var(--ink)", color: "var(--paper)", width: 24, height: 24, borderRadius: "50%", textAlign: "center", lineHeight: "24px", fontSize: 14 }}>✓</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "var(--paper)", padding: "14px 0 6px", marginTop: 16 }}>
        <button type="button" className="btn" disabled={count < MIN} onClick={done}>
          Continuar ({count}/{MAX})
        </button>
      </div>
    </>
  );
}
