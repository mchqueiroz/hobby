import { NextResponse, type NextRequest } from "next/server";
import { check, clientIp, ruleFor } from "@/lib/rateLimit";

/** Roda só nas rotas /api: aplica o limite por IP antes de gastar cota das fontes externas. */
export function proxy(req: NextRequest) {
  const { name, rule } = ruleFor(req.nextUrl.pathname);
  const r = check(`${name}:${clientIp(req.headers)}`, rule);
  if (r.ok) return NextResponse.next();
  return NextResponse.json(
    { error: "rate_limited", message: "Muitas requisições em pouco tempo. Espere um instante e tente de novo." },
    { status: 429, headers: { "Retry-After": String(r.retryAfter), "Cache-Control": "no-store" } },
  );
}

export const config = { matcher: "/api/:path*" };
