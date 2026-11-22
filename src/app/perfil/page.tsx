"use client";

import Link from "next/link";
import { useState } from "react";
import { getItem } from "@/lib/recommend";
import { effectiveDate } from "@/lib/stats";
import { achievements } from "@/lib/achievements";
import { toCsv } from "@/lib/csv";
import { ProgressBar } from "@/components/ui";
import { ThemeChoice } from "@/components/ThemeChoice";
import { Consent } from "@/components/Consent";
import { deleteEverything } from "@/lib/cloud";
import { Account } from "@/components/Account";
import { exportData, loadDemo, restoreBackup, setGoal, useHydrated, useLibrary } from "@/lib/store";
import { parseBackup } from "@/lib/sync";
import { MEDIAS, MEDIA_LABEL, MEDIA_PLURAL, perMedia, type Media } from "@/lib/types";
import { Cover, Header, Rating } from "@/components/ui";
import { Badges, Connections, Favorites, Hero, ShareCard, TasteDna } from "@/components/ProfileParts";
import { readName } from "@/lib/profile";


export default function Perfil() {
  const lib = useLibrary();
  const ready = useHydrated();
  const [confirm, setConfirm] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!ready) return null;

  const done = Object.values(lib.entries).filter((e) => e.status === "concluido");
  const count = (m: Media) => done.filter((e) => getItem(lib, e.itemId)?.media === m).length;
  const counts = perMedia(count);
  const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  const jan1Next = new Date(new Date().getFullYear() + 1, 0, 1).getTime();
  const thisYear = done.filter((e) => effectiveDate(e) >= jan1 && effectiveDate(e) < jan1Next).length;
  const pct = Math.min(100, Math.round((thisYear / lib.goal) * 100));
  const recent = done
    .filter((e) => e.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map((e) => ({ e, item: getItem(lib, e.itemId) }))
    .filter((r) => r.item);

  async function restore(file: File | undefined) {
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) return setRestoreMsg({ ok: false, text: r.error });
    const { entries, lists } = restoreBackup(r.lib);
    setRestoreMsg({ ok: true, text: entries || lists ? `Backup restaurado: ${entries} registro${entries === 1 ? "" : "s"} e ${lists} lista${lists === 1 ? "" : "s"} novos. O que você já tinha foi mantido.` : "Nada novo no backup: tudo já estava aqui." });
  }

  function download() {
    const data = { ...JSON.parse(exportData()), perfil: { nome: readName() } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hobby-meus-dados.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(lib)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hobby-biblioteca.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header title="Seu perfil" sub="O que você viu, jogou, leu e ouviu" />

      <div className="mt16"><Hero lib={lib} counts={counts} total={Object.keys(lib.entries).length} /></div>

      <div className="row between mt24" role="list" aria-label="Concluídos por mídia">
        {MEDIAS.map((m) => (
          <div key={m} className="stat" role="listitem">
            <b style={{ color: `var(--${m}-t)` }}>{counts[m]}</b>
            <span>{MEDIA_PLURAL[m]}</span>
          </div>
        ))}
        <div className="stat" role="listitem"><b>{done.length}</b><span>no total</span></div>
      </div>

      <TasteDna lib={lib} />
      <Favorites lib={lib} />
      <Badges lib={lib} />

      <p className="label">Meta de {new Date().getFullYear()}</p>
      <div className="card">
        <div className="row between" style={{ fontSize: 14 }}>
          <strong>{thisYear} de {lib.goal} concluídos</strong>
          <label className="muted row gap8" style={{ fontSize: 13 }}>
            meta
            <input
              type="number" min={1} max={999} value={lib.goal} aria-label="Meta de itens concluídos no ano"
              onChange={(e) => setGoal(Number(e.target.value) || 1)}
              style={{ width: 64, border: "1.5px solid var(--control)", borderRadius: 8, padding: "6px 8px", background: "var(--field)" }}
            />
          </label>
        </div>
        <div className="bar mt8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta"><i style={{ width: `${pct}%` }} /></div>
        <p className="muted mt8" style={{ fontSize: 12 }}>Só conta o que você concluiu neste ano; o histórico importado fica de fora.</p>
      </div>

      {recent.length > 0 && (
        <>
          <p className="label">Concluídos recentemente</p>
          <ul className="grid3" style={{ listStyle: "none" }}>
            {recent.map(({ e, item }) => (
              <li key={item!.id}>
                <Link href={`/item/${encodeURIComponent(item!.id)}`} aria-label={`${item!.title}, ${MEDIA_LABEL[item!.media]}`}>
                  <Cover item={item!} w={106} h={140} fs={12} />
                </Link>
                <div style={{ marginTop: 6 }}><Rating value={e.rating} size={12} /></div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="label">Desafios</p>
      <ul className="stack gap8" style={{ listStyle: "none", padding: 0 }} data-testid="conquistas">
        {achievements(lib, (id) => getItem(lib, id)?.media).map((a) => (
          <li key={a.id} className="card" style={{ padding: 12, opacity: a.done ? 1 : 0.85 }} data-done={a.done}>
            <div className="row between" style={{ alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{a.done ? "✓ " : ""}{a.title}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{a.value}/{a.goal}</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 8px" }}>{a.desc}</p>
            <ProgressBar value={a.value} total={a.goal} label={`${a.title}: ${a.value} de ${a.goal}`} />
          </li>
        ))}
      </ul>

      <ShareCard lib={lib} counts={counts} total={done.length} />

      <ThemeChoice />

      <Connections />

      <Account />

      <p className="label">Ajuda e legal</p>
      <div className="card">
        <p className="row gap8" style={{ flexWrap: "wrap", fontSize: 14 }}>
          <Link href="/privacidade" style={{ textDecoration: "underline" }}>Privacidade</Link>
          <Link href="/termos" style={{ textDecoration: "underline" }}>Termos de uso</Link>
          {process.env.NEXT_PUBLIC_FEEDBACK_URL && <a href={process.env.NEXT_PUBLIC_FEEDBACK_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }} data-testid="feedback">Enviar feedback</a>}
        </p>
      </div>

      <p className="label">Seus dados</p>
      <div className="card">
        <p style={{ fontSize: 14 }}>
          Seus registros ficam neste aparelho; se você criar uma conta, também numa cópia na nuvem. O que você digita na busca e o nome de usuário do AniList
          na importação passam pelo nosso servidor só para consultar TMDB, IGDB e AniList, e não são guardados.
          Excluir seus dados também apaga o código anônimo do aparelho. Por lei (LGPD), você pode levar ou apagar tudo quando quiser. Menores de 18 anos
          devem usar com o consentimento de um responsável.
        </p>
        <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={download}>Exportar meus dados</button>
          <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={downloadCsv}>Exportar planilha (CSV)</button>
          <label className="btn ghost small" style={{ width: "auto", cursor: "pointer", position: "relative" }}>
            Restaurar backup
            <input type="file" accept="application/json,.json" data-testid="restaurar" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
              onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {!confirm ? (
            <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => setConfirm(true)}>Excluir meus dados</button>
          ) : (
            <>
              <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => { void deleteEverything(); setConfirm(false); }}>Confirmar exclusão</button>
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setConfirm(false)}>Cancelar</button>
            </>
          )}
        </div>
        {restoreMsg && <p role="status" data-testid="restaurar-msg" className={restoreMsg.ok ? "muted" : "err"} style={{ fontSize: 13, marginTop: 10 }}>{restoreMsg.text}</p>}
      </div>

      <Consent />

      <div className="row gap8 mt16" style={{ flexWrap: "wrap" }}>
        {Object.keys(lib.entries).length === 0 && (
          <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={loadDemo}>Carregar dados de exemplo</button>
        )}
        <Link href="/debug" className="btn ghost small" style={{ width: "auto" }}>Métricas do teste</Link>
      </div>
    </>
  );
}
