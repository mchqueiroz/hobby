/** Endereço público do app (defina NEXT_PUBLIC_SITE_URL na Vercel). Sem ele, usa o endereço local. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
