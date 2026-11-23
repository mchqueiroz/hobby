"use client";

import { CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { getItem } from "@/lib/recommend";
import { effectiveDate } from "@/lib/stats";
import { toCsv } from "@/lib/csv";
import { ThemeChoice } from "@/components/ThemeChoice";
import { Consent } from "@/components/Consent";
import { deleteEverything } from "@/lib/cloud";
import { Account } from "@/components/Account";
import { exportData, loadDemo, restoreBackup, setGoal, useHydrated, useLibrary } from "@/lib/store";
import { parseBackup } from "@/lib/sync";
import { perMedia, type Media } from "@/lib/types";
import { Connections, ShareCard } from "@/components/ProfileParts";
import { readName } from "@/lib/profile";


export default function Ajustes() {
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
      <div className="row"><Link href="/perfil" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><CaretLeft size={16} weight="bold" aria-hidden="true" />Perfil</Link></div>
      <h1 style={{ marginTop: 10 }}>Ajustes</h1>

      <Account />

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

      <ShareCard lib={lib} counts={counts} total={done.length} />

      <ThemeChoice />

      <Connections />

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
