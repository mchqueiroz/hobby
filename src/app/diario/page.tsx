"use client";

import Link from "next/link";
import { useMemo } from "react";
import { diaryGroups } from "@/lib/stats";
import { useHydrated, useLibrary } from "@/lib/store";
import { statusLabel } from "@/lib/types";
import { Cover, Header, MediaTag, Rating } from "@/components/ui";
import { LibNav } from "@/components/LibNav";

const day = (ms: number) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(ms));

export default function Diario() {
  const lib = useLibrary();
  const ready = useHydrated();
  const groups = useMemo(() => diaryGroups(lib), [lib]);
  if (!ready) return null;

  return (
    <>
      <Header title="Diário" sub="O que você viu e jogou, mês a mês" />
      <LibNav current="/diario" />

      {groups.length === 0 && (
        <div className="empty">
          <h2>O diário ainda está vazio</h2>
          <p>Itens que você registra aparecem aqui com a data. O histórico importado não tem data, mas você pode escolher uma na página de cada item.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`m-${g.key}`}>
          <p className="label" id={`m-${g.key}`} style={{ textTransform: "capitalize" }}>{g.label}</p>
          <ul style={{ listStyle: "none" }}>
            {g.rows.map(({ e, item, d }) => (
              <li key={item.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                <Link href={`/item/${encodeURIComponent(item.id)}`} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <span className="muted" style={{ width: 44, fontSize: 12, paddingTop: 2 }}>{day(d)}</span>
                  <Cover item={item} w={44} h={60} fs={10} />
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 15, display: "block" }}>{item.title}</strong>
                    <span className="row gap8" style={{ marginTop: 4, flexWrap: "wrap" }}>
                      <MediaTag media={item.media} />
                      <span className="muted" style={{ fontSize: 12 }}>{statusLabel(e.status, item.media)}</span>
                      <Rating value={e.rating} size={12} />
                    </span>
                    {e.review && (
                      <span className="muted" style={{ fontSize: 13, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 6 }}>
                        {e.review}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
