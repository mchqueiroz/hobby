"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authProviders, cloudAvailable, deleteAccount, resetPassword, signIn, signInWith, signOut, signUp, syncNow, updatePassword, useCloud, type Provider } from "@/lib/cloud";

type Mode = "entrar" | "criar" | "recuperar";

/** Cartão de conta no Perfil: entrar, criar, recuperar senha, ver estado do sync, sair e excluir a conta. */
export function Account() {
  const cloud = useCloud();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [changing, setChanging] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [social, setSocial] = useState<Record<Provider, boolean>>({ google: false, apple: false });
  useEffect(() => {
    let alive = true;
    void authProviders().then((p) => alive && setSocial(p));
    return () => { alive = false; };
  }, []);

  if (!cloudAvailable()) return null;
  if (!cloud.ready) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    const r = mode === "entrar" ? await signIn(email, pass) : mode === "criar" ? await signUp(email, pass) : await resetPassword(email);
    setBusy(false);
    if (!r.ok) return setInfo({ kind: "erro", text: r.error });
    if (mode === "criar" && r.needsConfirm) setInfo({ kind: "ok", text: "Conta criada. Enviamos um link de confirmação para o seu e-mail. Abra o link e depois entre." });
    else if (mode === "recuperar") setInfo({ kind: "ok", text: "Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha." });
    else setPass("");
  }

  async function savePass(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    const r = await updatePassword(newPass);
    setBusy(false);
    if (!r.ok) return setInfo({ kind: "erro", text: r.error });
    setNewPass("");
    setChanging(false);
    setInfo({ kind: "ok", text: "Senha nova salva." });
  }

  async function social_(p: Provider) {
    setInfo(null);
    const r = await signInWith(p);
    if (!r.ok) setInfo({ kind: "erro", text: r.error });
  }

  const status =
    cloud.phase === "syncing" ? "Sincronizando…" :
    cloud.phase === "error" ? `Não sincronizou: ${cloud.error}` :
    cloud.lastSync ? `Sincronizado às ${new Date(cloud.lastSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Conectado";

  return (
    <>
      <p className="label">Conta</p>
      <div className="card" data-testid="conta">
        {cloud.userId ? (
          <>
            <p style={{ fontSize: 14 }}>Você está em <strong>{cloud.email}</strong>.</p>
            <p style={{ fontSize: 14 }} role="status" data-testid="sync-status">{status}</p>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Seus registros são copiados para a sua conta e juntados com os de outros aparelhos. Nada é apagado por causa da sincronização.
            </p>
            <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => void syncNow()} disabled={cloud.phase === "syncing"}>Sincronizar agora</button>
              <Link href="/comunidade" className="btn ghost small" style={{ width: "auto" }}>Comunidade</Link>
              <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => void signOut()}>Sair</button>
              {!confirmDel ? (
                <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => setConfirmDel(true)}>Excluir minha conta</button>
              ) : (
                <>
                  <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={async () => {
                    const r = await deleteAccount();
                    setConfirmDel(false);
                    if (!r.ok) setInfo({ kind: "erro", text: r.error });
                  }}>Apagar conta e dados</button>
                  <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setConfirmDel(false)}>Cancelar</button>
                </>
              )}
            </div>
            {(cloud.recovery || changing) && (
              <form onSubmit={savePass} className="mt12" data-testid="nova-senha">
                <label className="label" htmlFor="nova-senha">{cloud.recovery ? "Escolha sua nova senha" : "Nova senha"}</label>
                <input id="nova-senha" className="field" type="password" autoComplete="new-password" minLength={8} value={newPass} onChange={(e) => setNewPass(e.target.value)} autoFocus={cloud.recovery} />
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Mínimo de 8 caracteres.</p>
                <button type="submit" className="btn mt8" disabled={busy || newPass.length < 8}>{busy ? "Aguarde…" : "Salvar senha"}</button>
              </form>
            )}
            {!cloud.recovery && !changing && (
              <button type="button" className="btn ghost small mt8" style={{ width: "auto" }} onClick={() => setChanging(true)}>Trocar senha</button>
            )}
            {confirmDel && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Isso apaga a conta, a cópia na nuvem, o perfil público e os seguidores, e limpa este aparelho. Não dá para desfazer.</p>}
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <p style={{ fontSize: 14 }}>
              Opcional. Com uma conta, seus registros ficam salvos na nuvem, passam entre aparelhos e você pode ter perfil público e seguir amigos.
              Sem conta, tudo continua só neste aparelho.
            </p>
            {(social.google || social.apple) && (
              <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
                {social.google && <button type="button" className="btn small" style={{ width: "auto" }} onClick={() => void social_("google")}>Entrar com Google</button>}
                {social.apple && <button type="button" className="btn small" style={{ width: "auto" }} onClick={() => void social_("apple")}>Entrar com Apple</button>}
              </div>
            )}
            <div className="row gap8 mt12" role="tablist" style={{ flexWrap: "wrap" }}>
              {(["entrar", "criar", "recuperar"] as Mode[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className={`btn small ${mode === m ? "" : "ghost"}`} style={{ width: "auto" }} onClick={() => { setMode(m); setInfo(null); }}>
                  {m === "entrar" ? "Entrar" : m === "criar" ? "Criar conta" : "Esqueci a senha"}
                </button>
              ))}
            </div>
            <label className="label mt12" htmlFor="conta-email">E-mail</label>
            <input id="conta-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode !== "recuperar" && (
              <>
                <label className="label mt12" htmlFor="conta-senha">Senha</label>
                <input id="conta-senha" className="field" type="password" autoComplete={mode === "entrar" ? "current-password" : "new-password"} minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} />
                {mode === "criar" && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Mínimo de 8 caracteres.</p>}
              </>
            )}
            <button type="submit" className="btn mt12" disabled={busy || !email.includes("@") || (mode !== "recuperar" && pass.length < 8)}>
              {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
            </button>
          </form>
        )}
        {info && <p role="status" data-testid="conta-msg" style={{ fontSize: 14, marginTop: 10, color: info.kind === "erro" ? "var(--danger)" : "var(--ink)" }}>{info.text}</p>}
      </div>
    </>
  );
}
