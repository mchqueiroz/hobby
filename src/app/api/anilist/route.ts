import { NextResponse } from "next/server";
import {
  ANILIST_QUERY,
  ANILIST_URL,
  USER_RE,
  classifyError,
  mapAniList,
  type AniListResponse,
  type ImportError,
} from "@/lib/anilist";

const MESSAGES: Record<ImportError, string> = {
  invalid: "Nome de usuário inválido. Use de 2 a 20 letras, números ou _.",
  not_found: "Não encontramos esse usuário no AniList.",
  private: "A lista desse usuário é privada. Deixe a lista pública no AniList e tente de novo.",
  rate_limited: "O AniList pediu para esperar um pouco. Tente de novo em um minuto.",
  upstream: "O AniList não respondeu agora. Tente de novo daqui a pouco.",
};

const STATUS: Record<ImportError, number> = {
  invalid: 400,
  not_found: 404,
  private: 403,
  rate_limited: 429,
  upstream: 502,
};

function fail(code: ImportError) {
  return NextResponse.json({ error: code, message: MESSAGES[code] }, { status: STATUS[code] });
}

export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user")?.trim() ?? "";
  if (!USER_RE.test(user)) return fail("invalid");

  let res: Response;
  try {
    // ANILIST_URL só existe para testes locais com um servidor simulado
    res = await fetch(process.env.ANILIST_URL ?? ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { userName: user } }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return fail("upstream");
  }

  let body: AniListResponse;
  try {
    body = (await res.json()) as AniListResponse;
  } catch {
    return fail("upstream");
  }

  const err = classifyError(body, res.status);
  if (err) return fail(err);

  const imported = mapAniList(body);
  return NextResponse.json(imported);
}
