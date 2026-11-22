"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/errorReport";

/** Rede de segurança: se uma tela quebrar, a pessoa vê isto em vez de uma página em branco, e os dados continuam intactos. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error, "tela");
  }, [error]);
  return (
    <div className="empty" role="alert" style={{ marginTop: 40 }}>
      <h1 style={{ fontSize: 22 }}>Algo deu errado nesta tela</h1>
      <p>Seus registros estão seguros neste aparelho. Tente de novo; se continuar, volte para a biblioteca.</p>
      <div className="row gap8 mt16" style={{ justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ width: "auto" }} onClick={reset}>Tentar de novo</button>
        <Link href="/biblioteca" className="btn ghost" style={{ width: "auto" }}>Ir para a biblioteca</Link>
      </div>
    </div>
  );
}
