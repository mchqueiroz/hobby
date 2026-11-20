"use client";

import { useState } from "react";
import { dateFromInput, dateToInput } from "@/lib/stats";
import { MAX_REVIEW, setNote } from "@/lib/store";
import { useMySocial } from "@/lib/community";
import { PROGRESS_LABEL, type Entry, type Media } from "@/lib/types";

/** Resenha e data do item registrado. A data salva ao mudar; a resenha ao sair do campo ou no botão. */
export function NoteEditor({ itemId, entry, media }: { itemId: string; entry: Entry; media: Media }) {
  const mine = useMySocial();
  const [review, setReview] = useState(entry.review ?? "");
  const [saved, setSaved] = useState(false);
  const [today] = useState(() => dateToInput(Date.now()));
  const dirty = review.trim() !== (entry.review ?? "");

  function saveReview() {
    if (!dirty) return;
    setNote(itemId, { review });
    setSaved(true);
  }

  return (
    <div className="card mt12">
      {entry.status === "andamento" && (
        <div className="mb12">
          <label className="label" htmlFor="progresso" style={{ margin: 0 }}>{PROGRESS_LABEL[media]}</label>
          <div className="row gap8 mt8">
            <button type="button" className="btn ghost small" style={{ width: 48 }} aria-label="Menos um"
              onClick={() => setNote(itemId, { progress: Math.max(0, (entry.progress ?? 0) - 1) })}>−</button>
            <input id="progresso" type="number" inputMode="decimal" min={0} className="field" style={{ maxWidth: 110, textAlign: "center" }}
              value={entry.progress ?? ""} placeholder="0"
              onChange={(e) => setNote(itemId, { progress: e.target.value === "" ? null : Number(e.target.value) })} />
            <button type="button" className="btn ghost small" style={{ width: 48 }} aria-label="Mais um"
              onClick={() => setNote(itemId, { progress: (entry.progress ?? 0) + 1 })}>+</button>
          </div>
        </div>
      )}
      <label className="label" htmlFor="data-obra" style={{ margin: 0 }}>{media === "livro" || media === "manga" ? "Quando você leu" : media === "musica" ? "Quando você ouviu" : "Quando você viu ou jogou"}</label>
      <input
        id="data-obra" type="date" className="field mt8" value={dateToInput(entry.date)}
        max={today}
        onChange={(e) => setNote(itemId, { date: dateFromInput(e.target.value) })}
        style={{ maxWidth: 220 }}
      />
      <label className="label" htmlFor="resenha">Sua resenha</label>
      <textarea
        id="resenha" className="field" value={review} maxLength={MAX_REVIEW}
        placeholder="O que você achou?"
        onChange={(e) => { setReview(e.target.value); setSaved(false); }}
        onBlur={saveReview}
      />
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }} data-testid="visibilidade-resenha">
        {mine?.is_public && mine.share_reviews ? "Pública: aparece no seu perfil, no feed de quem te segue e na página da obra, onde as pessoas podem comentar." : "Só você vê. Para abrir a conversa com outras pessoas, publique seu perfil e libere resenhas em Comunidade."}
      </p>
      <div className="row between mt8">
        <span className="muted" style={{ fontSize: 12 }} role="status">
          {saved && !dirty ? "Resenha salva" : `${review.length}/${MAX_REVIEW}`}
        </span>
        <button type="button" className="btn ghost small" style={{ width: "auto" }} disabled={!dirty} onClick={saveReview}>Salvar resenha</button>
      </div>
    </div>
  );
}
