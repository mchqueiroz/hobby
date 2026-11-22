"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityLine, AffinityBadge, PersonAvatar, statsLine } from "@/components/Social";
import { Cover, Header } from "@/components/ui";
import { buildPool } from "@/lib/search";
import { jointVibes, recommend, topVibes } from "@/lib/recommend";
import { cloudAvailable, useCloud } from "@/lib/cloud";
import { blockedIds, blockUser, commentCounts, follow, likeInfo, type LikeInfo, followingIds, loadPublic, unblockUser, unfollow } from "@/lib/community";
import { bannerStyle } from "@/components/ProfileImageEditor";
import { bannerGradient, vibePalette } from "@/lib/palette";
import { parseProfile } from "@/lib/profile";
import { affinity, threadKey, type ActivityRow } from "@/lib/social";
import { cacheItem, saveEntry, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { useShell } from "@/components/Shell";
import { wantLabel } from "@/lib/types";
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
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [askBlock, setAskBlock] = useState(false);
  const [followErr, setFollowErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [likes, setLikes] = useState<Map<string, LikeInfo>>(new Map());
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
    if (me) likeInfo(me, data.activity.slice(0, 40).map((a) => ({ user: target, item: a.item_id }))).then((l) => live && setLikes(l)).catch(() => {});
    return () => { live = false; };
  }, [target, data, tick, me]);
  useEffect(() => {
    if (!me || !target) return;
    let live = true;
    followingIds(me).then((ids) => live && setFollows(ids.includes(target))).catch(() => live && setFollows(null));
    return () => { live = false; };
  }, [me, target]);

  useEffect(() => {
    if (!me || !target) return;
    let live = true;
    blockedIds(me).then((ids) => live && setBlocked(ids.includes(target))).catch(() => live && setBlocked(null));
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
              : me && blocked ? (
                <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 14 }} data-testid="bloqueado">Você bloqueou esta pessoa.</span>
                  <button type="button" className="btn ghost small" style={{ width: "auto" }} disabled={busy}
                    onClick={async () => { setBusy(true); try { await unblockUser(me, p.id); setBlocked(false); } finally { setBusy(false); } }}>Desbloquear</button>
                </div>
              ) : me ? (
                <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className={`btn small ${followsNow ? "ghost" : ""}`} style={{ width: "auto" }} disabled={busy || followsNow === null}
                  onClick={async () => { setBusy(true); setFollowErr(null); try { await (followsNow ? unfollow(me, p.id) : follow(me, p.id)); setFollows(!followsNow); } catch { setFollowErr(followsNow ? "Não consegui deixar de seguir agora." : "Não foi possível seguir esta pessoa agora."); } finally { setBusy(false); } }}>
                  {followsNow ? "Seguindo" : "Seguir"}
                </button>
                {!askBlock ? (
                  <button type="button" className="chip" data-testid="bloquear" onClick={() => setAskBlock(true)}>Bloquear</button>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}>Bloquear {p.name}? Vocês deixam de se seguir e ela não comenta no seu perfil.</span>
                    <button type="button" className="btn danger small" style={{ width: "auto" }} disabled={busy} data-testid="confirmar-bloqueio"
                      onClick={async () => { setBusy(true); try { const r = await blockUser(p.id); if (r.ok) { setBlocked(true); setFollows(false); } } finally { setBusy(false); setAskBlock(false); } }}>Confirmar bloqueio</button>
                    <button type="button" className="chip" onClick={() => setAskBlock(false)}>Cancelar</button>
                  </>
                )}
                {followErr && <span role="status" data-testid="seguir-erro" style={{ fontSize: 13, color: "var(--danger)" }}>{followErr}</span>}
                </div>
              ) : <Link href="/perfil" className="btn ghost small" style={{ width: "auto" }}>Entre para seguir</Link>}
          </div>
        </div>
      </div>

      {!isMe && me && <Together lib={lib} theirs={p.stats.topVibes} name={p.name} />}

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
          {activity.slice(0, 40).map((r, i) => <ActivityLine key={r.item_id} r={r} when={at[i]} thread={{ user: p.id, item: r.item_id }} count={counts.get(threadKey(p.id, r.item_id)) ?? 0} onThreadChange={() => setTick((t) => t + 1)} like={me ? { me, info: likes.get(threadKey(p.id, r.item_id)) } : undefined} />)}
        </ul>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{MEDIAS.map((m) => `${MEDIA_PLURAL[m]}: ${p.stats.perMedia[m]}`).join(" · ")}</p>
    </>
  );
}

/** Sugestões para os dois, a partir das vibes de cada um (só vibes públicas: nada de títulos do outro). */
function Together({ lib, theirs, name }: { lib: ReturnType<typeof useLibrary>; theirs: string[]; name: string }) {
  const { toast } = useShell();
  const [open, setOpen] = useState(false);
  const { vibes, shared } = jointVibes(topVibes(lib, 8), theirs);
  const recs = open && vibes.length ? recommend(lib, { pool: buildPool([]), moodVibes: vibes, count: 4, perMedia: 2 }) : [];
  return (
    <section className="card mt16" data-testid="juntos">
      <div className="row between" style={{ alignItems: "center" }}>
        <strong style={{ fontSize: 15 }}>Ver algo juntos</strong>
        <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Fechar" : "Sugerir"}</button>
      </div>
      {open && (vibes.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Ainda faltam dados de gosto para sugerir. Avalie mais itens e peça de novo.</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>
            {shared.length ? `Vocês dois curtem ${shared.join(", ")}.` : `Vocês têm gostos diferentes, então misturei as vibes de cada um.`} Sugestões para você e {name}:
          </p>
          <ul className="stack gap8" style={{ listStyle: "none", padding: 0 }} data-testid="juntos-lista">
            {recs.map((r) => (
              <li key={r.item.id} className="row" style={{ gap: 10, alignItems: "center" }}>
                <Link href={`/item/${encodeURIComponent(r.item.id)}`} onClick={() => cacheItem(r.item)} aria-hidden="true" tabIndex={-1}><Cover item={r.item} w={40} h={56} fs={9} /></Link>
                <Link href={`/item/${encodeURIComponent(r.item.id)}`} onClick={() => cacheItem(r.item)} style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{r.item.title}</Link>
                <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`${wantLabel(r.item.media)}: ${r.item.title}`}
                  onClick={() => { saveEntry(r.item, "quero"); toast(`${r.item.title}: ${wantLabel(r.item.media)}`, undoLast); }}>{wantLabel(r.item.media)}</button>
              </li>
            ))}
            {recs.length === 0 && <li className="muted" style={{ fontSize: 13 }}>Nada novo no catálogo com essas vibes.</li>}
          </ul>
        </>
      ))}
    </section>
  );
}
