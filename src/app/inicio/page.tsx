"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtRating, getItem, recommend } from "@/lib/recommend";
import { buildPool } from "@/lib/search";
import { dayStreak, effectiveDate } from "@/lib/stats";
import { cacheItem, saveEntry, stepProgress, track, undoLast, useHydrated, useLibrary } from "@/lib/store";
import { PROGRESS_UNIT, entryProgress, progressText, statusLabel, wantLabel, type Entry, type Item } from "@/lib/types";
import { Cover, Header, MediaTag, ProgressBar, Rating } from "@/components/ui";
import { useShell } from "@/components/Shell";
import { dueLabel, releaseLabel } from "@/lib/releases";
import { useReleases } from "@/lib/useReleases";

function greeting(h: number) {
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Anel da meta do ano: SVG puro, com o número no meio (o resto da informação vai em texto, para leitor de tela). */
function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" width="84" height="84" aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} transform="rotate(-90 40 40)" style={{ transition: "stroke-dasharray .5s ease" }} />
      <text x="40" y="46" textAnchor="middle" style={{ font: "700 18px Lora, serif", fill: "var(--ink)" }}>{Math.min(100, pct)}%</text>
    </svg>
  );
}

export default function Inicio() {
  const lib = useLibrary();
  const ready = useHydrated();
  const { toast, openRegister } = useShell();

  const rows = useMemo(
    () => Object.values(lib.entries).map((e) => ({ e, item: getItem(lib, e.itemId) })).filter((r): r is { e: Entry; item: Item } => !!r.item),
    [lib],
  );
  const year = new Date().getFullYear();
  const doneThisYear = rows.filter((r) => r.e.status === "concluido" && effectiveDate(r.e) > 0 && new Date(effectiveDate(r.e)).getFullYear() === year).length;
  const pct = Math.round((doneThisYear / lib.goal) * 100);
  const [mountedAt] = useState(() => Date.now());
  const weekCount = useMemo(() => { const t = mountedAt - 7 * 86_400_000; return rows.filter((r) => effectiveDate(r.e) >= t && r.e.status !== "quero").length; }, [rows, mountedAt]);
  const streak = useMemo(() => dayStreak(lib), [lib]);
  const going = rows.filter((r) => r.e.status === "andamento").sort((a, b) => b.e.at - a.e.at).slice(0, 6);
  const rel = useReleases(lib, ready);
  const soon = rel.list.filter((u) => u.days <= 14).slice(0, 3);
  const paused = rows.filter((r) => r.e.status === "pausei").sort((a, b) => b.e.at - a.e.at).slice(0, 3);
  const queue = rows.filter((r) => r.e.status === "quero").sort((a, b) => b.e.at - a.e.at).slice(0, 3);
  const recent = rows.filter((r) => r.e.status !== "quero").sort((a, b) => b.e.at - a.e.at).slice(0, 4);
  const pick = useMemo(() => recommend(lib, { pool: buildPool([]), count: 1 })[0], [lib]);
  if (!ready) return null;
  if (rows.length === 0) {
    return (
      <>
        <Header title="Bem-vindo ao Hobby" sub="Comece pelo que você já viu, leu ou jogou" />
        <section className="card mt16" data-testid="boas-vindas">
          <p style={{ fontSize: 15 }}>Sua biblioteca ainda está vazia. Três jeitos de começar:</p>
          <ul className="stack gap8 mt12" style={{ listStyle: "none", padding: 0 }}>
            <li><button type="button" className="btn" onClick={() => openRegister()}>Registrar o primeiro item</button></li>
            <li><Link href="/importar" className="btn ghost">Importar do AniList, MyAnimeList ou Letterboxd</Link></li>
            <li><Link href="/favoritos" className="btn ghost">Escolher favoritos de jogos e filmes</Link></li>
          </ul>
        </section>
      </>
    );
  }

  function plusOne(item: Item) {
    const r = stepProgress(item.id, 1);
    track("progress_step", { media: item.media, completed: r.completed });
    toast(r.completed ? `${item.title}: concluído! Parabéns.` : `${item.title}: ${progressText(item.media, r.value)}`, undoLast);
  }

  return (
    <>
      <Header title={greeting(new Date().getHours())} sub={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} />

      <section className="card row mt16" style={{ gap: 16, alignItems: "center" }} aria-label="Meta do ano" data-testid="meta">
        <Ring pct={pct} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 16 }}>{doneThisYear} de {lib.goal} em {year}</strong>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {streak.current > 0
              ? <span data-testid="sequencia">{streak.current} {streak.current === 1 ? "dia seguido" : "dias seguidos"}{streak.today ? "" : " (registre algo hoje para manter)"}</span>
              : <span data-testid="sequencia">Sem sequência ativa</span>}
            {streak.best > 1 ? ` · recorde ${streak.best}` : ""}
          </p>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }} data-testid="semana">Nos últimos 7 dias: {weekCount} {weekCount === 1 ? "registro" : "registros"}</p>
          <Link href="/retrospectiva" className="muted" style={{ fontSize: 13, textDecoration: "underline", display: "inline-block", marginTop: 6 }}>Ver retrospectiva</Link>
        </div>
      </section>

      {soon.length > 0 && (
        <section className="card mb12" data-testid="lancamentos-breve" aria-label="Próximos lançamentos">
          <div className="row between" style={{ alignItems: "baseline" }}>
            <p className="label" style={{ margin: 0 }}>Em breve</p>
            <Link href="/lancamentos" style={{ fontSize: 13, textDecoration: "underline" }}>Ver todos</Link>
          </div>
          <ul className="stack gap8 mt8" style={{ listStyle: "none", padding: 0 }}>
            {soon.map(({ item, release, days }) => (
              <li key={item.id} className="row between" style={{ alignItems: "center" }}>
                <Link href={`/item/${encodeURIComponent(item.id)}`} style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</Link>
                <span className="muted" style={{ fontSize: 13 }}>{releaseLabel(release, item.media)} {dueLabel(days)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {paused.length > 0 && (
        <section className="card mb12" data-testid="retomar" aria-label="Pausados">
          <p className="label" style={{ margin: 0 }}>Retomar</p>
          <ul className="stack gap8 mt8" style={{ listStyle: "none", padding: 0 }}>
            {paused.map(({ item }) => (
              <li key={item.id} className="row between" style={{ alignItems: "center" }}>
                <Link href={`/item/${encodeURIComponent(item.id)}`} style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</Link>
                <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`Retomar ${item.title}`}
                  onClick={() => { saveEntry(item, "andamento"); toast(`${item.title}: Em andamento`, undoLast); }}>Retomar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="label">Continuar</p>
      {going.length === 0 ? (
        <div className="card" data-testid="nada-andamento">
          <p style={{ fontSize: 14 }}>Nada em andamento agora.{queue.length ? " Que tal começar algo da sua lista?" : " Registre o que você está vendo, lendo ou jogando."}</p>
          {queue.length > 0 && (
            <ul className="stack gap8 mt8" style={{ listStyle: "none", padding: 0 }}>
              {queue.map(({ item }) => (
                <li key={item.id} className="row between" style={{ alignItems: "center" }}>
                  <Link href={`/item/${encodeURIComponent(item.id)}`} style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</Link>
                  <button type="button" className="btn ghost small" style={{ width: "auto" }} aria-label={`Começar ${item.title}`}
                    onClick={() => { saveEntry(item, "andamento"); toast(`${item.title}: Em andamento`, undoLast); }}>Começar</button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn ghost small mt12" style={{ width: "auto" }} onClick={() => openRegister()}>Registrar algo</button>
        </div>
      ) : (
        <ul className="stack gap8" data-testid="continuar" style={{ listStyle: "none", padding: 0 }}>
          {going.map(({ e, item }) => {
            const prog = entryProgress(e);
            return (
              <li key={item.id} className="card row" style={{ gap: 12, alignItems: "center", padding: 12 }}>
                <Link href={`/item/${encodeURIComponent(item.id)}`} onClick={() => cacheItem(item)} aria-hidden="true" tabIndex={-1}><Cover item={item} w={52} h={72} fs={10} /></Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/item/${encodeURIComponent(item.id)}`} style={{ fontWeight: 700, fontSize: 15, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</Link>
                  <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 6px" }}>
                    <MediaTag media={item.media} />{prog ? ` ${progressText(item.media, prog.value)}${prog.total ? ` de ${prog.total}` : ""}` : " sem progresso ainda"}
                  </p>
                  {prog?.total ? <ProgressBar value={prog.value} total={prog.total} label={`${item.title}: ${prog.value} de ${prog.total}`} /> : null}
                </div>
                <button type="button" className="btn small" style={{ width: "auto", minWidth: 56 }} data-testid="mais-um"
                  aria-label={`+1 ${PROGRESS_UNIT[item.media]} de ${item.title}`} onClick={() => plusOne(item)}>+1</button>
              </li>
            );
          })}
        </ul>
      )}

      {pick && (
        <>
          <p className="label">Sugestão rápida</p>
          <section className="card" data-testid="sugestao">
            <div className="row" style={{ gap: 12 }}>
              <Link href={`/item/${encodeURIComponent(pick.item.id)}`} onClick={() => cacheItem(pick.item)} aria-hidden="true" tabIndex={-1}><Cover item={pick.item} w={64} h={90} fs={11} /></Link>
              <div style={{ flex: 1 }}>
                <Link href={`/item/${encodeURIComponent(pick.item.id)}`} onClick={() => cacheItem(pick.item)} style={{ fontWeight: 700, fontSize: 16 }}>{pick.item.title}</Link>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{pick.reason}</p>
              </div>
            </div>
            <div className="row gap8 mt12">
              <button type="button" className="btn small" style={{ width: "auto" }}
                onClick={() => { saveEntry(pick.item, "quero"); track("rec_accept", { media: pick.item.media, from: "inicio" }); toast(`${pick.item.title}: ${wantLabel(pick.item.media)}`, undoLast); }}>{wantLabel(pick.item.media)}</button>
              <Link href="/descobrir" className="btn ghost small" style={{ width: "auto" }}>Mais sugestões</Link>
            </div>
          </section>
        </>
      )}

      {recent.length > 0 && (
        <>
          <p className="label">Últimos registros</p>
          <ul className="stack gap8" style={{ listStyle: "none", padding: 0 }}>
            {recent.map(({ e, item }) => (
              <li key={item.id}>
                <Link href={`/item/${encodeURIComponent(item.id)}`} className="row" style={{ gap: 12, alignItems: "center", minHeight: 52 }}>
                  <Cover item={item} w={36} h={50} fs={9} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{statusLabel(e.status, item.media)}</span>
                  </span>
                  {e.rating !== undefined && <span aria-label={`Nota ${fmtRating(e.rating)}`}><Rating value={e.rating} /></span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
