"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { badges, bridgeVibes, dna, favorites, persona, weeklyStreak, memberSince } from "@/lib/insights";
import { MEDIA_HUE, bannerColors, bannerGradient, vibePalette } from "@/lib/palette";
import { initials, MAX_NAME, setProfileName, useProfile } from "@/lib/profile";
import { bannerStyle, ProfileImageEditor } from "./ProfileImageEditor";
import { buildShareCard } from "@/lib/shareCard";
import { telemetryAvailable, useConsent } from "@/lib/telemetry";
import { MEDIAS, MEDIA_LABEL, MEDIA_PLURAL as LABEL, MEDIA_SHORT as SHORT, type Library, type Media } from "@/lib/types";
import { Cover, Rating } from "./ui";

/** "animes", "animes e jogos", "animes, jogos e filmes" */
const joinMedias = (ms: Media[]) => (ms.length <= 1 ? ms.map((m) => SHORT[m]).join("") : ms.slice(0, -1).map((m) => SHORT[m]).join(", ") + " e " + SHORT[ms[ms.length - 1]]);

/* ------------------------------ cabeçalho ------------------------------ */

export function Hero({ lib, counts, total }: { lib: Library; counts: Record<Media, number>; total: number }) {
  const profile = useProfile();
  const name = profile.name;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editor, setEditor] = useState<"avatar" | "banner" | null>(null);
  const p = persona(lib);
  const since = memberSince(lib);
  const streak = weeklyStreak(lib);
  const main = p?.mainMedia ?? (MEDIAS.slice().sort((a, b) => counts[b] - counts[a])[0] as Media);
  const sinceText = since ? new Date(since).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : null;

  function save() {
    setProfileName(draft);
    setEditing(false);
  }

  const autoBanner = bannerGradient(vibePalette(p?.top ?? [], main));
  return (
    <section className="hero card" aria-label="Sobre você">
      <div className="hero-banner" style={bannerStyle(profile.banner, autoBanner)} data-banner={profile.banner?.kind ?? "auto"}>
        <button type="button" className="edit" onClick={() => setEditor("banner")} aria-label="Alterar banner">Banner</button>
      </div>
      <div className="hero-body">
      <div className="row" style={{ gap: 16, alignItems: "flex-end" }}>
        <div className="avatar-wrap">
          <div className="avatar" data-photo={profile.avatar ? "sim" : "nao"} aria-hidden="true"
            style={profile.avatar ? { backgroundImage: `url(${profile.avatar})` } : { background: `var(--${profile.color ?? main})` }}>
            {!profile.avatar && initials(name)}
          </div>
          <button type="button" className="edit" onClick={() => setEditor("avatar")} aria-label="Alterar foto de perfil">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
          {editing ? (
            <form className="row gap8" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <label className="sr" htmlFor="nome">Seu nome</label>
              <input id="nome" className="field" style={{ padding: 10 }} value={draft} maxLength={MAX_NAME} autoFocus
                placeholder="Como quer ser chamado" onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="btn small" style={{ width: "auto", padding: "0 14px" }}>Salvar</button>
            </form>
          ) : (
            <>
              <h2 style={{ fontSize: 26, overflowWrap: "anywhere" }}>{name || "Sem nome ainda"}</h2>
              <button type="button" className="linkbtn" onClick={() => { setDraft(name); setEditing(true); }}>
                {name ? "Editar nome" : "Adicionar seu nome"}
              </button>
            </>
          )}
        </div>
      </div>
      {p ? (
        <p style={{ marginTop: 14, fontSize: 15 }}>
          <strong>{p.title}.</strong> <span className="muted">Você curte {p.top.slice(0, 3).join(", ")}.</span>
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>Registre algumas obras e o Hobby descreve o seu gosto aqui.</p>
      )}
      <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
        <span className="vibe">{total} obras</span>
        {sinceText && <span className="vibe">desde {sinceText}</span>}
        {streak.current > 0 && <span className="vibe on">{streak.current} {streak.current === 1 ? "semana seguida" : "semanas seguidas"}</span>}
      </div>
      </div>
      {editor && <ProfileImageEditor kind={editor} profile={profile} mainMedia={main} autoBanner={autoBanner} onClose={() => setEditor(null)} />}
    </section>
  );
}

/* ------------------------------ DNA do gosto ------------------------------ */

export function TasteDna({ lib }: { lib: Library }) {
  const rows = dna(lib, 8);
  const bridges = bridgeVibes(lib).slice(0, 4);
  if (rows.length === 0) return null;
  const max = rows[0].weight;
  return (
    <section aria-labelledby="dna-t">
      <p className="label" id="dna-t">Suas vibes</p>
      <div className="card">
        <ul style={{ listStyle: "none" }}>
          {rows.map(({ vibe, by, weight }) => (
            <li key={vibe} className="dna-row">
              <span className="dna-name">{vibe}</span>
              <span className="dna-bar" role="img" aria-label={`${vibe}: ${MEDIAS.filter((m) => by[m] > 0).map((m) => `${LABEL[m]} ${Math.round((by[m] / weight) * 100)}%`).join(", ")}`}
                style={{ width: `${Math.max(8, Math.round((weight / max) * 100))}%` }}>
                {MEDIAS.map((m) => by[m] > 0 && <i key={m} style={{ flex: by[m], background: `var(--${m})` }} />)}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          {MEDIAS.map((m) => <span key={m} style={{ marginRight: 12 }}><i className="dot" style={{ background: `var(--${m})` }} /> {MEDIA_LABEL[m]}</span>)}
        </p>
      </div>
      {bridges.length > 0 && (
        <div className="card mt12">
          <p className="label" style={{ margin: 0 }}>O que liga as suas mídias</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {bridges.map((b, i) => (
              <span key={b.vibe}>{i > 0 && " · "}<strong>{b.vibe}</strong> <span className="muted">({joinMedias(b.medias)})</span></span>
            ))}
          </p>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>É esse fio que o Hobby usa para sugerir um jogo a partir de um anime que você amou.</p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ favoritos ------------------------------ */

export function Favorites({ lib }: { lib: Library }) {
  const favs = favorites(lib, 4);
  if (favs.length === 0) return null;
  return (
    <section aria-labelledby="fav-t">
      <p className="label" id="fav-t">Seus favoritos</p>
      <ul className="grid4" style={{ listStyle: "none" }}>
        {favs.map(({ entry, item }) => (
          <li key={item.id}>
            <Link href={`/item/${encodeURIComponent(item.id)}`}>
              <Cover item={item} w={120} h={168} fs={12} />
              <strong style={{ display: "block", fontSize: 13, marginTop: 6 }}>{item.title}<span className="sr">, {MEDIA_LABEL[item.media]}</span></strong>
            </Link>
            <Rating value={entry.rating} size={12} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ conquistas ------------------------------ */

export function Badges({ lib }: { lib: Library }) {
  const list = badges(lib);
  const earned = list.filter((b) => b.earned).length;
  return (
    <section aria-labelledby="badges-t">
      <p className="label" id="badges-t">Conquistas · {earned} de {list.length}</p>
      <ul className="badges" style={{ listStyle: "none" }}>
        {list.map((b) => (
          <li key={b.id} className={b.earned ? "badge on" : "badge"}>
            <span className="badge-mark" aria-hidden="true">{b.earned ? "✓" : `${b.value}/${b.target}`}</span>
            <span>
              <strong style={{ fontSize: 14, display: "block" }}>{b.label}{b.earned && <span className="sr"> (conquistada)</span>}</strong>
              <span className="muted" style={{ fontSize: 12.5 }}>{b.desc}</span>
              {!b.earned && (
                <span className="bar mt8" style={{ display: "block", height: 6 }} role="progressbar" aria-label={`Progresso: ${b.label}`}
                  aria-valuenow={b.value} aria-valuemin={0} aria-valuemax={b.target}><i style={{ width: `${(b.value / b.target) * 100}%` }} /></span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ cartão para compartilhar ------------------------------ */

export function ShareCard({ lib, counts, total }: { lib: Library; counts: Record<Media, number>; total: number }) {
  const profile = useProfile();
  const name = profile.name;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const p = persona(lib);

  async function make() {
    const main = p?.mainMedia ?? (MEDIAS.slice().sort((a, b) => counts[b] - counts[a])[0] as Media);
    const [c1, c2] = bannerColors(vibePalette(p?.top ?? [], main));
    const bm = profile.banner?.kind === "media" ? bannerColors({ h: MEDIA_HUE[profile.banner.media], s: 0.5, l: 0.45 }) : null;
    const blob = await buildShareCard({
      name,
      initials: initials(name),
      avatar: profile.avatar,
      avatarMedia: profile.color ?? main,
      bannerImage: profile.banner?.kind === "image" ? profile.banner.data : undefined,
      bannerColors: bm ?? [c1, c2],
      title: p?.title ?? "Colecionador de histórias",
      vibes: p?.top ?? [],
      counts,
      total,
      favorites: favorites(lib, 4).map((f) => ({ title: f.item.title, rating: f.entry.rating, media: f.item.media })),
      year: new Date().getFullYear(),
    });
    return blob;
  }

  async function download() {
    setBusy(true);
    setMsg("");
    try {
      const blob = await make();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meu-perfil-hobby.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg("Imagem salva.");
    } catch {
      setMsg("Não deu para gerar a imagem neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setMsg("");
    try {
      const blob = await make();
      const file = new File([blob], "meu-perfil-hobby.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Meu perfil no Hobby" });
      else setMsg("Seu navegador não compartilha imagens direto. Use “Baixar imagem”.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg("Não foi possível compartilhar.");
    } finally {
      setBusy(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <section className="card mt16" aria-labelledby="share-t">
      <h2 id="share-t" style={{ fontSize: 18 }}>Cartão do seu perfil</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Uma imagem com sua foto, seu nome, suas vibes, suas contagens e seus favoritos, para postar onde quiser. Ela é gerada aqui no seu aparelho e não é enviada a ninguém.
      </p>
      <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn small" style={{ width: "auto" }} disabled={busy || total === 0} onClick={download}>Baixar imagem</button>
        {canShare && <button type="button" className="btn ghost small" style={{ width: "auto" }} disabled={busy || total === 0} onClick={share}>Compartilhar</button>}
      </div>
      <p className="muted" role="status" style={{ fontSize: 13, marginTop: 8 }}>{total === 0 ? "Registre algo para gerar o cartão." : msg}</p>
    </section>
  );
}

/* ------------------------------ conexões ------------------------------ */

export function Connections() {
  const consent = useConsent();
  const [s, setS] = useState<{ tmdb: boolean; igdb: boolean } | null | "erro">(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/status", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { tmdb: boolean; igdb: boolean }) => setS({ tmdb: !!b.tmdb, igdb: !!b.igdb }))
      .catch((e) => {
        if (e?.name !== "AbortError") setS("erro");
      });
    return () => ctrl.abort();
  }, []);

  const rows: { name: string; on: boolean | null; on_text: string; off_text: string }[] = [
    { name: "AniList (animes)", on: true, on_text: "Funciona sem chave: busca, capas, importação.", off_text: "" },
    {
      name: "TMDB (filmes e séries)",
      on: s && s !== "erro" ? s.tmdb : null,
      on_text: "Ativo: capas, detalhes, onde assistir e importação do Letterboxd.",
      off_text: "Sem chave: filmes ficam sem capa nem detalhes e o Letterboxd não importa. Veja .env.example.",
    },
    {
      name: "IGDB (jogos)",
      on: s && s !== "erro" ? s.igdb : null,
      on_text: "Ativo: busca, capas e detalhes de jogos.",
      off_text: "Sem chave: jogos só aparecem do catálogo base. Veja .env.example.",
    },
  ];
  return (
    <section className="card mt16" aria-labelledby="con-t">
      <h2 id="con-t" style={{ fontSize: 16 }}>Conexões</h2>
      <ul style={{ listStyle: "none", marginTop: 8 }}>
        {rows.map((r) => (
          <li key={r.name} className="row gap8" style={{ alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className={r.on ? "pill ok" : r.on === null ? "pill" : "pill off"}>{r.on === null ? "…" : r.on ? "ativo" : "desligado"}</span>
            <span style={{ fontSize: 14 }}>
              <strong>{r.name}</strong>
              <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{r.on ? r.on_text : r.on === null ? "Verificando…" : r.off_text}</span>
            </span>
          </li>
        ))}
        {telemetryAvailable() && (
          <li className="row gap8" style={{ alignItems: "flex-start", padding: "8px 0" }}>
            <span className={consent ? "pill ok" : "pill off"}>{consent ? "ativo" : "desligado"}</span>
            <span style={{ fontSize: 14 }}>
              <strong>Métricas anônimas de teste</strong>
              <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{consent ? "Você está ajudando no teste." : "Você não aceitou enviar métricas."}</span>
            </span>
          </li>
        )}
      </ul>
      {s === "erro" && <p className="err" role="status">Não deu para consultar o servidor agora.</p>}
    </section>
  );
}
