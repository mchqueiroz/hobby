"use client";

import Link from "next/link";
import { initials } from "@/lib/profile";
import { affinity, type Affinity, type ActivityRow } from "@/lib/social";
import type { PublicProfile, ThreadRef } from "@/lib/community";
import { MEDIAS, MEDIA_LABEL, MEDIA_SHORT, STATUS_LABEL, type Library, type Media } from "@/lib/types";
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

export function ActivityLine({ r, who, when, thread, count, onThreadChange, hideTitle }: {
  r: ActivityRow; who?: React.ReactNode; when?: string;
  /** quando informado, mostra a conversa desse registro */
  thread?: ThreadRef; count?: number; onThreadChange?: () => void; hideTitle?: boolean;
}) {
  const verb = r.status === "concluido" ? "terminou" : r.status === "andamento" ? "está em" : r.status === "quero" ? "quer ver" : "abandonou";
  return (
    <li className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 14 }}>
        {who} {who ? verb : STATUS_LABEL[r.status]}{hideTitle ? "" : <> <strong>{r.item.title}</strong></>}
        {!hideTitle && <span className="muted"> · {MEDIA_LABEL[r.item.media]}{r.item.year ? ` · ${r.item.year}` : ""}</span>}
      </div>
      {r.rating !== null && <div className="mt8"><Rating value={r.rating} /></div>}
      {r.review && <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.review}</p>}
      {when && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{new Date(when).toLocaleDateString("pt-BR")}</div>}
      {thread && <Thread thread={thread} count={count} onChange={onThreadChange} />}
    </li>
  );
}
