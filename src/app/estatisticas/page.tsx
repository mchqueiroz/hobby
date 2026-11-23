"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeStats, heatmap, timeSpent } from "@/lib/stats";
import { fmtRating } from "@/lib/recommend";
import { useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, STATUS_LABEL, type Status } from "@/lib/types";
import { Header } from "@/components/ui";
import { LibNav } from "@/components/LibNav";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="hbar">
      <span>{label}</span>
      <div className="bar" aria-hidden="true"><i style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} /></div>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function Estatisticas() {
  const lib = useLibrary();
  const ready = useHydrated();
  const s = useMemo(() => computeStats(lib), [lib]);
  const time = useMemo(() => timeSpent(lib), [lib]);
  if (!ready) return null;

  const medias = MEDIAS;
  const statuses = (Object.keys(STATUS_LABEL) as Status[]);
  const maxHist = Math.max(1, ...s.histogram);
  const maxMonth = Math.max(1, ...s.doneByMonth);
  const maxVibe = Math.max(1, ...s.topVibes.map((v) => v.weight));

  return (
    <>
      <Header title="Estatísticas" sub="Seu gosto em números" />
      <LibNav current="/estatisticas" />

      {s.total === 0 ? (
        <div className="empty">
          <h2>Ainda não há o que contar</h2>
          <p>Registre alguns itens ou importe seu histórico e os números aparecem aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid3 mt16">
            <div className="card stat"><b>{s.total}</b><span>itens</span></div>
            <div className="card stat"><b>{s.average !== null ? fmtRating(s.average) : "-"}</b><span>nota média</span></div>
            <div className="card stat"><b>{s.reviews}</b><span>{s.reviews === 1 ? "resenha" : "resenhas"}</span></div>
          </div>

          <Link href="/retrospectiva" className="btn ghost small mt16" style={{ width: "auto" }}>Ver minha retrospectiva do ano</Link>

          <p className="label">Por mídia</p>
          <div className="card">
            {medias.map((m) => (
              <div key={m}>
                <Bar label={MEDIA_PLURAL[m]} value={s.byMedia[m]} max={s.total} color={`var(--${m})`} />
                {s.averageByMedia[m] !== null && <p className="muted" style={{ fontSize: 11.5, margin: "-2px 0 4px 82px" }}>nota média {fmtRating(s.averageByMedia[m]!)}★</p>}
              </div>
            ))}
          </div>

          {time.total > 0 && (
            <>
              <p className="label">Tempo dedicado</p>
              <div className="card" data-testid="tempo">
                <p style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700 }}>
                  ≈ {time.total.toLocaleString("pt-BR")} h <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>({(time.total / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias)</span>
                </p>
                {medias.filter((m) => time.byMedia[m] > 0).map((m) => (
                  <Bar key={m} label={MEDIA_PLURAL[m]} value={time.byMedia[m]} max={Math.max(...Object.values(time.byMedia))} color={`var(--${m})`} />
                ))}
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  Estimativa: usa o progresso e o total que você anotou; sem eles, vale episódio de anime de 24 min, filme de 2 h, 40 páginas por hora, 20 h por jogo e álbum de 45 min. Conta as vezes que você repetiu.
                </p>
              </div>
            </>
          )}

          <p className="label">Por status</p>
          <div className="card">
            {statuses.map((st) => <Bar key={st} label={STATUS_LABEL[st]} value={s.byStatus[st]} max={s.total} />)}
          </div>

          <p className="label">Como você avalia</p>
          <div className="card">
            {s.rated === 0 ? <p className="muted" style={{ fontSize: 14 }}>Você ainda não deu notas.</p> : (
              [...s.histogram.keys()].reverse().map((i) => (
                <Bar key={i} label={`${fmtRating((i + 1) / 2)}★`} value={s.histogram[i]} max={maxHist} />
              ))
            )}
          </div>

          <p className="label">Atividade nas últimas 20 semanas</p>
          <div className="card" data-testid="heatmap">
            {(() => {
              const cols = heatmap(lib, 20);
              const total = cols.flat().reduce((n, d) => n + d.count, 0);
              return (
                <>
                  <div className="heat" role="img" aria-label={`${total} registros nas últimas 20 semanas`}>
                    {cols.map((c, i) => <div key={i}>{c.map((d) => <i key={d.day} className={d.future ? "f" : `l${Math.min(d.count, 3)}`} title={d.future ? undefined : `${d.count} registro(s)`} />)}</div>)}
                  </div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{total} registros com data. Quanto mais escuro, mais itens no dia.</p>
                </>
              );
            })()}
          </div>

          <p className="label">Concluídos em {new Date().getFullYear()}</p>
          <div className="card">
            <div className="cols" role="img" aria-label={`Concluídos por mês: ${s.doneByMonth.map((n, i) => `${MONTH_NAMES[i]} ${n}`).join(", ")}`}>
              {s.doneByMonth.map((n, i) => <i key={i} style={{ height: `${(n / maxMonth) * 100}%` }} title={`${MONTH_NAMES[i]}: ${n}`} />)}
            </div>
            <div className="cols-l" aria-hidden="true">{MONTHS.map((m, i) => <span key={i}>{m}</span>)}</div>
            <p className="muted mt8" style={{ fontSize: 12 }}>{s.doneThisYear} de {lib.goal} da meta. Só entram itens com data.</p>
          </div>

          <p className="label">Vibes que mais pesam no seu gosto</p>
          <div className="card">
            {s.topVibes.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>Avalie alguns itens para ver suas vibes.</p> :
              s.topVibes.map((v) => <Bar key={v.vibe} label={v.vibe} value={v.weight} max={maxVibe} />)}
          </div>
        </>
      )}
    </>
  );
}
