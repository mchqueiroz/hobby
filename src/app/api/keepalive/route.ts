import { NextResponse } from "next/server";

/**
 * Chamada 1x por dia pelo cron da Vercel (vercel.json). O Supabase gratuito pausa o projeto após ~7 dias sem
 * pedidos; uma leitura mínima conta como uso. Não devolve dado nenhum.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, reason: "sem supabase" });
  const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!res?.ok) console.warn("[hobby-fonte] keepalive", res ? `HTTP ${res.status}` : "sem resposta");
  return NextResponse.json({ ok: !!res?.ok }, { headers: { "Cache-Control": "no-store" } });
}
