"use client";

import { setConsent, telemetryAvailable, useConsent } from "@/lib/telemetry";

export function Consent() {
  const on = useConsent();
  if (!telemetryAvailable()) return null;
  return (
    <section className="card mt16" aria-labelledby="consent-t">
      <h2 id="consent-t" style={{ fontSize: 16 }}>Ajude no teste do Hobby</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Se você concordar, enviamos de forma anônima quantos toques e quanto tempo o registro levou, e se você aceitou
        sugestões. Não enviamos títulos, notas, seu usuário do AniList nem e-mail. Você pode desligar quando quiser.
        Menores de 18 anos devem ter autorização de um responsável para participar.
      </p>
      <label className="row gap8 mt12" style={{ minHeight: 44, cursor: "pointer" }}>
        <input type="checkbox" checked={on} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22 }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Aceito enviar métricas anônimas de uso</span>
      </label>
    </section>
  );
}
