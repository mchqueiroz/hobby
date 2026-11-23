"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cacheItem, saveEntry, track, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, statusLabel, wantLabel, type Media } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { Chips, Cover, Header, MediaTag } from "@/components/ui";
import { useShell } from "@/components/Shell";

const FILTERS: { value: Media | "tudo"; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  ...MEDIAS.map((m) => ({ value: m, label: MEDIA_PLURAL[m][0].toUpperCase() + MEDIA_PLURAL[m].slice(1) })),
];

export default function Buscar() {
  const lib = useLibrary();
  const ready = useHydrated();
  const { openRegister, toast } = useShell();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Media | "tudo">("tudo");
  const { results: all, searching, active } = useSearch(q, 60);
  const results = (media === "tudo" ? all : all.filter((r) => r.media === media)).slice(0, 24);

  useEffect(() => { input.current?.focus(); }, [ready]);
  useEffect(() => {
    if (active) track("search_global", { len: q.trim().length });
    // conta uma busca por termo digitado, não por tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!ready) return null;
  return (
    <>
      <Header title="Buscar" sub="Anime, mangá, jogo, filme, série ou livro." />
      <label className="label" htmlFor="busca-global">Nome da obra</label>
      <input id="busca-global" ref={input} className="field" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Ex.: Death Note, Hades, Duna" autoComplete="off" type="search" />
      {active && <div className="mt12"><Chips label="Filtrar por mídia" options={FILTERS} value={media} onChange={setMedia} /></div>}
      {searching && <p className="muted mt12" style={{ fontSize: 13 }} role="status">Buscando…</p>}
      {q.trim() && !searching && results.length === 0 && (
        <p className="muted mt12" style={{ fontSize: 14 }}>{media === "tudo" ? "Não encontramos esse título." : `Nada em ${MEDIA_PLURAL[media]} com esse nome. Tente "Tudo".`}</p>
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
                  {e && <span className="muted" style={{ fontSize: 12 }}>{statusLabel(e.status, r.media)}</span>}
                </span>
              </Link>
              {!e ? (
                <button type="button" className="btn ghost small" style={{ width: "auto", padding: "0 12px" }}
                  aria-label={`${wantLabel(r.media)} ${r.title}`}
                  onClick={() => {
                    saveEntry(r, "quero");
                    track("quick_want", { from: "buscar" });
                    toast(`${r.title}: ${wantLabel(r.media)}`, () => { undoLast(); });
                  }}>+ {wantLabel(r.media)}</button>
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
