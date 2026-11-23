"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useHydrated, useLibrary } from "@/lib/store";
import { applyFilters, allRows, DEFAULT_FILTERS, facets, isFiltered, type Filters, type Sort, type StatusFilter } from "@/lib/libraryFilter";
import { MEDIAS, MEDIA_PLURAL, progressText, statusLabel, type Media } from "@/lib/types";
import { Chips, Cover, Header, MediaTag, ProgressBar, Rating } from "@/components/ui";
import { FilterRow } from "@/components/FilterRow";
import { LibNav } from "@/components/LibNav";

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "concluido", label: "Concluídos" },
  { value: "andamento", label: "Em andamento" },
  { value: "quero", label: "Quero ver" },
  { value: "pausei", label: "Pausei" },
  { value: "abandonei", label: "Abandonei" },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "nota", label: "Maiores notas" },
  { value: "titulo", label: "A-Z" },
  { value: "ano", label: "Ano" },
];
const VIEWS: { value: "lista" | "grade"; label: string }[] = [
  { value: "lista", label: "Lista" },
  { value: "grade", label: "Grade" },
];
// os filtros lembram o que você escolheu enquanto navega pelo app (volta de uma obra e continua igual)
let remembered: Filters = DEFAULT_FILTERS;

export default function Biblioteca() {
  const lib = useLibrary();
  const ready = useHydrated();
  const [f, setF] = useState<Filters>(remembered);
  const [view, setView] = useState<"lista" | "grade">("lista");
  const [more, setMore] = useState(() => remembered.era !== "tudo" || remembered.vibes.length > 0 || remembered.tags.length > 0 || remembered.format !== "tudo" || remembered.sort !== "recentes");
  const set = (p: Partial<Filters>) => setF((cur) => (remembered = { ...cur, ...p }));

  const all = useMemo(() => allRows(lib), [lib]);
  const rows = useMemo(() => applyFilters(all, f), [all, f]);
  const fc = useMemo(() => facets(all, f), [all, f]);

  const activeExtra = (f.era !== "tudo" ? 1 : 0) + f.vibes.length + f.tags.length + (f.format !== "tudo" ? 1 : 0) + (f.sort !== "recentes" ? 1 : 0);
  if (!ready) return null;
  const total = Object.keys(lib.entries).length;

  return (
    <>
      <Header title="Biblioteca" sub={total ? `${total} itens, todas as mídias em um só lugar` : undefined} />
      <LibNav current="/biblioteca" />
      <div className="row gap8 mt16" style={{ alignItems: "center" }}>
        <input className="field" type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Filtrar pelo título"
          placeholder="Buscar título ou autor" style={{ flex: 1, padding: 10 }} />
        <Chips label="Visualização" options={VIEWS} value={view} onChange={setView} />
      </div>

      <div className="filters mt12">
        <FilterRow label="Status" selected={f.status} onPick={(status) => set({ status })}
          options={STATUSES.map((o) => ({ ...o, count: o.value === "todos" ? Object.values(fc.status).reduce((a, b) => a + b, 0) : fc.status[o.value] }))} />
        <FilterRow label="Categoria" selected={f.media} onPick={(m) => set({ media: m })}
          options={[{ value: "tudo" as Media | "tudo", label: "Tudo", count: fc.media.tudo },
            ...MEDIAS.map((m) => ({ value: m as Media | "tudo", label: MEDIA_PLURAL[m][0].toUpperCase() + MEDIA_PLURAL[m].slice(1), count: fc.media[m] }))]} />
        <details className="morefilters" open={more} onToggle={(e) => setMore(e.currentTarget.open)}>
          <summary>
            Época, estilo e ordem
            {activeExtra > 0 && <span className="n" data-testid="filtros-ativos">{activeExtra}</span>}
          </summary>
          <FilterRow label="Época" selected={f.era} onPick={(era) => set({ era: era === f.era ? "tudo" : era })}
            options={[{ value: "tudo", label: "Todas", count: undefined }, ...fc.eras.map((e) => ({ value: e.key, label: e.label, count: e.count }))]} />
          {fc.vibes.length > 0 && (
            <FilterRow label="Estilo" selected={f.vibes} onPick={(v) => set({ vibes: f.vibes.includes(v) ? f.vibes.filter((x) => x !== v) : [...f.vibes, v] })}
              options={fc.vibes.map((v) => ({ value: v.vibe, label: v.vibe, count: v.count }))} />
          )}
          {fc.tags.length > 0 && (
            <FilterRow label="Etiquetas" selected={f.tags} onPick={(t) => set({ tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
              options={fc.tags.map((t) => ({ value: t.tag, label: t.tag, count: t.count }))} />
          )}
          {fc.formats.length > 0 && (
            <FilterRow label="Plataforma / formato" selected={f.format} onPick={(v) => set({ format: v === f.format ? "tudo" : v })}
              options={fc.formats.map((x) => ({ value: x.format, label: x.format, count: x.count }))} />
          )}
          <FilterRow label="Ordenar por" selected={f.sort} onPick={(sort) => set({ sort })} options={SORTS} />
        </details>
      </div>

      {total > 0 && (
        <p className="row gap8 mt12" style={{ alignItems: "center", fontSize: 13 }} role="status" data-testid="resumo">
          <span className="muted">{rows.length} {rows.length === 1 ? "item" : "itens"}{isFiltered(f) ? " com esses filtros" : ""}</span>
          {isFiltered(f) && <button type="button" className="chip" onClick={() => set({ media: "tudo", era: "tudo", vibes: [], tags: [], format: "tudo", q: "" })}>Limpar filtros</button>}
        </p>
      )}

      {rows.length === 0 && (
        <div className="empty">
          <h2>{total === 0 ? "Sua biblioteca está vazia" : "Nada por aqui"}</h2>
          <p>{total === 0 ? "Toque no + para registrar o primeiro item ou importe seu histórico." : isFiltered(f) ? "Nenhum item combina com esses filtros. Tire algum deles." : "Nada nesse status ainda. Registre algo novo com o +."}</p>
          {total === 0 && <Link href="/importar" className="btn mt16">Importar histórico</Link>}
        </div>
      )}

      <ul style={view === "grade" ? undefined : { listStyle: "none" }} className={view === "grade" ? "mt16 grid-view" : "mt16 cols2"}>
        {rows.map(({ e, item }) => view === "grade" ? (
          <li key={item.id}>
            <Link href={`/item/${encodeURIComponent(item.id)}`} aria-label={`${item.title}, ${statusLabel(e.status, item.media)}`}>
              <span className="poster"><Cover item={item} w={96} h={134} fs={11} /></span>
              <strong style={{ fontSize: 13, display: "block", marginTop: 6 }}>{item.title}</strong>
              <span style={{ display: "block", marginTop: 2 }}><Rating value={e.rating} size={12} /></span>
            </Link>
          </li>
        ) : (
          <li key={item.id}>
            <Link href={`/item/${encodeURIComponent(item.id)}`} className="row" style={{ gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)", minHeight: 64 }}>
              <Cover item={item} w={44} h={60} fs={11} />
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, display: "block" }}>{item.title}</strong>
                <span className="row gap8" style={{ marginTop: 4 }}>
                  <MediaTag media={item.media} />
                  <span className="muted" style={{ fontSize: 12 }}>{statusLabel(e.status, item.media)}{e.status === "andamento" && e.progress ? ` · ${progressText(item.media, e.progress)}${e.total ? ` de ${e.total}` : ""}` : ""}{(e.rounds ?? 1) > 1 ? ` · ${e.rounds} vezes` : ""}</span>
                  {e.status === "andamento" && e.total ? <span style={{ display: "block", marginTop: 4 }}><ProgressBar value={e.progress ?? 0} total={e.total} label={`${item.title}: ${e.progress ?? 0} de ${e.total}`} /></span> : null}
                </span>
              </span>
              <Rating value={e.rating} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
