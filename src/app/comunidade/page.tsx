"use client";

import { RichText } from "@/components/RichText";
import { markSeen, seenAt } from "@/lib/novidades";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActivityLine, PersonAvatar, PersonRow } from "@/components/Social";
import { Header } from "@/components/ui";
import { cloudAvailable, useCloud } from "@/lib/cloud";
import { blockedIds, commentCounts, follow, likeInfo, suggestPeople, type LikeInfo, type SuggestedPerson, listBlocked, listFollowing, loadFeed, recentFollowers, recentLikesOnMine, recentOnMine, saveMine, searchPeople, unblockUser, unfollow, useMySocial, type CommentView, type FeedItem, type PublicProfile } from "@/lib/community";
import { handleError, MAX_BIO, normalizeHandle, threadKey } from "@/lib/social";
import { getLibrary, useHydrated, useLibrary } from "@/lib/store";

export default function Comunidade() {
  const ready = useHydrated();
  const lib = useLibrary();
  const cloud = useCloud();
  if (!ready || !cloud.ready) return null;
  return (
    <>
      <Header title="Comunidade" sub="Veja o que seus amigos estão vendo, jogando e lendo. Tudo opcional." />
      {!cloudAvailable() ? (
        <p className="card mt16">A comunidade precisa de conta, e as contas não estão ativadas nesta versão.</p>
      ) : !cloud.userId ? (
        <div className="card mt16">
          <p style={{ fontSize: 14 }}>Para ter um perfil público e seguir pessoas, crie uma conta (ou entre). Sem conta o Hobby continua funcionando só no seu aparelho.</p>
          <Link href="/perfil" className="btn mt12" style={{ width: "auto" }}>Ir para Conta no Perfil</Link>
        </div>
      ) : (
        <Signed userId={cloud.userId} lib={lib} />
      )}
    </>
  );
}

function Signed({ userId, lib }: { userId: string; lib: ReturnType<typeof useLibrary> }) {
  const mine = useMySocial();
  const [following, setFollowing] = useState<PublicProfile[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [likes, setLikes] = useState<Map<string, LikeInfo>>(new Map());
  const [suggested, setSuggested] = useState<SuggestedPerson[]>([]);
  const [onMine, setOnMine] = useState<(CommentView & { title: string })[]>([]);
  const [likesOnMine, setLikesOnMine] = useState<Awaited<ReturnType<typeof recentLikesOnMine>>>([]);
  const [followers, setFollowers] = useState<{ profile: PublicProfile; at: string }[]>([]);
  const [since] = useState(() => seenAt(userId));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const reload = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([listFollowing(userId), loadFeed(userId), recentOnMine(userId), recentFollowers(userId), recentLikesOnMine(userId).catch(() => [])])
      .then(async ([f, fd, mineC, fol, lkMine]) => {
        const c = await commentCounts(fd.map((x) => ({ user: x.user.id, item: x.row.item_id })));
        const lk = await likeInfo(userId, fd.map((x) => ({ user: x.user.id, item: x.row.item_id }))).catch(() => new Map<string, LikeInfo>());
        const sg = await suggestPeople(userId, getLibrary()).catch(() => [] as SuggestedPerson[]);
        if (live) { setLikes(lk); setSuggested(sg); setFollowing(f); setFeed(fd); setOnMine(mineC); setLikesOnMine(lkMine); setFollowers(fol); setCounts(c); markSeen(userId); setErr(null); }
      })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Não consegui carregar."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId, tick]);

  return (
    <>
      <PublicSettings userId={userId} />
      {!loading && (() => {
        const fresh = followers.filter((x) => Date.parse(x.at) > since);
        const freshC = onMine.filter((c) => Date.parse(c.created_at) > since);
        const freshL = likesOnMine.filter((l) => Date.parse(l.at) > since);
        if (!fresh.length && !freshC.length && !freshL.length) return null;
        return (
          <section className="card" data-testid="novidades" aria-label="Novidades" style={{ borderColor: "var(--ink)" }}>
            <strong style={{ fontSize: 15 }}>Novidades desde sua última visita</strong>
            <ul className="stack gap8 mt8" style={{ listStyle: "none", padding: 0, fontSize: 14 }}>
              {fresh.map((x) => <li key={"f" + x.profile.id}><Link href={`/u/${x.profile.handle}`} style={{ fontWeight: 700 }}>{x.profile.name}</Link> começou a te seguir</li>)}
              {freshL.map((l, i) => <li key={"l" + i} data-testid="curtida-recebida"><strong>{l.who?.name ?? "Alguém"}</strong> curtiu seu registro de <strong>{l.title}</strong></li>)}
              {freshC.map((c) => <li key={"c" + c.id}><strong>{c.author?.name ?? "Alguém"}</strong> comentou em <strong>{c.title}</strong>: “{c.body.length > 80 ? c.body.slice(0, 80) + "…" : c.body}”</li>)}
            </ul>
          </section>
        );
      })()}
      <Search userId={userId} lib={lib} following={following} onChange={reload} canFollow={!!mine?.is_public} />

      <p className="label">Quem você segue</p>
      {loading ? <p className="muted">Carregando…</p> : following.length === 0 ? (
        <p className="card" style={{ fontSize: 14 }}>Você ainda não segue ninguém. Procure por nome ou @usuario acima.</p>
      ) : (
        <ul className="stack gap8" data-testid="seguindo">
          {following.map((p) => (
            <PersonRow key={p.id} p={p} lib={lib} action={
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={async () => { try { await unfollow(userId, p.id); } catch { setErr("Não consegui deixar de seguir agora."); } await reload(); }} aria-label={`Deixar de seguir ${p.name}`}>Seguindo</button>
            } />
          ))}
        </ul>
      )}

      {onMine.length > 0 && (
        <>
          <p className="label">Comentários no seu perfil</p>
          <ul className="stack gap8" data-testid="comentarios-recebidos">
            {onMine.map((c) => (
              <li key={c.id} className="card" style={{ padding: 12, fontSize: 14 }}>
                <strong>{c.author?.name ?? "Alguém"}</strong> comentou em <strong>{c.title}</strong>
                <RichText text={c.body} style={{ marginTop: 4 }} />
                {mine && <Link href={`/u/${mine.handle}`} style={{ fontSize: 13 }}>Ver a conversa</Link>}
              </li>
            ))}
          </ul>
        </>
      )}

      <BlockedList userId={userId} onChange={reload} tick={tick} />

      {suggested.length > 0 && (
        <section aria-label="Gente com gosto parecido" data-testid="sugestoes">
          <p className="label">Gente com gosto parecido</p>
          <ul className="stack gap8" style={{ listStyle: "none", padding: 0 }}>
            {suggested.map((s) => (
              <li key={s.profile.id} className="card row gap12" style={{ alignItems: "center" }}>
                <PersonAvatar p={s.profile} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/u/${s.profile.handle}`} style={{ fontWeight: 700 }}>{s.profile.name}</Link>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {s.shared} {s.shared === 1 ? "obra" : "obras"} em comum{s.agree > 0 ? `, ${s.agree} com nota parecida` : ""}
                  </div>
                </div>
                <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`Seguir ${s.profile.name}`}
                  onClick={() => { follow(userId, s.profile.id).then(reload).catch(() => setErr("Não consegui seguir agora.")); }}>Seguir</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="label">O que estão fazendo</p>
      {err && <p role="status" style={{ color: "var(--danger)" }}>{err}</p>}
      {!loading && feed.length === 0 && <p className="card" style={{ fontSize: 14 }}>Quando quem você segue registrar algo, aparece aqui.</p>}
      <ul className="stack gap8" data-testid="feed">
        {feed.map((f) => (
          <ActivityLine key={f.user.id + f.row.item_id} r={f.row} when={f.at} thread={{ user: f.user.id, item: f.row.item_id }} count={counts.get(threadKey(f.user.id, f.row.item_id)) ?? 0} onThreadChange={reload} like={{ me: userId, info: likes.get(threadKey(f.user.id, f.row.item_id)) }} who={
            <Link href={`/u/${f.user.handle}`} className="row gap8" style={{ display: "inline-flex", alignItems: "center", fontWeight: 700 }}>
              <PersonAvatar p={f.user} size={22} />{f.user.name}
            </Link>
          } />
        ))}
      </ul>
    </>
  );
}

function PublicSettings({ userId }: { userId: string }) {
  const mine = useMySocial();
  const [handle, setHandle] = useState(mine?.handle ?? "");
  const [bio, setBio] = useState(mine?.bio ?? "");
  const [pub, setPub] = useState(mine?.is_public ?? false);
  const [rev, setRev] = useState(mine?.share_reviews ?? false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // se o perfil mudar por fora (carregou da nuvem, ou salvou), o formulário acompanha; a mensagem de status continua
  const sig = JSON.stringify(mine);
  const [seen, setSeen] = useState(sig);
  if (seen !== sig) {
    setSeen(sig);
    setHandle(mine?.handle ?? ""); setBio(mine?.bio ?? ""); setPub(mine?.is_public ?? false); setRev(mine?.share_reviews ?? false);
  }

  const hErr = handle ? handleError(handle) : null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await saveMine(userId, { handle, bio, is_public: pub, share_reviews: pub && rev });
    setBusy(false);
    setMsg(r.ok ? { ok: true, t: pub ? "Perfil público salvo." : "Salvo. Seu perfil não aparece para ninguém." } : { ok: false, t: r.error });
  }

  return (
    <>
      <p className="label">Seu perfil público</p>
      <form className="card" onSubmit={save} noValidate data-testid="publico">
        <p style={{ fontSize: 14 }}>
          Por padrão ninguém vê nada seu. Se você publicar, outras pessoas veem seu nome, foto, bio, números por mídia, suas vibes mais fortes e seus registros
          mais recentes (título, status e nota). Resenhas só aparecem se você marcar a opção abaixo. Você pode despublicar quando quiser: isso apaga o que estava público.
        </p>
        <label className="label mt12" htmlFor="pub-handle">Nome de usuário</label>
        <input id="pub-handle" className="field" value={handle} onChange={(e) => setHandle(normalizeHandle(e.target.value))} autoCapitalize="none" autoComplete="off" spellCheck={false} />
        {hErr && <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 4 }}>{hErr}</p>}
        <label className="label mt12" htmlFor="pub-bio">Bio ({bio.length}/{MAX_BIO})</label>
        <textarea id="pub-bio" className="field" rows={2} maxLength={MAX_BIO} value={bio} onChange={(e) => setBio(e.target.value)} />
        <label className="row gap8 mt12" style={{ minHeight: 44, cursor: "pointer" }}>
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Tornar meu perfil público</span>
        </label>
        <label className="row gap8" style={{ minHeight: 44, cursor: pub ? "pointer" : "not-allowed", opacity: pub ? 1 : 0.5 }}>
          <input type="checkbox" checked={rev && pub} disabled={!pub} onChange={(e) => setRev(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Mostrar também minhas resenhas</span>
        </label>
        <button type="submit" className="btn mt12" disabled={busy || !handle || !!hErr}>{busy ? "Salvando…" : "Salvar"}</button>
        {msg && <p role="status" data-testid="publico-msg" style={{ fontSize: 14, marginTop: 10, color: msg.ok ? "var(--ink)" : "var(--danger)" }}>{msg.t}</p>}
        {mine?.is_public && <p style={{ fontSize: 14, marginTop: 8 }}>Sua página: <Link href={`/u/${mine.handle}`} data-testid="minha-pagina">/u/{mine.handle}</Link></p>}
      </form>
    </>
  );
}

function Search({ userId, lib, following, onChange, canFollow }: { userId: string; lib: ReturnType<typeof useLibrary>; following: PublicProfile[]; onChange: () => Promise<void>; canFollow: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PublicProfile[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ids = new Set(following.map((f) => f.id));
  const shown = q.trim().length >= 2 ? res : null;

  useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      blockedIds(userId).catch(() => [] as string[]).then((ex) => searchPeople(q, ex)).then((r) => { if (live) { setRes(r.filter((p) => p.id !== userId)); setErr(null); } }).catch((e) => live && setErr(e.message));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, userId]);

  return (
    <>
      <p className="label">Encontrar pessoas</p>
      <input className="field" type="search" placeholder="Nome ou @usuario" aria-label="Buscar pessoas" value={q} onChange={(e) => setQ(e.target.value)} />
      {!canFollow && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Para seguir pessoas, publique o seu perfil primeiro (assim a troca é justa).</p>}
      {err && <p role="status" style={{ color: "var(--danger)" }}>{err}</p>}
      {shown && shown.length === 0 && <p className="muted mt8">Ninguém com esse nome. Só aparecem perfis públicos.</p>}
      {shown && shown.length > 0 && (
        <ul className="stack gap8 mt8" data-testid="resultados">
          {shown.map((p) => (
            <PersonRow key={p.id} p={p} lib={lib} action={
              <button type="button" className={`btn small ${ids.has(p.id) ? "ghost" : ""}`} style={{ width: "auto" }} disabled={!canFollow} aria-label={`${ids.has(p.id) ? "Deixar de seguir" : "Seguir"} ${p.name}`}
                onClick={async () => { try { await (ids.has(p.id) ? unfollow(userId, p.id) : follow(userId, p.id)); setErr(null); await onChange(); } catch { setErr("Não foi possível seguir esta pessoa agora."); } }}>
                {ids.has(p.id) ? "Seguindo" : "Seguir"}
              </button>
            } />
          ))}
        </ul>
      )}
    </>
  );
}

/** Quem você bloqueou, com o jeito de desfazer. Só aparece se houver alguém. */
function BlockedList({ userId, onChange, tick }: { userId: string; onChange: () => Promise<void>; tick: number }) {
  const [list, setList] = useState<{ id: string; profile: PublicProfile | null }[]>([]);
  useEffect(() => {
    let live = true;
    listBlocked(userId).then((l) => live && setList(l)).catch(() => {});
    return () => { live = false; };
  }, [userId, tick]);
  if (list.length === 0) return null;
  return (
    <>
      <p className="label">Pessoas bloqueadas</p>
      <ul className="stack gap8" data-testid="bloqueados">
        {list.map((b) => (
          <li key={b.id} className="card row between" style={{ padding: 12, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{b.profile ? <strong>{b.profile.name}</strong> : "Perfil não público"}{b.profile && <span className="muted"> @{b.profile.handle}</span>}</span>
            <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`Desbloquear ${b.profile?.name ?? "pessoa"}`}
              onClick={async () => { await unblockUser(userId, b.id); await onChange(); }}>Desbloquear</button>
          </li>
        ))}
      </ul>
    </>
  );
}
