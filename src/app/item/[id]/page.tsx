"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { getItem, recommend } from "@/lib/recommend";
import { dismiss, removeEntry, saveEntry, toggleInList, track, undismiss, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { STATUS_LABEL } from "@/lib/types";
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
      <div className="row between"><Link href="/biblioteca" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center" }}>‹ Voltar</Link><span className="word" style={{ fontSize: 18 }}>hobby</span></div>

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
            <strong>{STATUS_LABEL[entry.status]}</strong>
            <Rating value={entry.rating} size={16} />
          </div>
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
                <span aria-hidden="true" style={{ fontSize: 26 }} className="muted">→</span>
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
                {on ? "✓ " : "+ "}{l.name}
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
              toast(`${item.title}: Quero ver`, () => { undoLast(); });
            }}>Quero ver</button>
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
