"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { addComment, loadComments, removeComment, useMySocial, type CommentView, type ThreadRef } from "@/lib/community";
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
    const r = await addComment(me, thread, text);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setText("");
    setErr(null);
    await load();
    onChange?.();
  }

  const shown = list?.length ?? count;
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
            {list?.map((c) => (
              <li key={c.id} className="comment" data-testid="comentario">
                <div className="row gap8" style={{ alignItems: "center" }}>
                  {c.author ? (
                    <Link href={`/u/${c.author.handle}`} className="row gap8" style={{ alignItems: "center", fontWeight: 700, fontSize: 13 }}>
                      <PersonAvatar p={c.author} size={22} />{c.author.name}
                    </Link>
                  ) : <span className="muted" style={{ fontSize: 13 }}>Perfil não público</span>}
                  <span className="muted" style={{ fontSize: 12 }}>{when(c.created_at)}</span>
                  {me && (c.author_id === me || thread.user === me) && (
                    <button type="button" className="chip" style={{ marginLeft: "auto", minHeight: 32, padding: "4px 10px" }} aria-label={`Apagar comentário de ${c.author?.name ?? "alguém"}`}
                      onClick={async () => { await removeComment(c.id).catch(() => setErr("Não consegui apagar.")); await load(); onChange?.(); }}>Apagar</button>
                  )}
                </div>
                <p style={{ fontSize: 14, marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</p>
              </li>
            ))}
          </ul>
          {!cloud.userId ? (
            <p style={{ fontSize: 13 }}><Link href="/perfil">Entre na sua conta</Link> para comentar.</p>
          ) : !mine?.is_public ? (
            <p style={{ fontSize: 13 }}>Para comentar, <Link href="/comunidade">publique seu perfil</Link> (assim as pessoas veem quem você é).</p>
          ) : (
            <form onSubmit={send} className="mt8">
              <label className="label" htmlFor={`c-${thread.user}-${thread.item}`}>Seu comentário ({text.trim().length}/{COMMENT_MAX})</label>
              <textarea id={`c-${thread.user}-${thread.item}`} className="field" rows={2} maxLength={COMMENT_MAX + 50} value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit" className="btn small mt8" style={{ width: "auto" }} disabled={busy || !text.trim() || text.trim().length > COMMENT_MAX}>{busy ? "Enviando…" : "Comentar"}</button>
            </form>
          )}
          {err && <p role="status" data-testid="thread-erro" style={{ fontSize: 13, color: "var(--danger)", marginTop: 6 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
