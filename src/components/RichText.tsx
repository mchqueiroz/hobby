"use client";

import { useState } from "react";
import { parseSpoilers } from "@/lib/spoiler";

/** Texto de resenha/comentário: ||trechos assim|| ficam borrados até a pessoa tocar. Nunca interpreta HTML. */
export function RichText({ text, style }: { text: string; style?: React.CSSProperties }) {
  const parts = parseSpoilers(text);
  return (
    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>
      {parts.map((p, i) => p.spoiler ? <Spoiler key={i} text={p.text} /> : <span key={i}>{p.text}</span>)}
    </p>
  );
}

function Spoiler({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="spoiler" data-open={open} aria-label={open ? "Esconder spoiler" : "Mostrar spoiler"} aria-pressed={open} onClick={() => setOpen((o) => !o)}>
      <span aria-hidden={!open}>{open ? text : "spoiler: toque para ver"}</span>
    </button>
  );
}
