"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActivityLine, PersonAvatar, PersonRow } from "@/components/Social";
import { Header } from "@/components/ui";
import { cloudAvailable, useCloud } from "@/lib/cloud";
import { commentCounts, follow, listFollowing, loadFeed, recentOnMine, saveMine, searchPeople, unfollow, useMySocial, type CommentView, type FeedItem, type PublicProfile } from "@/lib/community";
import { handleError, MAX_BIO, normalizeHandle, threadKey } from "@/lib/social";
import { useHydrated, useLibrary } from "@/lib/store";

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
  const [onMine, setOnMine] = useState<(CommentView & { title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const reload = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([listFollowing(userId), loadFeed(userId), recentOnMine(userId)])
      .then(async ([f, fd, mineC]) => {
        const c = await commentCounts(fd.map((x) => ({ user: x.user.id, item: x.row.item_id })));
        if (live) { setFollowing(f); setFeed(fd); setOnMine(mineC); setCounts(c); setErr(null); }
      })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Não consegui carregar."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId, tick]);

  return (
    <>
      <PublicSettings userId={userId} />
      <Search userId={userId} lib={lib} following={following} onChange={reload} canFollow={!!mine?.is_public} />

      <p className="label">Quem você segue</p>
      {loading ? <p className="muted">Carregando…</p> : following.length === 0 ? (
        <p className="card" style={{ fontSize: 14 }}>Você ainda não segue ninguém. Procure por nome ou @usuario acima.</p>
      ) : (
        <ul className="stack gap8" data-testid="seguindo">
          {following.map((p) => (
            <PersonRow key={p.id} p={p} lib={lib} action={
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={async () => { await unfollow(userId, p.id); await reload(); }} aria-label={`Deixar de seguir ${p.name}`}>Seguindo</button>
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
                <p style={{ marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</p>
                {mine && <Link href={`/u/${mine.handle}`} style={{ fontSize: 13 }}>Ver a conversa</Link>}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="label">O que estão fazendo</p>
      {err && <p role="status" style={{ color: "var(--danger)" }}>{err}</p>}
      {!loading && feed.length === 0 && <p className="card" style={{ fontSize: 14 }}>Quando quem você segue registrar algo, aparece aqui.</p>}
      <ul className="stack gap8" data-testid="feed">
        {feed.map((f) => (
          <ActivityLine key={f.user.id + f.row.item_id} r={f.row} when={f.at} thread={{ user: f.user.id, item: f.row.item_id }} count={counts.get(threadKey(f.user.id, f.row.item_id)) ?? 0} onThreadChange={reload} who={
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
      searchPeople(q).then((r) => { if (live) { setRes(r.filter((p) => p.id !== userId)); setErr(null); } }).catch((e) => live && setErr(e.message));
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
                onClick={async () => { await (ids.has(p.id) ? unfollow(userId, p.id) : follow(userId, p.id)); await onChange(); }}>
                {ids.has(p.id) ? "Seguindo" : "Seguir"}
              </button>
            } />
          ))}
        </ul>
      )}
    </>
  );
}
