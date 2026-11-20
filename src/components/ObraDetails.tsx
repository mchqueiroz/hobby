"use client";

import { useEffect, useState } from "react";
import type { Details } from "@/lib/details";
import type { Item } from "@/lib/types";

const MAKERS_LABEL = { filme: "Direção e criação", jogo: "Desenvolvimento", anime: "Estúdio e autoria", manga: "Autoria", livro: "Autoria", musica: "Artista" } as const;

type State = { s: "loading" } | { s: "ok"; d: Details } | { s: "none" };

/** Sinopse, elenco, trailer e onde assistir, buscados no servidor. Sem a chave da fonte, mostra um aviso discreto. */
export function ObraDetails({ item }: { item: Item }) {
  const [st, setSt] = useState<State>({ s: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ id: item.id, title: item.title, media: item.media });
    if (item.year) q.set("year", String(item.year));
    if (item.author) q.set("artist", item.author);
    fetch(`/api/details?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { details: null }))
      .then((b: { details?: Details | null }) => setSt(b.details ? { s: "ok", d: b.details } : { s: "none" }))
      .catch((e) => {
        if (e?.name !== "AbortError") setSt({ s: "none" });
      });
    return () => ctrl.abort();
  }, [item.id, item.title, item.media, item.year, item.author]);

  if (st.s === "loading") {
    return (
      <section aria-label="Sobre a obra" aria-busy="true">
        <p className="label">Sobre</p>
        <p className="muted" style={{ fontSize: 14 }}>Carregando detalhes…</p>
      </section>
    );
  }
  if (st.s === "none") {
    return (
      <section aria-label="Sobre a obra">
        <p className="label">Sobre</p>
        <p className="muted" style={{ fontSize: 14 }}>Não encontramos detalhes dessa obra agora.</p>
      </section>
    );
  }
  const d = st.d;
  const media = item.media as keyof typeof MAKERS_LABEL;
  return (
    <section aria-label="Sobre a obra">
      <p className="label">Sobre</p>
      {d.facts.length > 0 && <p className="muted" style={{ fontSize: 13 }}>{d.facts.join(" · ")}</p>}
      {d.synopsis && <p className="review mt8">{d.synopsis}</p>}
      <dl style={{ fontSize: 14, marginTop: 10 }}>
        {d.makers && d.makers.length > 0 && (
          <div className="mt8"><dt className="muted" style={{ fontSize: 12 }}>{MAKERS_LABEL[media] ?? "Criação"}</dt><dd>{d.makers.join(", ")}</dd></div>
        )}
        {d.cast && d.cast.length > 0 && (
          <div className="mt8"><dt className="muted" style={{ fontSize: 12 }}>Elenco</dt><dd>{d.cast.join(", ")}</dd></div>
        )}
        {d.score && (
          <div className="mt8"><dt className="muted" style={{ fontSize: 12 }}>Nota em {d.score.source}</dt><dd>{String(d.score.value).replace(".", ",")} de 10</dd></div>
        )}
        {d.providers && d.providers.length > 0 && (
          <div className="mt8">
            <dt className="muted" style={{ fontSize: 12 }}>Onde assistir no Brasil (assinatura)</dt>
            <dd className="chips mt8">{d.providers.map((p) => <span key={p} className="vibe">{p}</span>)}</dd>
          </div>
        )}
        {d.similar && d.similar.length > 0 && (
          <div className="mt8"><dt className="muted" style={{ fontSize: 12 }}>Parecidos</dt><dd>{d.similar.join(", ")}</dd></div>
        )}
      </dl>
      {d.trailer && (
        <a className="btn ghost small mt12" style={{ width: "auto", display: "inline-flex" }} href={d.trailer} target="_blank" rel="noopener noreferrer">
          Ver trailer no YouTube ↗
        </a>
      )}
    </section>
  );
}
