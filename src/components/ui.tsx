"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useCover } from "@/lib/covers";
import type { Item, Media } from "@/lib/types";
import { MEDIA_LABEL } from "@/lib/types";
import { fmtRating } from "@/lib/recommend";

export function Cover({
  item, w = 106, h = 150, fs = 13,
}: { item: Pick<Item, "id" | "title" | "media" | "year" | "cover" | "source">; w?: number; h?: number; fs?: number }) {
  const style: CSSProperties = { width: w, height: h, fontSize: fs };
  const url = useCover(item);
  const [bad, setBad] = useState<string | null>(null);
  const show = url && bad !== url;
  return (
    <div className={`cover m-${item.media}`} style={style} aria-hidden="true">
      <span>{item.title}</span>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(url)} />
      )}
    </div>
  );
}

export function MediaTag({ media }: { media: Media }) {
  return <span className={`tag m-${media}`}>{MEDIA_LABEL[media]}</span>;
}

/** Nota só de leitura, com meia estrela. */
export function Rating({ value, size = 13 }: { value?: number; size?: number }) {
  if (value === undefined) return <span className="muted" style={{ fontSize: size }}>sem nota</span>;
  const pct = (value / 5) * 100;
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`Nota ${fmtRating(value)} de 5`}>
      <span className="bg" aria-hidden="true">★★★★★</span>
      <span className="fg" aria-hidden="true" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

/** Entrada de nota: cada estrela tem duas metades clicáveis. Um toque salva. */
export function StarInput({ value, onPick }: { value?: number; onPick: (v: number) => void }) {
  return (
    <div className="starinput" role="group" aria-label="Sua nota">
      <Rating value={value ?? 0} size={38} />
      <div className="hits">
        {Array.from({ length: 10 }, (_, i) => (i + 1) / 2).map((n) => (
          <button key={n} type="button" aria-label={`Nota ${fmtRating(n)}`} onClick={() => onPick(n)} />
        ))}
      </div>
    </div>
  );
}

export function Chips<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Barra de progresso acessível. Sem total não há porcentagem, então não desenha nada. */
export function ProgressBar({ value, total, label }: { value: number; total?: number; label: string }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((value / total) * 100));
  return (
    <div className="pbar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(value, total)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Header({ title, sub }: { title: string; sub?: string }) {
  const path = usePathname();
  return (
    <header className="hdr">
      <div className="word">hobby</div>
      {path !== "/buscar" && (
        <Link href="/buscar" className="hsearch" aria-label="Buscar">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
      )}
      <h1 style={{ marginTop: 14 }}>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </header>
  );
}
