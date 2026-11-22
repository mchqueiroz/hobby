"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminModerate, adminReports, isAdmin, type ModerateAction, type ReportedComment } from "@/lib/admin";
import { useCloud } from "@/lib/cloud";
import { REPORT_LABEL, type ReportReason } from "@/lib/community";
import { Header } from "@/components/ui";

const reasonText = (r: string) => REPORT_LABEL[r as ReportReason] ?? r;

export default function Moderacao() {
  const cloud = useCloud();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ReportedComment[] | null>(null);
  const [msg, setMsg] = useState("");
  const uid = cloud.userId;

  const load = useCallback(async () => {
    try { setRows(await adminReports()); setMsg(""); } catch { setMsg("Não consegui carregar as denúncias."); }
  }, []);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    isAdmin().then((a) => { if (live) { setAdmin(a); if (a) void load(); } });
    return () => { live = false; };
  }, [uid, load]);

  async function act(id: string, action: ModerateAction) {
    if (action === "delete" && !window.confirm("Apagar este comentário de vez?")) return;
    const r = await adminModerate(id, action);
    setMsg(r.ok ? "Feito." : r.error);
    await load();
  }

  if (!uid) return <><Header title="Moderação" sub="Área restrita" /><p style={{ fontSize: 14 }}><Link href="/perfil" style={{ textDecoration: "underline" }}>Entre na sua conta</Link> para continuar.</p></>;
  if (admin === null) return <><Header title="Moderação" sub="Área restrita" /><p className="muted" role="status" style={{ fontSize: 14 }}>Verificando…</p></>;
  if (!admin) return <><Header title="Moderação" sub="Área restrita" /><p data-testid="sem-acesso" style={{ fontSize: 14 }}>Esta área é só para a equipe do Hobby.</p></>;

  return (
    <>
      <Header title="Moderação" sub="Comentários denunciados, os mais denunciados primeiro" />
      {msg && <p role="status" data-testid="mod-msg" style={{ fontSize: 13 }}>{msg}</p>}
      {rows?.length === 0 && <div className="card mt12" data-testid="sem-denuncias"><p style={{ fontSize: 14 }}>Nenhuma denúncia pendente.</p></div>}
      <ul className="stack gap8 mt12" style={{ listStyle: "none", padding: 0 }}>
        {rows?.map((r) => (
          <li key={r.comment_id} className="card" data-testid="denuncia">
            <p className="muted" style={{ fontSize: 12 }}>
              {r.reports} {r.reports === 1 ? "denúncia" : "denúncias"} · {r.reasons.map(reasonText).join(", ")} · por @{r.author_handle ?? "perfil não público"}{r.hidden ? " · escondido" : ""}
            </p>
            <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.body}</p>
            <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
              {r.hidden
                ? <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => void act(r.comment_id, "restore")}>Mostrar de novo</button>
                : <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => void act(r.comment_id, "hide")}>Esconder</button>}
              <button type="button" className="btn small" style={{ width: "auto" }} onClick={() => void act(r.comment_id, "delete")}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
