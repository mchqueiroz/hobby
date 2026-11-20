"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityLine, AffinityBadge, PersonAvatar, statsLine } from "@/components/Social";
import { Header } from "@/components/ui";
import { cloudAvailable, useCloud } from "@/lib/cloud";
import { commentCounts, follow, followingIds, loadPublic, unfollow } from "@/lib/community";
import { bannerStyle } from "@/components/ProfileImageEditor";
import { bannerGradient, vibePalette } from "@/lib/palette";
import { parseProfile } from "@/lib/profile";
import { affinity, threadKey, type ActivityRow } from "@/lib/social";
import { useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, type Media } from "@/lib/types";
import type { PublicProfile } from "@/lib/community";

type Loaded = { profile: PublicProfile; activity: ActivityRow[]; at: string[] } | null | "erro";

export default function PerfilPublico() {
  const { handle } = useParams<{ handle: string }>();
  const ready = useHydrated();
  const lib = useLibrary();
  const cloud = useCloud();
  const [data, setData] = useState<Loaded | undefined>(undefined);
  const [follows, setFollows] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!cloudAvailable()) return;
    let live = true;
    loadPublic(handle).then((d) => live && setData(d)).catch(() => live && setData("erro"));
    return () => { live = false; };
  }, [handle]);

  const me = cloud.userId;
  const target = data && data !== "erro" ? data.profile.id : null;
  useEffect(() => {
    if (!target || !data || data === "erro") return;
    let live = true;
    commentCounts(data.activity.slice(0, 40).map((a) => ({ user: target, item: a.item_id }))).then((c) => live && setCounts(c)).catch(() => {});
    return () => { live = false; };
  }, [target, data, tick]);
  useEffect(() => {
    if (!me || !target) return;
    let live = true;
    followingIds(me).then((ids) => live && setFollows(ids.includes(target))).catch(() => live && setFollows(null));
    return () => { live = false; };
  }, [me, target]);

  const followsNow = me && target ? follows : null;
  if (!ready || !cloud.ready) return null;
  if (!cloudAvailable()) return <><Header title="Perfil" /><p className="card mt16">Perfis públicos não estão ativados nesta versão.</p></>;
  if (data === undefined) return <><Header title="Perfil" /><p className="muted mt16">Carregando…</p></>;
  if (data === "erro") return <><Header title="Perfil" /><p className="card mt16" role="status">Não consegui carregar. Verifique a conexão e tente de novo.</p></>;
  if (data === null) return (
    <>
      <Header title="Perfil não encontrado" />
      <p className="card mt16" data-testid="nao-encontrado">Não existe um perfil público com esse nome. Ele pode ter sido despublicado ou o nome estar errado.</p>
      <Link href="/comunidade" className="btn ghost mt12" style={{ width: "auto" }}>Voltar à comunidade</Link>
    </>
  );

  const { profile: p, activity, at } = data;
  const isMe = me === p.id;
  const aff = affinity(lib, activity, p.stats.topVibes);
  const main: Media = (MEDIAS.slice().sort((a, b) => p.stats.perMedia[b] - p.stats.perMedia[a])[0] ?? "anime") as Media;
  const bg = bannerStyle(parseProfile({ name: "", banner: p.banner }).banner, bannerGradient(vibePalette(p.stats.topVibes, p.color ?? main)));

  return (
    <>
      <div className="card hero" data-testid="perfil-publico">
        <div className="hero-banner" style={bg} aria-hidden="true" />
        <div className="hero-body">
          <div className="avatar-wrap"><PersonAvatar p={p} size={88} photo={p.avatar ?? p.avatar_thumb} /></div>
          <h1 style={{ marginTop: 8 }}>{p.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>@{p.handle}</div>
          {p.stats.persona && <div style={{ fontWeight: 600, marginTop: 4 }}>{p.stats.persona}</div>}
          {p.bio && <p style={{ marginTop: 8, fontSize: 14 }}>{p.bio}</p>}
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{p.stats.total} registros · {statsLine(p)}</div>
          {p.stats.topVibes.length > 0 && <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>{p.stats.topVibes.slice(0, 6).map((v) => <span key={v} className="tag dark">{v}</span>)}</div>}
          <div className="mt12">
            {isMe ? <Link href="/comunidade" className="btn ghost small" style={{ width: "auto" }}>Editar meu perfil público</Link>
              : me ? (
                <button type="button" className={`btn small ${followsNow ? "ghost" : ""}`} style={{ width: "auto" }} disabled={busy || followsNow === null}
                  onClick={async () => { setBusy(true); try { await (followsNow ? unfollow(me, p.id) : follow(me, p.id)); setFollows(!followsNow); } finally { setBusy(false); } }}>
                  {followsNow ? "Seguindo" : "Seguir"}
                </button>
              ) : <Link href="/perfil" className="btn ghost small" style={{ width: "auto" }}>Entre para seguir</Link>}
          </div>
        </div>
      </div>

      {!isMe && me && (
        <div className="card mt16"><AffinityBadge a={aff} />
          {aff.lovedBoth.length > 0 && <p style={{ fontSize: 13, marginTop: 6 }}>Vocês dois amaram: {aff.lovedBoth.join(", ")}.</p>}
          {aff.commonVibes.length > 0 && <p style={{ fontSize: 13, marginTop: 4 }}>Vibes em comum: {aff.commonVibes.join(", ")}.</p>}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Cálculo simples (notas nas mesmas obras + vibes), ainda não validado com pessoas reais.</p>
        </div>
      )}

      <p className="label">Registros recentes</p>
      {activity.length === 0 ? <p className="card" style={{ fontSize: 14 }}>Nada publicado ainda.</p> : (
        <ul className="stack gap8" data-testid="atividade">
          {activity.slice(0, 40).map((r, i) => <ActivityLine key={r.item_id} r={r} when={at[i]} thread={{ user: p.id, item: r.item_id }} count={counts.get(threadKey(p.id, r.item_id)) ?? 0} onThreadChange={() => setTick((t) => t + 1)} />)}
        </ul>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{MEDIAS.map((m) => `${MEDIA_PLURAL[m]}: ${p.stats.perMedia[m]}`).join(" · ")}</p>
    </>
  );
}
