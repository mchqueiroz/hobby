import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

/** Origem do Supabase (as variáveis públicas são lidas no build). Sem elas, o app não fala com ninguém além dele mesmo. */
function origin(url?: string): string[] {
  try {
    return url ? [new URL(url).origin] : [];
  } catch {
    return [];
  }
}

/**
 * Política de conteúdo. O app tem um script inline pequeno (tema, antes de pintar) e o Next injeta os dele,
 * então `script-src` precisa de 'unsafe-inline'; o que a CSP garante aqui é de onde podem vir imagens, conexões e frames.
 * Capas vêm do TMDB, IGDB, AniList, Open Library e Cover Art Archive (que redireciona para archive.org).
 * Em desenvolvimento o Next usa eval, por isso 'unsafe-eval' só fora da produção.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.igdb.com https://*.anilist.co https://covers.openlibrary.org https://coverartarchive.org https://archive.org https://*.archive.org https://cdn.akamai.steamstatic.com https://shared.akamai.steamstatic.com https://shared.fastly.steamstatic.com https://cdn-images.dzcdn.net https://e-cdns-images.dzcdn.net",
  "font-src 'self' data:",
  `connect-src 'self' ${[...origin(process.env.NEXT_PUBLIC_SUPABASE_URL), ...(prod ? [] : ["ws:", "wss:"])].join(" ")}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// O app guarda os dados no navegador e renderiza no cliente; não precisa de Cache Components.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // o navegador precisa checar sempre se há versão nova do service worker
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
          // a diretiva antiga de frame-ancestors, para navegadores velhos
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // HTTPS sempre (a Vercel já serve só HTTPS; isto impede downgrade em visitas seguintes)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
