"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtRating } from "@/lib/recommend";
import { reviewYears, yearInReview } from "@/lib/review";
import { useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL } from "@/lib/types";
import { Cover, Header, Rating } from "@/components/ui";
import { LibNav } from "@/components/LibNav";
import { buildReviewCard, reviewCardData } from "@/lib/reviewCard";
import type { YearReview } from "@/lib/review";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

function ShareReview({ r }: { r: YearReview }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const name = `retrospectiva-hobby-${r.year}.png`;
  const make = () => buildReviewCard(reviewCardData(r));
  async function download() {
    setBusy(true); setMsg("");
    try {
      const url = URL.createObjectURL(await make());
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg("Imagem salva.");
    } catch { setMsg("Não deu para gerar a imagem neste navegador."); } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true); setMsg("");
    try {
      const file = new File([await make()], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Meu ${r.year} no Hobby` });
      else setMsg("Seu navegador não compartilha imagens direto. Use “Baixar imagem”.");
    } catch (e) { if ((e as Error)?.name !== "AbortError") setMsg("Não foi possível compartilhar."); } finally { setBusy(false); }
  }
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <section className="card mt16" aria-labelledby="share-ano" data-testid="compartilhar-ano">
      <h2 id="share-ano" style={{ fontSize: 18 }}>Compartilhar seu {r.year}</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Uma imagem com seus números do ano, gerada aqui no seu aparelho. Não vai para ninguém até você postar.</p>
      <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn small" style={{ width: "auto" }} disabled={busy || r.done === 0} onClick={download}>Baixar imagem</button>
        {canShare && <button type="button" className="btn ghost small" style={{ width: "auto" }} disabled={busy || r.done === 0} onClick={share}>Compartilhar</button>}
      </div>
      <p className="muted" role="status" style={{ fontSize: 13, marginTop: 8 }}>{r.done === 0 ? "Conclua algo neste ano para gerar a imagem." : msg}</p>
    </section>
  );
}

export default function Retrospectiva() {
  const lib = useLibrary();
  const ready = useHydrated();
  const years = reviewYears(lib);
  const [picked, setPicked] = useState<number | null>(null);
  if (!ready) return null;

  const year = picked && years.includes(picked) ? picked : years[0];
  const r = year ? yearInReview(lib, year) : null;
  const undated = Object.values(lib.entries).filter((e) => e.status === "concluido" && !(e.date ?? e.at)).length;

  return (
    <>
      <Header title="Retrospectiva" sub="Seu ano em Hobby" />
      <LibNav current="/estatisticas" />

      {!r || !year ? (
        <div className="empty">
          <h2>Ainda não há um ano para contar</h2>
          <p>A retrospectiva usa a data de cada item. Registre algo (a data de hoje entra sozinha) e volte aqui.</p>
          <Link href="/biblioteca" className="btn mt16" style={{ width: "auto" }}>Ir para a biblioteca</Link>
        </div>
      ) : (
        <>
          {years.length > 1 && (
            <div className="chips mt16" role="group" aria-label="Ano">
              {years.map((y) => <button key={y} type="button" className="chip" aria-pressed={y === year} onClick={() => setPicked(y)}>{y}</button>)}
            </div>
          )}

          <section className="card mt16" aria-label={`Resumo de ${year}`} data-testid="resumo-ano">
            <p className="label" style={{ margin: 0 }}>{year}</p>
            <p style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700, marginTop: 6 }} data-testid="total-ano">
              {r.done} {r.done === 1 ? "obra concluída" : "obras concluídas"}
            </p>
            {r.done > 0 && (
              <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                {MEDIAS.filter((m) => r.byMedia[m] > 0).map((m) => `${r.byMedia[m]} ${MEDIA_PLURAL[m]}`).join(", ")}
                {r.average !== null ? ` · nota média ${fmtRating(r.average)}★` : ""}
              </p>
            )}
            {r.busiestMonth && <p style={{ fontSize: 14, marginTop: 10 }}>Seu mês mais cheio foi <strong>{MONTH_NAMES[r.busiestMonth.month]}</strong>, com {r.busiestMonth.count} {r.busiestMonth.count === 1 ? "obra" : "obras"}.</p>}
            {r.topVibes.length > 0 && <p style={{ fontSize: 14, marginTop: 6 }}>O ano teve cara de <strong>{r.topVibes.join(", ")}</strong>.</p>}
            {r.reviews > 0 && <p style={{ fontSize: 14, marginTop: 6 }}>Você escreveu {r.reviews} {r.reviews === 1 ? "resenha" : "resenhas"}.</p>}
            {r.abandoned > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Largou {r.abandoned} no meio do caminho, e tudo bem.</p>}
          </section>

          {r.best.length > 0 && (
            <>
              <p className="label">As melhores notas</p>
              <ul className="stack gap8" data-testid="melhores" style={{ listStyle: "none", padding: 0 }}>
                {r.best.map(({ item, rating }, i) => (
                  <li key={item.id}>
                    <Link href={`/item/${encodeURIComponent(item.id)}`} className="row" style={{ gap: 12, alignItems: "center", minHeight: 64 }}>
                      <span className="muted" style={{ width: 18, fontWeight: 700 }}>{i + 1}</span>
                      <Cover item={item} w={40} h={56} fs={10} />
                      <span style={{ flex: 1 }}><strong style={{ fontSize: 15 }}>{item.title}</strong></span>
                      <Rating value={rating} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {r.first && r.last && r.first.item.id !== r.last.item.id && (
            <p className="muted mt16" style={{ fontSize: 14 }}>
              Você abriu {year} com <strong>{r.first.item.title}</strong> ({dayLabel(r.first.date)}) e o último concluído foi <strong>{r.last.item.title}</strong> ({dayLabel(r.last.date)}).
            </p>
          )}
          <ShareReview r={r} />
          {undated > 0 && <p className="muted mt16" style={{ fontSize: 12.5 }}>{undated} {undated === 1 ? "item concluído está" : "itens concluídos estão"} sem data (histórico importado) e ficam fora da conta. Dá para escolher a data na página de cada obra.</p>}
        </>
      )}
    </>
  );
}
