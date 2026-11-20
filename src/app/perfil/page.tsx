"use client";

import Link from "next/link";
import { useState } from "react";
import { getItem } from "@/lib/recommend";
import { effectiveDate } from "@/lib/stats";
import { ThemeChoice } from "@/components/ThemeChoice";
import { Consent } from "@/components/Consent";
import { deleteEverything } from "@/lib/cloud";
import { Account } from "@/components/Account";
import { exportData, loadDemo, setGoal, useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_LABEL, MEDIA_PLURAL, perMedia, type Media } from "@/lib/types";
import { Cover, Header, Rating } from "@/components/ui";
import { Badges, Connections, Favorites, Hero, ShareCard, TasteDna } from "@/components/ProfileParts";
import { readName } from "@/lib/profile";


export default function Perfil() {
  const lib = useLibrary();
  const ready = useHydrated();
  const [confirm, setConfirm] = useState(false);
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

  return (
    <>
      <Header title="Seu perfil" sub="Cinco mídias, um só lugar" />

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

      <ShareCard lib={lib} counts={counts} total={done.length} />

      <ThemeChoice />

      <Connections />

      <Account />

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
          {!confirm ? (
            <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => setConfirm(true)}>Excluir meus dados</button>
          ) : (
            <>
              <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => { void deleteEverything(); setConfirm(false); }}>Confirmar exclusão</button>
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setConfirm(false)}>Cancelar</button>
            </>
          )}
        </div>
      </div>

      <Consent />

      <div className="row gap8 mt16" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={loadDemo}>Restaurar dados de exemplo</button>
        <Link href="/debug" className="btn ghost small" style={{ width: "auto" }}>Métricas do teste</Link>
      </div>
    </>
  );
}
