"use client";

import { Compass, House, MagnifyingGlass, Plus, UserCircle, UsersThree } from "@phosphor-icons/react";
import { useCloud } from "@/lib/cloud";
import { useNovidades } from "@/lib/novidades";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { bootCloud } from "@/lib/cloud";
import { installErrorReporting } from "@/lib/errorReport";
import { useStorageProblem, watchOtherTabs } from "@/lib/store";
import { RegisterSheet } from "./RegisterSheet";

interface Ctx {
  openRegister: (item?: Item) => void;
  toast: (msg: string, undo?: () => void) => void;
}
const ShellCtx = createContext<Ctx>({ openRegister: () => {}, toast: () => {} });
export const useShell = () => useContext(ShellCtx);

const BARE = ["/", "/importar", "/favoritos", "/privacidade", "/termos"];
// a biblioteca agora mora dentro do Perfil: estas telas marcam a aba Perfil
const PROFILE_PATHS = ["/perfil", "/ajustes", "/biblioteca", "/diario", "/lancamentos", "/listas", "/estatisticas", "/retrospectiva"];
const SOCIAL_PATHS = ["/comunidade", "/u/"];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const cloud = useCloud();
  const novidades = useNovidades(cloud.userId);
  const router = useRouter();
  const bare = BARE.includes(path);
  const [sheet, setSheet] = useState<{ n: number; item?: Item } | null>(null);
  const [toast, setToast] = useState<{ n: number; msg: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openRegister = useCallback((item?: Item) => setSheet((s) => ({ n: (s?.n ?? 0) + 1, item })), []);
  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast((t) => ({ n: (t?.n ?? 0) + 1, msg, undo }));
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { bootCloud(); watchOtherTabs(); installErrorReporting(); }, []);
  const storageProblem = useStorageProblem();
  // uso offline: só em produção (em desenvolvimento o cache atrapalharia o recarregamento ao vivo)
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // "/" abre a busca em qualquer tela, menos quando a pessoa está digitando
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !bare) {
        e.preventDefault();
        router.push("/buscar");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, bare]);

  const value = useMemo(() => ({ openRegister, toast: showToast }), [openRegister, showToast]);

  return (
    <ShellCtx.Provider value={value}>
      <main id="conteudo" className={bare ? "app bare" : "app"}><div className="page" key={path}>{children}</div></main>
      {!bare && (
        <>
          {/* no celular o "+" fica sozinho no canto superior direito; no computador vira "Registrar" no menu lateral */}
          <button type="button" className="plus-top" aria-label="Registrar um item" onClick={() => openRegister()}><Plus size={22} weight="bold" aria-hidden="true" /></button>
          <div className="tabbar">
            <nav aria-label="Principal">
              <button type="button" className="plus" aria-label="Registrar um item" onClick={() => openRegister()}><Plus size={20} weight="bold" aria-hidden="true" /></button>
              <Link href="/inicio" aria-current={path.startsWith("/inicio") ? "page" : undefined}><House size={22} weight={path.startsWith("/inicio") ? "fill" : "regular"} aria-hidden="true" />Início</Link>
              <Link href="/buscar" aria-current={path.startsWith("/buscar") ? "page" : undefined}><MagnifyingGlass size={22} weight={path.startsWith("/buscar") ? "bold" : "regular"} aria-hidden="true" />Buscar</Link>
              <Link href="/descobrir" aria-current={path.startsWith("/descobrir") ? "page" : undefined}><Compass size={22} weight={path.startsWith("/descobrir") ? "fill" : "regular"} aria-hidden="true" />Descobrir</Link>
              <Link href="/comunidade" aria-current={SOCIAL_PATHS.some((p) => path.startsWith(p)) ? "page" : undefined}><UsersThree size={22} weight={SOCIAL_PATHS.some((p) => path.startsWith(p)) ? "fill" : "regular"} aria-hidden="true" />Social{novidades > 0 && <><span className="dot" aria-hidden="true" /><span className="sr"> ({novidades} {novidades === 1 ? "novidade" : "novidades"})</span></>}</Link>
              <Link href="/perfil" aria-current={PROFILE_PATHS.some((p) => path.startsWith(p)) ? "page" : undefined}><UserCircle size={22} weight={PROFILE_PATHS.some((p) => path.startsWith(p)) ? "fill" : "regular"} aria-hidden="true" />Perfil</Link>
            </nav>
          </div>
        </>
      )}
      {storageProblem && (
        <div role="alert" data-testid="aviso-armazenamento" className="card" style={{ position: "fixed", left: 12, right: 12, top: 12, zIndex: 60, borderColor: "var(--danger)" }}>
          <strong style={{ fontSize: 14 }}>Não consegui salvar neste aparelho</strong>
          <p style={{ fontSize: 13, marginTop: 4 }}>O armazenamento do navegador está cheio ou bloqueado. O que você registrar agora pode se perder ao fechar o app. Libere espaço, ou <Link href="/perfil" style={{ textDecoration: "underline" }}>exporte seus dados no Perfil</Link>.</p>
        </div>
      )}
      {sheet && <RegisterSheet key={`sheet-${sheet.n}`} initial={sheet.item} onClose={() => setSheet(null)} />}
      {toast && (
        <div className="toast" role="status" aria-live="polite" key={`toast-${toast.n}`}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button type="button" onClick={() => { toast.undo?.(); setToast(null); }}>Desfazer</button>
          )}
        </div>
      )}
    </ShellCtx.Provider>
  );
}
