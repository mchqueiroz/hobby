"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { bootCloud } from "@/lib/cloud";
import { RegisterSheet } from "./RegisterSheet";

interface Ctx {
  openRegister: (item?: Item) => void;
  toast: (msg: string, undo?: () => void) => void;
}
const ShellCtx = createContext<Ctx>({ openRegister: () => {}, toast: () => {} });
export const useShell = () => useContext(ShellCtx);

const BARE = ["/importar", "/favoritos"];
const LIB_PATHS = ["/biblioteca", "/diario", "/listas", "/estatisticas"];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
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
  useEffect(() => { bootCloud(); }, []);

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
        <div className="tabbar">
          <nav aria-label="Principal">
            <Link href="/biblioteca" aria-current={LIB_PATHS.some((p) => path.startsWith(p)) ? "page" : undefined}>Biblioteca</Link>
            <Link href="/descobrir" aria-current={path.startsWith("/descobrir") ? "page" : undefined}>Descobrir</Link>
            <button type="button" className="plus" aria-label="Registrar um item" onClick={() => openRegister()}>+</button>
            <Link href="/buscar" aria-current={path.startsWith("/buscar") ? "page" : undefined}>Buscar</Link>
            <Link href="/perfil" aria-current={path.startsWith("/perfil") ? "page" : undefined}>Perfil</Link>
          </nav>
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
