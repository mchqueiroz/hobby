"use client";

/**
 * Relato de erros do navegador, para a pessoa que mantém o app saber o que quebra na mão de quem usa.
 * Vai só o tipo do erro, o começo da pilha (código do app, não dado seu) e o caminho da página sem query.
 * Nada de biblioteca, notas, e-mail ou identificador do aparelho. Desligue com NEXT_PUBLIC_ERROR_REPORTS=off.
 */
const OFF = process.env.NEXT_PUBLIC_ERROR_REPORTS === "off";
const MAX_PER_SESSION = 5;
/** Erros que o navegador ou extensões geram e que não dizem nada sobre o app. */
const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection|chrome-extension:|moz-extension:/i;

const seen = new Set<string>();

export interface ErrorPayload {
  message: string;
  stack?: string;
  where: string;
  path: string;
  digest?: string;
}

export function buildPayload(err: unknown, where: string, path = "/"): ErrorPayload | null {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "erro sem mensagem");
  const message = (e.message || e.name || "erro").slice(0, 300);
  if (NOISE.test(message)) return null;
  return {
    message,
    stack: e.stack?.split("\n").slice(0, 8).join("\n").slice(0, 1500),
    where: where.slice(0, 30),
    path: path.split("?")[0].split("#")[0].slice(0, 120),
    digest: typeof (err as { digest?: unknown })?.digest === "string" ? (err as { digest: string }).digest.slice(0, 40) : undefined,
  };
}

export function reportError(err: unknown, where: string) {
  if (OFF || typeof window === "undefined") return;
  const p = buildPayload(err, where, window.location.pathname);
  if (!p) return;
  const key = `${p.where}|${p.message}`;
  if (seen.has(key) || seen.size >= MAX_PER_SESSION) return;
  seen.add(key);
  try {
    const body = JSON.stringify(p);
    if (!navigator.sendBeacon?.("/api/erro", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/erro", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* relatar erro nunca pode causar outro erro */
  }
}

let installed = false;
/** Pega o que escapa dos componentes: erros soltos e promessas rejeitadas sem tratamento. */
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "promise"));
}
