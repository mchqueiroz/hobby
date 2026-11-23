"use client";

import { ArrowRight, CaretLeft, Check, Plus, PushPinSimple, Queue } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { getItem, recommend } from "@/lib/recommend";
import { similarTo } from "@/lib/similar";
import { cacheItem, dismiss, MAX_PINS, MAX_QUEUE, removeEntry, saveEntry, setFormat, toggleInList, togglePin, toggleQueue, track, undismiss, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { FORMAT_LABEL, FORMATS, MEDIA_LABEL, statusLabel, wantLabel } from "@/lib/types";
import { Cover, MediaTag, Rating } from "@/components/ui";
import { useShell } from "@/components/Shell";
import { ObraTheme } from "@/components/ObraTheme";
import { NoteEditor } from "@/components/NoteEditor";
import { ObraDetails } from "@/components/ObraDetails";
import { CommunityReviews } from "@/components/CommunityReviews";

export default function ItemPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const lib = useLibrary();
  const ready = useHydrated();
  const { openRegister, toast } = useShell();
  const item = getItem(lib, id);
  const entry = lib.entries[id];
  const rec = useMemo(
    () => (item && !entry ? recommend(lib, { pool: [item], count: 1, perMedia: 1 })[0] : undefined),
    [item, entry, lib],
  );

  const similar = useMemo(() => (item ? similarTo(lib, item) : []), [item, lib]);

  if (!ready) return null;
  if (!item) {
    return (
      <div className="empty">
        <h2>Item não encontrado</h2>
        <p>Esse título não está no catálogo.</p>
        <Link href="/biblioteca" className="btn mt16">Voltar à biblioteca</Link>
      </div>
    );
  }
  const dismissed = lib.dismissed.includes(id);

  return (
    <ObraTheme item={item}>
      <div className="row"><Link href="/biblioteca" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><CaretLeft size={16} weight="bold" aria-hidden="true" />Voltar</Link></div>

      <div className="row mt16" style={{ alignItems: "flex-end", gap: 16 }}>
        <Cover item={item} w={130} h={184} fs={16} />
        <div>
          <MediaTag media={item.media} />
          <h1 style={{ fontSize: 28, marginTop: 10 }}>{item.title}</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {[item.author, item.year, item.brazil ? "produção brasileira" : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {entry && (
        <div className="card mt24">
          <p className="label" style={{ margin: 0 }}>Seu registro</p>
          <div className="row between mt8">
            <strong>{statusLabel(entry.status, item.media)}</strong>
            <Rating value={entry.rating} size={16} />
          </div>
          <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
            <button type="button" className="chip" aria-pressed={!!entry.pin} data-testid="vitrine"
              onClick={() => toast(togglePin(id) ? (entry.pin ? "Tirado da vitrine" : "Fixado na vitrine do perfil") : `A vitrine já tem ${MAX_PINS} obras. Tire uma no Perfil.`)}>
              {entry.pin ? <><PushPinSimple size={16} weight="fill" aria-hidden="true" />Na vitrine</> : <><PushPinSimple size={16} aria-hidden="true" />Fixar na vitrine</>}
            </button>
            {entry.status === "quero" && (
              <button type="button" className="chip" aria-pressed={!!entry.queue} data-testid="fila"
                onClick={() => toast(toggleQueue(id) ? (entry.queue ? "Tirado da fila" : "Na fila: aparece em Início, em A seguir") : `A fila já tem ${MAX_QUEUE} obras.`)}>
                {entry.queue ? <><Check size={16} weight="bold" aria-hidden="true" />Na fila</> : <><Queue size={16} aria-hidden="true" />A seguir</>}
              </button>
            )}
          </div>
          <label className="label mt12" htmlFor="formato" style={{ display: "block" }}>{FORMAT_LABEL[item.media]}</label>
          <select id="formato" className="field" value={entry.format ?? ""} onChange={(e) => setFormat(id, e.target.value || null)}>
            <option value="">Não informado</option>
            {FORMATS[item.media].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      <ObraDetails key={item.id} item={item} />
      <CommunityReviews key={`c-${item.id}`} itemId={item.id} />

      {entry && <NoteEditor key={id} itemId={id} entry={entry} media={item.media} />}

      {rec && (
        <>
          <p className="label">Por que sugerimos</p>
          <div className="card">
            {rec.anchor && (
              <div className="row between" style={{ alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <Cover item={rec.anchor.item} w={64} h={90} fs={11} />
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>sua biblioteca</div>
                </div>
                <ArrowRight size={22} className="muted" aria-hidden="true" />
                <div style={{ textAlign: "center" }}>
                  <Cover item={item} w={64} h={90} fs={11} />
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>sugestão</div>
                </div>
              </div>
            )}
            <p style={{ fontSize: 14, marginTop: 12 }}>{rec.reason}</p>
          </div>
        </>
      )}

      <p className="label">Vibes</p>
      <div className="chips">
        {item.vibes.map((v) => (
          <span key={v} className={rec?.shared.includes(v) ? "vibe on" : "vibe"}>{v}</span>
        ))}
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="parecidos-t" data-testid="parecidos">
          <p className="label" id="parecidos-t">Parecidos com esta</p>
          <ul className="hscroll" style={{ listStyle: "none", padding: 0, gap: 12 }}>
            {similar.map(({ item: s, shared }) => (
              <li key={s.id} style={{ width: 104, flex: "0 0 auto", position: "relative" }}>
                <Link href={`/item/${encodeURIComponent(s.id)}`} onClick={() => cacheItem(s)}>
                  <Cover item={s} w={104} h={146} fs={11} />
                  <strong style={{ display: "block", fontSize: 13, marginTop: 6 }}>{s.title}<span className="sr">, {MEDIA_LABEL[s.media]}</span></strong>
                </Link>
                <span className="muted" style={{ display: "block", fontSize: 11.5, marginTop: 2 }}>{shared.slice(0, 2).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="label">Listas</p>
      {Object.keys(lib.lists).length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>Você ainda não tem listas. <Link href="/listas" style={{ textDecoration: "underline" }}>Criar uma</Link></p>
      ) : (
        <div className="chips" role="group" aria-label="Adicionar a uma lista">
          {Object.values(lib.lists).map((l) => {
            const on = l.itemIds.includes(id);
            return (
              <button key={l.id} type="button" className="chip" aria-pressed={on}
                onClick={() => toast(toggleInList(l.id, item) ? `Adicionado a ${l.name}` : `Tirado de ${l.name}`)}>
                {on ? <Check size={14} weight="bold" aria-hidden="true" /> : <Plus size={14} weight="bold" aria-hidden="true" />}{l.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt24">
        <button type="button" className="btn" onClick={() => openRegister(item)}>{entry ? "Editar registro" : "Registrar"}</button>
        <div className="row gap8 mt12">
          {!entry && (
            <button type="button" className="btn ghost small" onClick={() => {
              saveEntry(item, "quero");
              track("item_want");
              toast(`${item.title}: ${wantLabel(item.media)}`, () => { undoLast(); });
            }}>{wantLabel(item.media)}</button>
          )}
          {!entry && !dismissed && (
            <button type="button" className="btn ghost small" onClick={() => {
              dismiss(id);
              track("rec_dismiss", { from: "item" });
              toast("Sugestões ajustadas", () => undismiss(id));
            }}>Não é pra mim</button>
          )}
          {!entry && dismissed && (
            <button type="button" className="btn ghost small" onClick={() => undismiss(id)}>Voltar a sugerir</button>
          )}
          {entry && (
            <button type="button" className="btn ghost small" onClick={() => {
              removeEntry(id);
              toast(`${item.title} saiu da biblioteca`);
            }}>Remover da biblioteca</button>
          )}
        </div>
      </div>
    </ObraTheme>
  );
}
