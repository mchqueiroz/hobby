"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SEED, titleKey } from "@/lib/catalog";
import { ownedTitles } from "@/lib/recommend";
import { setFavorites, track, useLibrary } from "@/lib/store";
import { Cover } from "@/components/ui";
import { MEDIA_LABEL } from "@/lib/types";

const MAX = 5;
const MIN = 3;

export default function Favoritos() {
  const router = useRouter();
  const lib = useLibrary();
  const [sel, setSel] = useState<string[]>([]);
  const options = useMemo(() => {
    const owned = ownedTitles(lib);
    return SEED.filter((i) => !lib.entries[i.id] && !owned.has(titleKey(i)));
  }, [lib]);

  function toggle(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]));
  }

  function done() {
    setFavorites(sel);
    track("favorites_done", { n: sel.length });
    router.push("/descobrir");
  }

  return (
    <>
      <div className="word">hobby</div>
      <h1 style={{ marginTop: 24 }}>O que você ama?</h1>
      <p className="sub">Escolha de {MIN} a {MAX} favoritos, de qualquer mídia. É com eles que começamos a sugerir.</p>

      <div className="grid3 mt24" role="group" aria-label="Favoritos">
        {options.map((it) => {
          const on = sel.includes(it.id);
          return (
            <button
              key={it.id} type="button" aria-pressed={on} aria-label={`${it.title}, ${MEDIA_LABEL[it.media]}`} onClick={() => toggle(it.id)}
              style={{ textAlign: "left", opacity: !on && sel.length >= MAX ? 0.45 : 1 }}
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
        <button type="button" className="btn" disabled={sel.length < MIN} onClick={done}>
          Continuar ({sel.length}/{MAX})
        </button>
      </div>
    </>
  );
}
