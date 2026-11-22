"use client";

import Link from "next/link";
import { useMemo } from "react";
import { dueLabel, groupUpcoming, releaseLabel } from "@/lib/releases";
import { useReleases } from "@/lib/useReleases";
import { useHydrated, useLibrary } from "@/lib/store";
import { Cover, Header, MediaTag } from "@/components/ui";
import { LibNav } from "@/components/LibNav";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

export default function Lancamentos() {
  const lib = useLibrary();
  const ready = useHydrated();
  const { list, loading, checked } = useReleases(lib, ready);
  const groups = useMemo(() => groupUpcoming(list), [list]);
  if (!ready) return null;
  return (
    <>
      <Header title="Lançamentos" sub="Datas do que você quer ver, está vendo ou pausou" />
      <LibNav current="/lancamentos" />
      {loading && <p className="muted mt12" role="status" style={{ fontSize: 14 }}>Procurando datas…</p>}
      {!loading && list.length === 0 && (
        <div className="card mt12" data-testid="sem-lancamentos">
          <p style={{ fontSize: 14 }}>
            {checked === 0
              ? "Nada para acompanhar ainda. Marque filmes, séries, jogos ou animes como “quero” ou “em andamento” e as datas de estreia e de novos episódios aparecem aqui."
              : "Nenhuma data futura para o que você acompanha. Quando uma estreia ou um novo episódio for anunciado, ele aparece aqui."}
          </p>
          <Link href="/descobrir" className="btn ghost small mt12" style={{ width: "auto" }}>Descobrir algo</Link>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} className="mt16" aria-label={g.label} data-testid={`grupo-${g.key}`}>
          <p className="label">{g.label}</p>
          <ul className="stack gap8" style={{ listStyle: "none", padding: 0 }}>
            {g.rows.map(({ item, release, days }) => (
              <li key={item.id} className="card row" style={{ gap: 12, alignItems: "center" }}>
                <Cover item={item} w={44} h={62} fs={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/item/${encodeURIComponent(item.id)}`} style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</Link>
                  <div className="muted" style={{ fontSize: 13 }}><MediaTag media={item.media} /> · {releaseLabel(release, item.media)}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 13 }}>
                  <b>{dueLabel(days)}</b>
                  <div className="muted">{fmtDate(release.date)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted mt16" style={{ fontSize: 12 }}>Datas vêm do TMDB, IGDB e AniList e podem mudar. Atualizadas a cada 12 horas.</p>
    </>
  );
}
