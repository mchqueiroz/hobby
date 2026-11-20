"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cacheItem, saveEntry, track, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { STATUS_LABEL } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { Cover, Header, MediaTag } from "@/components/ui";
import { useShell } from "@/components/Shell";

export default function Buscar() {
  const lib = useLibrary();
  const ready = useHydrated();
  const { openRegister, toast } = useShell();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { results, searching, active } = useSearch(q);

  useEffect(() => { input.current?.focus(); }, [ready]);
  useEffect(() => {
    if (active) track("search_global", { len: q.trim().length });
    // conta uma busca por termo digitado, não por tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!ready) return null;
  return (
    <>
      <Header title="Buscar" sub="Anime, jogo, filme ou série. Aperte / em qualquer tela para chegar aqui." />
      <label className="label" htmlFor="busca-global">Nome da obra</label>
      <input id="busca-global" ref={input} className="field" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Ex.: Death Note, Hades, Duna" autoComplete="off" type="search" />
      {searching && <p className="muted mt12" style={{ fontSize: 13 }} role="status">Buscando…</p>}
      {q.trim() && !searching && results.length === 0 && (
        <p className="muted mt12" style={{ fontSize: 14 }}>Não encontramos esse título.</p>
      )}
      <ul className="mt12" style={{ listStyle: "none" }}>
        {results.map((r) => {
          const e = lib.entries[r.id];
          return (
            <li key={r.id} className="row" style={{ gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)", minHeight: 64 }}>
              <Cover item={r} w={44} h={60} fs={11} />
              <Link href={`/item/${encodeURIComponent(r.id)}`} onClick={() => cacheItem(r)} style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, display: "block" }}>{r.title}</strong>
                <span className="row gap8" style={{ marginTop: 4 }}>
                  <MediaTag media={r.media} />
                  {r.year && <span className="muted" style={{ fontSize: 12 }}>{r.year}</span>}
                  {e && <span className="muted" style={{ fontSize: 12 }}>{STATUS_LABEL[e.status]}</span>}
                </span>
              </Link>
              {!e ? (
                <button type="button" className="btn ghost small" style={{ width: "auto", padding: "0 12px" }}
                  aria-label={`Quero ver ${r.title}`}
                  onClick={() => {
                    saveEntry(r, "quero");
                    track("quick_want", { from: "buscar" });
                    toast(`${r.title}: Quero ver`, () => { undoLast(); });
                  }}>+ Quero ver</button>
              ) : (
                <button type="button" className="btn ghost small" style={{ width: "auto", padding: "0 12px" }}
                  onClick={() => openRegister(r)}>Editar</button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
