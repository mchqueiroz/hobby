import { NextResponse } from "next/server";

const MAX_BYTES = 4096;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

/**
 * Recebe os erros que o navegador relata (ver src/lib/errorReport.ts) e os escreve no log do servidor,
 * onde a Vercel os mostra em Logs: procure por "[hobby-erro]". Não guarda IP nem nada que identifique a pessoa.
 */
export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const message = clip(b.message, 300);
  if (!message) return new NextResponse(null, { status: 400 });
  console.error("[hobby-erro]", JSON.stringify({ message, where: clip(b.where, 30), path: clip(b.path, 120), digest: clip(b.digest, 40), stack: clip(b.stack, 1500) }));
  return new NextResponse(null, { status: 204 });
}
