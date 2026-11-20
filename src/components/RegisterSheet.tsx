"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABEL, type Item, type Status } from "@/lib/types";
import { fmtRating } from "@/lib/recommend";
import { mergeResults, searchItems } from "@/lib/search";
import { MAX_REVIEW, saveEntry, track, undoLast, useLibrary } from "@/lib/store";
import { Chips, Cover, MediaTag, StarInput } from "./ui";
import { useShell } from "./Shell";

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }));

/**
 * Registro rápido. O caminho curto são dois toques: escolher o item e tocar na nota.
 * Cada toque é contado e o tempo medido, porque "registrar em até 5 s e 2 toques" é uma hipótese do plano.
 */
export function RegisterSheet({ initial, onClose }: { initial?: Item; onClose: () => void }) {
  const lib = useLibrary();
  const { toast } = useShell();
  const [q, setQ] = useState("");
  const [item, setItem] = useState<Item | undefined>(initial);
  const [status, setStatus] = useState<Status>(initial ? (lib.entries[initial.id]?.status ?? "concluido") : "concluido");
  const t0 = useRef(0);
  const taps = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    t0.current = performance.now();
    track("register_open", { from: initial ? "item" : "tab" });
    if (!initial) input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [remote, setRemote] = useState<{ term: string; items: Item[] }>({ term: "", items: [] });
  const term = q.trim();
  const active = term.length >= 2;
  const searching = active && remote.term !== term;

  // busca nas APIs depois de uma pausa na digitação; falha da rede nunca atrapalha o catálogo local
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

  const results = mergeResults(searchItems(lib, q), active && remote.term === term ? remote.items : []);
  const existing = item ? lib.entries[item.id] : undefined;
  const [writing, setWriting] = useState(false);
  const [review, setReview] = useState("");

  function pick(it: Item) {
    taps.current += 1;
    setItem(it);
    setReview(lib.entries[it.id]?.review ?? "");
    setWriting(false);
    setStatus(lib.entries[it.id]?.status ?? "concluido");
  }

  function save(rating?: number) {
    if (!item) return;
    taps.current += 1;
    const ms = Math.round(performance.now() - t0.current);
    saveEntry(item, status, rating, review);
    track("register_save", { ms, taps: taps.current, status, rated: rating !== undefined, reviewed: review.trim().length > 0, from: initial ? "item" : "tab" });
    toast(`${item.title}: ${rating !== undefined ? `${fmtRating(rating)}★` : STATUS_LABEL[status]}`, () => {
      undoLast();
      track("register_undo");
    });
    onClose();
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Registrar">
        <div className="grab" aria-hidden="true" />
        <h2>Registrar</h2>

        {!item && (
          <>
            <label className="label" htmlFor="busca" style={{ marginTop: 14 }}>Buscar</label>
            <input
              id="busca" ref={input} className="field" value={q} placeholder="Nome do anime, mangá, jogo, filme, série, livro ou álbum"
              onChange={(e) => setQ(e.target.value)} autoComplete="off"
            />
            <ul style={{ listStyle: "none", marginTop: 10 }}>
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" className="result" onClick={() => pick(r)}>
                    <Cover item={r} w={40} h={54} fs={11} />
                    <span>
                      <strong style={{ fontSize: 15, display: "block" }}>{r.title}</strong>
                      <span className="row gap8" style={{ marginTop: 4 }}>
                        <MediaTag media={r.media} />
                        {r.year && <span className="muted" style={{ fontSize: 12 }}>{r.year}</span>}
                        {lib.entries[r.id] && <span className="muted" style={{ fontSize: 12 }}>já na sua biblioteca</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {searching && <p className="muted" style={{ marginTop: 10, fontSize: 13 }} role="status">Buscando…</p>}
            {q.trim() && !searching && results.length === 0 && (
              <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>Não encontramos esse título.</p>
            )}
          </>
        )}

        {item && (
          <>
            <div className="row mt16" style={{ gap: 12 }}>
              <Cover item={item} w={56} h={78} fs={11} />
              <div>
                <strong style={{ fontFamily: "Lora, serif", fontSize: 19 }}>{item.title}</strong>
                <div className="mt8"><MediaTag media={item.media} /></div>
              </div>
            </div>
            <p className="label">Status</p>
            <Chips label="Status" options={STATUS_OPTIONS} value={status} onChange={(s) => { taps.current += 1; setStatus(s); }} />
            {writing || review ? (
              <>
                <label className="label" htmlFor="resenha-registro">Sua resenha (opcional)</label>
                <textarea id="resenha-registro" className="field" rows={3} maxLength={MAX_REVIEW} value={review} onChange={(e) => setReview(e.target.value)}
                  placeholder="O que você achou? Escreva aqui e depois toque na nota para salvar tudo junto." />
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{review.length}/{MAX_REVIEW}. Só aparece para outras pessoas se você publicar seu perfil e liberar resenhas em Comunidade.</p>
              </>
            ) : (
              <button type="button" className="chip mt12" onClick={() => setWriting(true)}>+ Escrever resenha</button>
            )}
            <p className="label">Sua nota (toque para salvar)</p>
            <StarInput value={existing?.rating} onPick={save} />
            <div className="row gap8 mt16">
              <button type="button" className="btn ghost small" onClick={() => save(undefined)}>Salvar sem nota</button>
              {!initial && (
                <button type="button" className="btn ghost small" onClick={() => { setItem(undefined); setQ(""); }}>Trocar item</button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
