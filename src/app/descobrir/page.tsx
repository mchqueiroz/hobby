"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recommend, topVibes } from "@/lib/recommend";
import { buildPool } from "@/lib/search";
import { cacheItem, dismiss, saveEntry, track, undismiss, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, type Item, type Media } from "@/lib/types";
import { Chips, Cover, Header, MediaTag } from "@/components/ui";
import { useShell } from "@/components/Shell";
import { Tonight } from "@/components/Tonight";

const FILTERS: { value: Media | "tudo"; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  ...MEDIAS.map((m) => ({ value: m, label: MEDIA_PLURAL[m][0].toUpperCase() + MEDIA_PLURAL[m].slice(1) })),
];

export default function Descobrir() {
  const lib = useLibrary();
  const ready = useHydrated();
  const { toast } = useShell();
  const [media, setMedia] = useState<Media | "tudo">("tudo");
  const [remote, setRemote] = useState<Item[]>([]);
  const pool = useMemo(() => buildPool(remote), [remote]);
  const recs = useMemo(
    () => recommend(lib, { pool, media: media === "tudo" ? undefined : media, count: 5 }),
    [lib, media, pool],
  );
  const hasData = Object.keys(lib.entries).length > 0;
  const vibesKey = topVibes(lib, 3).join(",");

  // candidatos reais dos catálogos, escolhidos pelas vibes que mais pesam no gosto
  useEffect(() => {
    if (!ready || !vibesKey) return;
    const ctrl = new AbortController();
    fetch(`/api/discover?vibes=${encodeURIComponent(vibesKey)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b: { items?: Item[] }) => setRemote(Array.isArray(b.items) ? b.items : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [ready, vibesKey]);

  useEffect(() => {
    if (ready && recs.length) track("rec_view", { n: recs.length, media });
    // só quando o filtro muda ou a tela abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, media]);

  if (!ready) return null;

  return (
    <>
      <Header title="Para você hoje" />
      {hasData && <Tonight pool={pool} />}
      <div className="mt16"><Chips label="Filtrar por mídia" options={FILTERS} value={media} onChange={setMedia} /></div>

      {!hasData && (
        <div className="empty">
          <h2>Ainda não conhecemos seu gosto</h2>
          <p>Importe seu histórico ou escolha alguns favoritos para começar.</p>
          <Link href="/importar" className="btn mt16">Começar</Link>
        </div>
      )}

      {hasData && recs.length === 0 && (
        <div className="empty">
          <h2>Sem sugestões por enquanto</h2>
          <p>Avalie mais itens e as sugestões voltam. Se você dispensou muita coisa, desfazer ajuda.</p>
        </div>
      )}

      <ul style={{ listStyle: "none" }} className="mt16 cols2">
        {recs.map((r) => (
          <li key={r.item.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
              <Cover item={r.item} w={66} h={92} fs={11} />
              <div style={{ flex: 1 }}>
                <Link href={`/item/${encodeURIComponent(r.item.id)}`} onClick={() => cacheItem(r.item)} style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>
                  {r.item.title}
                </Link>
                <div className="row gap8 mt8" style={{ flexWrap: "wrap" }}>
                  <MediaTag media={r.item.media} />
                  {r.item.brazil && <span className="tag dark">Brasil</span>}
                </div>
                <p style={{ fontSize: 13, marginTop: 8 }}>{r.reason}</p>
              </div>
            </div>
            <div className="row gap8 mt12">
              <button type="button" className="btn small" onClick={() => {
                saveEntry(r.item, "quero");
                track("rec_accept", { cross: r.anchor ? r.anchor.item.media !== r.item.media : false });
                toast(`${r.item.title}: Quero ver`, () => { undoLast(); });
              }}>Quero ver</button>
              <button type="button" className="btn ghost small" onClick={() => {
                dismiss(r.item.id, r.item);
                track("rec_dismiss");
                toast(`Sugestões ajustadas: menos como ${r.item.title}`, () => undismiss(r.item.id));
              }}>Não é pra mim</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
