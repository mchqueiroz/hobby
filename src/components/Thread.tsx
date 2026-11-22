"use client";

import { RichText } from "./RichText";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { addComment, blockUser, editComment, loadComments, REPORT_LABEL, removeComment, reportComment, useMySocial, type ReportReason, type CommentView, type ThreadRef } from "@/lib/community";
import { COMMENT_MAX } from "@/lib/social";
import { PersonAvatar } from "./Social";

const when = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return new Date(t).toLocaleDateString("pt-BR");
};

/** Conversa em volta de um registro ou resenha. Abre sob demanda (nada é baixado antes do toque). */
export function Thread({ thread, count = 0, onChange }: { thread: ThreadRef; count?: number; onChange?: () => void }) {
  const cloud = useCloud();
  const mine = useMySocial();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CommentView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const me = cloud.userId;
  const [menu, setMenu] = useState<string | null>(null); // comentário cujo menu de denúncia está aberto
  const [note, setNote] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [tick, setTick] = useState(0);
  const load = useCallback(async () => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadComments(thread)
      .then((l) => { if (live) { setList(l); setErr(null); } })
      .catch(() => { if (live) setErr("Não consegui carregar os comentários."); });
    return () => { live = false; };
  }, [open, thread, tick]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    const r = await addComment(me, thread, text, replyTo?.id);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setText("");
    setReplyTo(null);
    setErr(null);
    await load();
    onChange?.();
  }

  async function saveEdit(id: string) {
    const r = await editComment(id, editText);
    if (!r.ok) return setErr(r.error);
    setEditId(null);
    setErr(null);
    await load();
  }

  async function report(id: string, reason: ReportReason) {
    if (!me) return;
    const r = await reportComment(me, id, reason);
    setMenu(null);
    setNote(r.ok ? (r.already ? "Você já tinha denunciado este comentário." : "Denúncia enviada. Obrigado por avisar.") : r.error);
  }
  async function block(authorId: string, name: string) {
    const r = await blockUser(authorId);
    setMenu(null);
    if (!r.ok) return setNote(r.error);
    setNote(`${name} foi bloqueado. Você pode desbloquear em Comunidade.`);
    await load();
    onChange?.();
  }

  function renderComment(c: CommentView, reply = false) {
    return (
      <>
        <div className="row gap8" style={{ alignItems: "center" }}>
          {c.author ? (
            <Link href={`/u/${c.author.handle}`} className="row gap8" style={{ alignItems: "center", fontWeight: 700, fontSize: 13 }}>
              <PersonAvatar p={c.author} size={22} />{c.author.name}
            </Link>
          ) : <span className="muted" style={{ fontSize: 13 }}>Perfil não público</span>}
          <span className="muted" style={{ fontSize: 12 }}>{when(c.created_at)}{c.edited_at ? " · editado" : ""}</span>
          {me && c.author_id === me && editId !== c.id && (
            <button type="button" className="chip" style={{ marginLeft: "auto", minHeight: 32, padding: "4px 10px" }} data-testid="editar-comentario" aria-label="Editar seu comentário"
              onClick={() => { setEditId(c.id); setEditText(c.body); }}>Editar</button>
          )}
          {me && (c.author_id === me || thread.user === me) && (
            <button type="button" className="chip" style={{ marginLeft: c.author_id === me && editId !== c.id ? 0 : "auto", minHeight: 32, padding: "4px 10px" }} aria-label={`Apagar comentário de ${c.author?.name ?? "alguém"}`}
              onClick={async () => { await removeComment(c.id).catch(() => setErr("Não consegui apagar.")); await load(); onChange?.(); }}>Apagar</button>
          )}
          {me && c.author_id !== me && (
            <button type="button" className="chip" style={{ marginLeft: thread.user === me ? 0 : "auto", minHeight: 32, padding: "4px 10px" }} aria-expanded={menu === c.id}
              aria-label={`Denunciar ou bloquear ${c.author?.name ?? "autor"}`} data-testid="mais-opcoes" onClick={() => setMenu(menu === c.id ? null : c.id)}>Denunciar</button>
          )}
        </div>
        {menu === c.id && (
          <div className="chips mt8" role="group" aria-label="Motivo da denúncia" data-testid="menu-denuncia">
            {(Object.keys(REPORT_LABEL) as ReportReason[]).map((r) => (
              <button key={r} type="button" className="chip" onClick={() => void report(c.id, r)}>{REPORT_LABEL[r]}</button>
            ))}
            <button type="button" className="chip" data-testid="bloquear-autor" onClick={() => void block(c.author_id, c.author?.name ?? "A pessoa")}>Bloquear {c.author?.name ?? "autor"}</button>
          </div>
        )}
        {editId === c.id ? (
          <div className="mt8">
            <label className="label" htmlFor={`e-${c.id}`}>Editar comentário ({editText.trim().length}/{COMMENT_MAX})</label>
            <textarea id={`e-${c.id}`} className="field" rows={2} maxLength={COMMENT_MAX + 50} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div className="row gap8 mt8">
              <button type="button" className="btn small" style={{ width: "auto" }} data-testid="salvar-edicao" disabled={!editText.trim() || editText.trim().length > COMMENT_MAX} onClick={() => void saveEdit(c.id)}>Salvar</button>
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setEditId(null)}>Cancelar</button>
            </div>
          </div>
        ) : c.body && <RichText text={c.body} style={{ fontSize: 14, marginTop: 4 }} />}
        {!reply && me && mine?.is_public && editId !== c.id && (
          <button type="button" className="chip mt8" style={{ minHeight: 32, padding: "4px 10px" }} data-testid="responder" aria-label={`Responder a ${c.author?.name ?? "comentário"}`}
            onClick={() => setReplyTo(c)}>Responder</button>
        )}
      </>
    );
  }

  const shown = list?.length ?? count;
  const tops = (list ?? []).filter((c) => !c.parent_id || !(list ?? []).some((p) => p.id === c.parent_id));
  const repliesOf = (id: string) => (list ?? []).filter((c) => c.parent_id === id);
  return (
    <div className="thread">
      <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="abrir-comentarios">
        {open ? "Esconder conversa" : "Comentários"}<span className="n" aria-hidden="true">{shown}</span>
      </button>
      {open && (
        <div className="thread-body" data-testid="conversa">
          {list === null && !err && <p className="muted" style={{ fontSize: 13 }}>Carregando…</p>}
          {list?.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Ninguém comentou ainda. Comece a conversa.</p>}
          <ul className="stack gap8">
            {tops.map((c) => (
              <li key={c.id} className="comment" data-testid="comentario">
                {renderComment(c)}
                {repliesOf(c.id).length > 0 && (
                  <ul className="stack gap8 mt8" style={{ marginLeft: 16, paddingLeft: 12, borderLeft: "2px solid var(--line)", listStyle: "none" }}>
                    {repliesOf(c.id).map((r) => (
                      <li key={r.id} className="comment" data-testid="resposta">{renderComment(r, true)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {!cloud.userId ? (
            <p style={{ fontSize: 13 }}><Link href="/perfil">Entre na sua conta</Link> para comentar.</p>
          ) : !mine?.is_public ? (
            <p style={{ fontSize: 13 }}>Para comentar, <Link href="/comunidade">publique seu perfil</Link> (assim as pessoas veem quem você é).</p>
          ) : (
            <form onSubmit={send} className="mt8">
              {replyTo && (
                <p className="muted" style={{ fontSize: 13 }} data-testid="respondendo">
                  Respondendo a <b>{replyTo.author?.name ?? "comentário"}</b>{" "}
                  <button type="button" className="chip" style={{ minHeight: 28, padding: "2px 8px" }} onClick={() => setReplyTo(null)}>Cancelar</button>
                </p>
              )}
              <label className="label" htmlFor={`c-${thread.user}-${thread.item}`}>{replyTo ? "Sua resposta" : "Seu comentário"} ({text.trim().length}/{COMMENT_MAX})</label>
              <textarea id={`c-${thread.user}-${thread.item}`} className="field" rows={2} maxLength={COMMENT_MAX + 50} value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit" className="btn small mt8" style={{ width: "auto" }} disabled={busy || !text.trim() || text.trim().length > COMMENT_MAX}>{busy ? "Enviando…" : replyTo ? "Responder" : "Comentar"}</button>
            </form>
          )}
          {note && <p role="status" data-testid="thread-aviso" style={{ fontSize: 13, marginTop: 6 }}>{note}</p>}
          {err && <p role="status" data-testid="thread-erro" style={{ fontSize: 13, color: "var(--danger)", marginTop: 6 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
