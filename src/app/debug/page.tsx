"use client";

import { useState } from "react";
import { clearEvents, readEvents, useHydrated, type AppEvent } from "@/lib/store";
import { Header } from "@/components/ui";

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function Debug() {
  const ready = useHydrated();
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  if (!ready) return null;
  const list = events ?? readEvents();

  const saves = list.filter((e) => e.type === "register_save");
  const ms = saves.map((e) => Number(e.data?.ms)).filter(Number.isFinite);
  const taps = saves.map((e) => Number(e.data?.taps)).filter(Number.isFinite);
  const count = (t: string) => list.filter((e) => e.type === t).length;
  const accepted = count("rec_accept");
  const dismissed = count("rec_dismiss");
  const crossAccepted = list.filter((e) => e.type === "rec_accept" && e.data?.cross === true).length;
  const medMs = median(ms);
  const medTaps = median(taps);

  const rows: [string, string, string][] = [
    ["Registros feitos", String(saves.length), "-"],
    ["Mediana de tempo para registrar", medMs === null ? "-" : `${(medMs / 1000).toFixed(1).replace(".", ",")} s`, "meta: até 5 s"],
    ["Mediana de toques para registrar", medTaps === null ? "-" : String(medTaps), "meta: até 2"],
    ["Importações concluídas", String(count("import_done")), "-"],
    ["Importações com erro", String(count("import_fail")), "-"],
    ["Sugestões aceitas (Quero ver)", String(accepted), "-"],
    ["…sendo de outra mídia", String(crossAccepted), "-"],
    ["Sugestões dispensadas", String(dismissed), "-"],
  ];

  function download() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hobby-eventos.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header title="Métricas do teste" sub="Valem só para este aparelho. Para somar as 20 a 30 pessoas do teste, os eventos precisam ir para o Supabase." />
      <table className="mt24">
        <thead><tr><th>Medida</th><th>Valor</th><th>Critério</th></tr></thead>
        <tbody>
          {rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td><b>{b}</b></td><td className="muted">{c}</td></tr>)}
        </tbody>
      </table>
      <div className="row gap8 mt24" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setEvents(readEvents())}>Atualizar</button>
        <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={download}>Exportar eventos (JSON)</button>
        <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => { clearEvents(); setEvents([]); }}>Limpar</button>
      </div>
    </>
  );
}
