"use client";

import { RichText } from "./RichText";
import Link from "next/link";
import { initials } from "@/lib/profile";
import { affinity, type Affinity, type ActivityRow } from "@/lib/social";
import { setLike, type LikeInfo, type PublicProfile, type ThreadRef } from "@/lib/community";
import { useState } from "react";
import { MEDIAS, MEDIA_LABEL, MEDIA_SHORT, statusLabel, wantVerb, type Library, type Media } from "@/lib/types";
import { Rating } from "./ui";
import { Thread } from "./Thread";

type Mini = Pick<PublicProfile, "name" | "avatar_thumb" | "color">;

export function PersonAvatar({ p, size = 44, photo }: { p: Mini; size?: number; photo?: string | null }) {
  const src = photo ?? p.avatar_thumb;
  return (
    <span className="pavatar" aria-hidden="true" data-photo={src ? "sim" : "nao"}
      style={{ width: size, height: size, fontSize: size * 0.4, ...(src ? { backgroundImage: `url(${src})` } : { background: `var(--${p.color ?? "anime"})` }) }}>
      {!src && initials(p.name)}
    </span>
  );
}

export function statsLine(p: PublicProfile): string {
  const parts = MEDIAS.filter((m) => p.stats.perMedia[m] > 0).sort((a, b) => p.stats.perMedia[b] - p.stats.perMedia[a]).slice(0, 3).map((m) => `${p.stats.perMedia[m]} ${MEDIA_SHORT[m as Media]}`);
  return parts.length ? parts.join(" · ") : "Ainda sem registros";
}

export function AffinityBadge({ a }: { a: Affinity }) {
  if (a.score === null) return <span className="muted" style={{ fontSize: 13 }}>Sem base para comparar ainda</span>;
  const basis = a.basis === "notas" ? `${a.shared} obras avaliadas pelos dois` : a.basis === "vibes" ? "pelas vibes mais fortes" : `${a.shared} obras em comum + vibes`;
  return (
    <span data-testid="afinidade" style={{ fontSize: 14 }}>
      <strong>{a.score}% de afinidade</strong> <span className="muted">({basis})</span>
    </span>
  );
}

export function PersonRow({ p, lib, action }: { p: PublicProfile; lib: Library; action?: React.ReactNode }) {
  const a = affinity(lib, [], p.stats.topVibes);
  return (
    <li className="card row gap12 person" style={{ alignItems: "center" }}>
      <PersonAvatar p={p} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/u/${p.handle}`} style={{ fontWeight: 700 }}>{p.name}</Link>
        <div className="muted" style={{ fontSize: 13 }}>@{p.handle} · {statsLine(p)}</div>
        {p.stats.persona && <div style={{ fontSize: 13 }}>{p.stats.persona}</div>}
        {a.score !== null && a.basis === "vibes" && <div className="muted" style={{ fontSize: 13 }}>{a.score}% de afinidade nas vibes</div>}
      </div>
      {action}
    </li>
  );
}

/** Curtir uma atividade. Mostra a resposta na hora e desfaz se o banco recusar. */
export function LikeButton({ me, thread, info }: { me: string; thread: ThreadRef; info?: LikeInfo }) {
  const [s, setS] = useState<LikeInfo>(info ?? { count: 0, liked: false });
  const [err, setErr] = useState("");
  const own = thread.user === me;
  async function toggle() {
    const next = { count: Math.max(0, s.count + (s.liked ? -1 : 1)), liked: !s.liked };
    const prev = s;
    setS(next); setErr("");
    const r = await setLike(me, thread, next.liked);
    if (!r.ok) { setS(prev); setErr(r.error); }
  }
  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <button type="button" className="chip" data-testid="curtir" aria-pressed={s.liked} disabled={own} onClick={() => void toggle()}
        aria-label={own ? `${s.count} curtidas no seu registro` : s.liked ? "Descurtir" : "Curtir"}>
        {s.liked ? "Curtido" : "Curtir"}<span className="n" data-testid="curtidas">{s.count}</span>
      </button>
      {err && <span role="status" data-testid="curtir-erro" style={{ fontSize: 12, color: "var(--danger)" }}>{err}</span>}
    </span>
  );
}

export function ActivityLine({ r, who, when, thread, count, onThreadChange, hideTitle, like }: {
  r: ActivityRow; who?: React.ReactNode; when?: string;
  /** quando informado, mostra a conversa desse registro */
  thread?: ThreadRef; count?: number; onThreadChange?: () => void; hideTitle?: boolean;
  /** curtidas deste registro; sem isso o botão não aparece */
  like?: { me: string; info?: LikeInfo };
}) {
  const verb = r.status === "concluido" ? "terminou" : r.status === "andamento" ? "está em" : r.status === "quero" ? `quer ${wantVerb(r.item.media)}` : r.status === "pausei" ? "pausou" : "abandonou";
  return (
    <li className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 14 }}>
        {who} {who ? verb : statusLabel(r.status, r.item.media)}{hideTitle ? "" : <> <strong>{r.item.title}</strong></>}
        {!hideTitle && <span className="muted"> · {MEDIA_LABEL[r.item.media]}{r.item.year ? ` · ${r.item.year}` : ""}</span>}
      </div>
      {r.rating !== null && <div className="mt8"><Rating value={r.rating} /></div>}
      {r.review && <RichText text={r.review} style={{ fontSize: 14, marginTop: 6 }} />}
      {when && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{new Date(when).toLocaleDateString("pt-BR")}</div>}
      {thread && (
        <div className="row gap8 mt8" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          {like && <LikeButton key={`${thread.user}|${thread.item}|${like.info?.count ?? "-"}|${like.info?.liked ?? "-"}`} me={like.me} thread={thread} info={like.info} />}
          <Thread thread={thread} count={count} onChange={onThreadChange} />
        </div>
      )}
    </li>
  );
}
