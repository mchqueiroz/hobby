"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recommend, topVibes } from "@/lib/recommend";
import { buildPool } from "@/lib/search";
import { cacheItem, dismiss, saveEntry, track, undismiss, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, wantLabel, type Item, type Media } from "@/lib/types";
import { Chips, Cover, Header, MediaTag } from "@/components/ui";
import { useShell } from "@/components/Shell";
import { Tonight } from "@/components/Tonight";

const PAGE_SIZE = 5;
/** igual ao limite da rota /api/discover */
const MAX_PAGE = 4;

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
  const [count, setCount] = useState(PAGE_SIZE);
  // página de candidatos já pedida; volta para a 1 quando o gosto muda (outras vibes no topo)
  const [asked, setAsked] = useState({ key: "", page: 1 });
  const hasData = Object.keys(lib.entries).length > 0;
  const vibesKey = topVibes(lib, 5).join(",");
  const page = asked.key === vibesKey ? asked.page : 1;
  const pool = useMemo(() => buildPool(remote), [remote]);
  const recs = useMemo(
    () => recommend(lib, { pool, media: media === "tudo" ? undefined : media, count, bet: true }),
    [lib, media, pool, count],
  );

  // candidatos reais dos catálogos, escolhidos pelas vibes que mais pesam no gosto
  useEffect(() => {
    if (!ready || !vibesKey) return;
    const ctrl = new AbortController();
    fetch(`/api/discover?vibes=${encodeURIComponent(vibesKey)}&page=${page}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b: { items?: Item[] }) => {
        const got = Array.isArray(b.items) ? b.items : [];
        setRemote((prev) => (page === 1 ? got : [...prev, ...got]));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [ready, vibesKey, page]);

  function more() {
    setCount((c) => c + PAGE_SIZE);
    // as sugestões atuais não enchem a próxima leva: busca mais candidatos nas fontes
    if (recs.length < count + PAGE_SIZE && page < MAX_PAGE) setAsked({ key: vibesKey, page: page + 1 });
  }

  useEffect(() => {
    if (ready && recs.length) track("rec_view", { n: recs.length, media });
    // só quando o filtro muda ou a tela abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, media]);

  if (!ready) return null;

  return (
    <>
      <Header title="Para você hoje" />
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
                  {r.bet && <span className="tag dark" data-testid="aposta">Aposta</span>}
                </div>
                <p style={{ fontSize: 13, marginTop: 8 }}>{r.reason}</p>
                {r.bet && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Foge um pouco do que você costuma ver, mas tem a ver com o que você gostou.</p>}
              </div>
            </div>
            <div className="row gap8 mt12">
              <button type="button" className="btn small" onClick={() => {
                saveEntry(r.item, "quero");
                track("rec_accept", { cross: r.anchor ? r.anchor.item.media !== r.item.media : false, bet: !!r.bet });
                toast(`${r.item.title}: ${wantLabel(r.item.media)}`, () => { undoLast(); });
              }}>{wantLabel(r.item.media)}</button>
              <button type="button" className="btn ghost small" onClick={() => {
                dismiss(r.item.id, r.item);
                track("rec_dismiss");
                toast(`Sugestões ajustadas: menos como ${r.item.title}`, () => undismiss(r.item.id));
              }}>Não é pra mim</button>
            </div>
          </li>
        ))}
      </ul>

      {hasData && (recs.length >= count || page < MAX_PAGE) && (
        <button type="button" className="btn ghost mt16" data-testid="mais-sugestoes" onClick={more}>Mostrar mais</button>
      )}

      {hasData && <Tonight pool={pool} />}
    </>
  );
}
