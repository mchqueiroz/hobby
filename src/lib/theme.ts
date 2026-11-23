export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "hobby:theme";

/** Script que roda antes da pintura para não piscar o tema errado. Mantido em texto para ir no <head>. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

const listeners = new Set<() => void>();
export function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function applyTheme(t: Theme) {
  try {
    if (t === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme;
  else root.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const forDark = m.getAttribute("media")?.includes("dark");
    const dark = t === "auto" ? !!forDark : t === "dark";
    m.setAttribute("content", dark ? "#111110" : "#f4f4f1");
  });
  listeners.forEach((l) => l());
}
