"use client";

import { useState } from "react";
import { dateFromInput, dateToInput } from "@/lib/stats";
import { MAX_REVIEW, redo, setNote, setTags, stepProgress, undoLast, useLibrary } from "@/lib/store";
import { useMySocial } from "@/lib/community";
import { MAX_TAGS, MAX_TAG_LEN, PROGRESS_LABEL, REDO_LABEL, cleanTags, entryProgress, type Entry, type Media } from "@/lib/types";
import { ProgressBar } from "./ui";
import { useShell } from "./Shell";

/** Resenha e data do item registrado. A data salva ao mudar; a resenha ao sair do campo ou no botão. */
export function NoteEditor({ itemId, entry, media }: { itemId: string; entry: Entry; media: Media }) {
  const mine = useMySocial();
  const lib = useLibrary();
  const [tagText, setTagText] = useState("");
  const tags = entry.tags ?? [];
  const suggestions = (() => { const c = new Map<string, number>(); for (const e of Object.values(lib.entries)) for (const t of e.tags ?? []) if (!tags.includes(t)) c.set(t, (c.get(t) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([t]) => t); })();
  const addTag = (t: string) => { const next = cleanTags([...tags, t]); if (next.length !== tags.length) setTags(itemId, next); setTagText(""); };
  const { toast } = useShell();
  const prog = entryProgress(entry);
  const step = (d: number) => {
    const r = stepProgress(itemId, d);
    if (r.completed) toast("Concluído! Parabéns.", undoLast);
  };
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
              onClick={() => step(-1)}>−</button>
            <input id="progresso" type="number" inputMode="decimal" min={0} className="field" style={{ maxWidth: 110, textAlign: "center" }}
              value={entry.progress ?? ""} placeholder="0"
              onChange={(e) => setNote(itemId, { progress: e.target.value === "" ? null : Number(e.target.value) })} />
            <button type="button" className="btn ghost small" style={{ width: 48 }} aria-label="Mais um"
              onClick={() => step(1)}>+</button>
            <span className="muted" style={{ fontSize: 14 }}>de</span>
            <input id="total" type="number" inputMode="numeric" min={1} className="field" style={{ maxWidth: 90, textAlign: "center" }}
              value={entry.total ?? ""} placeholder="total" aria-label={`Total (opcional): com ele a obra conclui sozinha ao chegar lá`}
              onChange={(e) => setNote(itemId, { total: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          {prog?.total ? <div className="mt8"><ProgressBar value={prog.value} total={prog.total} label={`Progresso: ${prog.value} de ${prog.total}`} /><p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{prog.pct}% · ao chegar em {prog.total} a obra é concluída com a data de hoje</p></div> : null}
        </div>
      )}
      {entry.status === "concluido" && (
        <div className="row between mb12" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 14 }} data-testid="vezes">{(entry.rounds ?? 1) > 1 ? `Você já fez ${entry.rounds} vezes` : "Primeira vez"}</span>
          <button type="button" className="btn ghost small" style={{ width: "auto" }} data-testid="rever"
            onClick={() => { const n = redo(itemId); if (n) toast(`${REDO_LABEL[media]}: agora são ${n} vezes`, undoLast); }}>{REDO_LABEL[media]} (+1)</button>
        </div>
      )}
      <label className="label" htmlFor="data-obra" style={{ margin: 0 }}>{media === "livro" || media === "manga" ? "Quando você leu" : media === "musica" ? "Quando você ouviu" : "Quando você viu ou jogou"}</label>
      <input
        id="data-obra" type="date" className="field mt8" value={dateToInput(entry.date)}
        max={today}
        onChange={(e) => setNote(itemId, { date: dateFromInput(e.target.value) })}
        style={{ maxWidth: 220 }}
      />
      <label className="label" htmlFor="etiqueta">Etiquetas</label>
      <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 8 }} data-testid="etiquetas">
        {tags.map((t) => (
          <button key={t} type="button" className="chip" aria-label={`Remover etiqueta ${t}`} onClick={() => setTags(itemId, tags.filter((x) => x !== t))}>{t} ×</button>
        ))}
      </div>
      {tags.length < MAX_TAGS && (
        <div className="row gap8">
          <input id="etiqueta" className="field" value={tagText} maxLength={MAX_TAG_LEN} placeholder="ex.: para ver com a Ana" style={{ flex: 1 }}
            onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagText); } }} />
          <button type="button" className="btn ghost small" style={{ width: "auto" }} disabled={!tagText.trim()} onClick={() => addTag(tagText)}>Adicionar</button>
        </div>
      )}
      {suggestions.length > 0 && tags.length < MAX_TAGS && (
        <div className="row gap8 mt8" style={{ flexWrap: "wrap" }} aria-label="Etiquetas que você já usa">
          {suggestions.map((t) => <button key={t} type="button" className="chip" onClick={() => addTag(t)}>+ {t}</button>)}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, margin: "4px 0 12px" }}>Só você vê. Use para organizar do seu jeito e filtre na Biblioteca.</p>

      <label className="label" htmlFor="resenha">Sua resenha</label>
      <textarea
        id="resenha" className="field" value={review} maxLength={MAX_REVIEW}
        placeholder="O que você achou? Esconda spoilers assim: ||o final||"
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
