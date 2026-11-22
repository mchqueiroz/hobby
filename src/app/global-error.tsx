"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/errorReport";

/** Último recurso: erro no próprio layout, onde nem o menu existe mais. Sem depender de CSS do app. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, "layout");
  }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 480, margin: "40px auto" }}>
        <h1 style={{ fontSize: 22 }}>O Hobby não conseguiu abrir</h1>
        <p>Seus registros continuam salvos neste aparelho. Tente carregar de novo.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "12px 20px", fontSize: 16 }}>Tentar de novo</button>
      </body>
    </html>
  );
}
