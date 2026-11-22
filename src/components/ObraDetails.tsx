"use client";

import { useEffect, useState } from "react";
import type { Availability, Details } from "@/lib/details";
import { searchLinks } from "@/lib/availability";
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
        <Where item={item} />
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
        {d.similar && d.similar.length > 0 && (
          <div className="mt8"><dt className="muted" style={{ fontSize: 12 }}>Parecidos</dt><dd>{d.similar.join(", ")}</dd></div>
        )}
      </dl>
      <Where item={item} where={d.where} providers={d.providers} />
      {d.trailer && (
        <a className="btn ghost small mt12" style={{ width: "auto", display: "inline-flex" }} href={d.trailer} target="_blank" rel="noopener noreferrer">
          Ver trailer no YouTube ↗
        </a>
      )}
    </section>
  );
}

const GROUPS: { key: "flatrate" | "rent" | "buy" | "free"; label: string }[] = [
  { key: "flatrate", label: "Assinatura" },
  { key: "rent", label: "Aluguel" },
  { key: "buy", label: "Compra" },
  { key: "free", label: "Grátis (pode ter anúncios)" },
];
const SOURCE_NOTE: Record<Availability["source"], string> = {
  JustWatch: "Disponibilidade no Brasil: dados do JustWatch, via TMDB.",
  AniList: "Links de streaming informados pelo AniList.",
  IGDB: "Lojas informadas pelo IGDB.",
};

/** Onde encontrar a obra. Quando a fonte não sabe, mostramos só links de busca, e dizemos isso. */
function Where({ item, where, providers }: { item: Item; where?: Availability; providers?: string[] }) {
  const searches = searchLinks(item.media, item.title);
  const groups = where ? GROUPS.filter((g) => where[g.key].length > 0) : [];
  const flat = where?.flatrate.length ? [] : (providers ?? []);
  const known = groups.length > 0 || (where?.links.length ?? 0) > 0 || flat.length > 0;
  return (
    <section className="mt16" aria-label="Onde encontrar" data-testid="onde">
      <p className="label">Onde encontrar</p>
      {groups.map((g) => (
        <div key={g.key} className="mt8" data-testid={`onde-${g.key}`}>
          <p className="muted" style={{ fontSize: 12 }}>{g.label}</p>
          <p className="chips mt8">{where![g.key].map((p) => <span key={p} className="vibe">{p}</span>)}</p>
        </div>
      ))}
      {flat.length > 0 && <p className="chips mt8">{flat.map((p) => <span key={p} className="vibe">{p}</span>)}</p>}
      {where && where.links.length > 0 && (
        <p className="row gap8 mt8" style={{ flexWrap: "wrap" }} data-testid="onde-links">
          {where.links.map((l) => <a key={l.name} className="btn ghost small" style={{ width: "auto" }} href={l.url} target="_blank" rel="noopener noreferrer">{l.name} ↗</a>)}
        </p>
      )}
      {known && where && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {SOURCE_NOTE[where.source]}{where.pageUrl && <> <a href={where.pageUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Ver tudo no JustWatch</a></>}
          {" "}Catálogos mudam; confira no serviço.
        </p>
      )}
      {!known && <p className="muted" style={{ fontSize: 14 }}>Ainda não sabemos onde está disponível. Procure em:</p>}
      {searches.length > 0 && (
        <p className="row gap8 mt8" style={{ flexWrap: "wrap", alignItems: "center" }} data-testid="onde-busca">
          {known && <span className="muted" style={{ fontSize: 12 }}>Procurar em:</span>}
          {searches.map((l) => <a key={l.name} className="chip" href={l.url} target="_blank" rel="noopener noreferrer">{l.name} ↗</a>)}
        </p>
      )}
    </section>
  );
}
