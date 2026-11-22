"use client";

import Link from "next/link";
import { useState } from "react";
import { tonight, type Recommendation, type Source } from "@/lib/recommend";
import { MOODS, type Mood } from "@/lib/vibes";
import { cacheItem, saveEntry, track, undoLast, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_LABEL, wantLabel, type Item, type Media } from "@/lib/types";
import { Chips, Cover, MediaTag } from "./ui";
import { useShell } from "./Shell";

const MEDIA_OPTS: { value: Media | "tudo"; label: string }[] = [
  { value: "tudo", label: "Qualquer mídia" },
  ...MEDIAS.map((m) => ({ value: m, label: MEDIA_LABEL[m] })),
];
const MOOD_OPTS: { value: Mood | "qualquer"; label: string }[] = [
  { value: "qualquer", label: "Qualquer clima" },
  ...(Object.keys(MOODS) as Mood[]).map((m) => ({ value: m, label: MOODS[m].label })),
];
const SOURCE_OPTS: { value: Source; label: string }[] = [
  { value: "novos", label: "Algo novo" },
  { value: "quero", label: "Da minha lista" },
];

/** "O que ver hoje?": sorteia entre as melhores sugestões, respeitando mídia, clima e origem. */
export function Tonight({ pool }: { pool: Item[] }) {
  const lib = useLibrary();
  const { toast } = useShell();
  const [media, setMedia] = useState<Media | "tudo">("tudo");
  const [mood, setMood] = useState<Mood | "qualquer">("qualquer");
  const [source, setSource] = useState<Source>("novos");
  const [res, setRes] = useState<{ pick?: Recommendation; others: Recommendation[]; empty: boolean } | null>(null);

  function roll() {
    const r = tonight(lib, {
      pool,
      media: media === "tudo" ? undefined : media,
      moodVibes: mood === "qualquer" ? undefined : MOODS[mood].vibes,
      source,
    });
    track("tonight_roll", { media, mood, source, found: !!r.pick });
    setRes({ ...r, empty: !r.pick });
  }

  function accept(r: Recommendation) {
    const status = source === "quero" ? "andamento" : "quero";
    saveEntry(r.item, status);
    track("tonight_accept", { source, cross: r.anchor ? r.anchor.item.media !== r.item.media : false });
    toast(`${r.item.title}: ${status === "quero" ? wantLabel(r.item.media) : "Em andamento"}`, () => { undoLast(); });
  }

  return (
    <section className="card mt16" aria-labelledby="tonight-t">
      <h2 id="tonight-t" style={{ fontSize: 18 }}>O que ver hoje?</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Escolha o clima e deixe o Hobby sortear entre as melhores opções para você.</p>
      <div className="mt12"><Chips label="Origem" options={SOURCE_OPTS} value={source} onChange={setSource} /></div>
      <div className="mt8"><Chips label="Mídia" options={MEDIA_OPTS} value={media} onChange={setMedia} /></div>
      <div className="mt8"><Chips label="Clima" options={MOOD_OPTS} value={mood} onChange={setMood} /></div>
      <button type="button" className="btn mt12" onClick={roll}>{res?.pick ? "Sortear de novo" : "Sortear"}</button>

      {res?.empty && (
        <p className="muted mt12" style={{ fontSize: 14 }} role="status">
          {source === "quero"
            ? "Nada na sua lista de quero ver combina com esses filtros. Troque o clima ou adicione itens."
            : "Nenhuma sugestão com esses filtros. Tente outro clima ou mídia."}
        </p>
      )}

      {res?.pick && (
        <div className="mt12" role="status" aria-live="polite">
          <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
            <Cover item={res.pick.item} w={72} h={100} fs={11} />
            <div style={{ flex: 1 }}>
              <Link href={`/item/${encodeURIComponent(res.pick.item.id)}`} onClick={() => cacheItem(res.pick!.item)}
                style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>
                {res.pick.item.title}
              </Link>
              <div className="mt8"><MediaTag media={res.pick.item.media} /></div>
              <p style={{ fontSize: 13, marginTop: 8 }}>{res.pick.reason}</p>
            </div>
          </div>
          <button type="button" className="btn ghost small mt12" onClick={() => accept(res.pick!)}>
            {source === "quero" ? "Vou começar agora" : wantLabel(res.pick.item.media)}
          </button>
          {res.others.length > 0 && (
            <p className="muted mt12" style={{ fontSize: 13 }}>
              Também combinam:{" "}
              {res.others.map((o, i) => (
                <span key={o.item.id}>
                  {i > 0 && ", "}
                  <Link href={`/item/${encodeURIComponent(o.item.id)}`} onClick={() => cacheItem(o.item)} style={{ textDecoration: "underline" }}>{o.item.title}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
