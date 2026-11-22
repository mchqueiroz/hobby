/**
 * Limite de requisições por IP, em memória (janela deslizante).
 * Protege as chaves de TMDB/IGDB e a cota do AniList de quem resolver martelar nossas rotas /api.
 *
 * Limite honesto: em hospedagem serverless cada instância tem sua própria memória, então o teto real é
 * "por instância". Serve contra abuso casual; para abuso sério o certo é um limite no provedor (ex.: WAF da Vercel).
 */
export interface Rule {
  limit: number;
  windowMs: number;
}

const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function check(key: string, rule: Rule, now = Date.now()): { ok: boolean; retryAfter: number } {
  const from = now - rule.windowMs;
  const list = (hits.get(key) ?? []).filter((t) => t > from);
  if (list.length >= rule.limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((list[0] + rule.windowMs - now) / 1000)) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > MAX_KEYS) prune(now, rule.windowMs);
  return { ok: true, retryAfter: 0 };
}

function prune(now: number, windowMs: number) {
  for (const [k, v] of hits) if (!v.length || v[v.length - 1] <= now - windowMs) hits.delete(k);
  // ainda cheio (muitos IPs ativos): descarta os mais antigos para a memória não crescer sem limite
  if (hits.size > MAX_KEYS) for (const k of [...hits.keys()].slice(0, hits.size - MAX_KEYS)) hits.delete(k);
}

export function resetRateLimit() {
  hits.clear();
}

/** Regras por rota. Importar é caro (muitas chamadas ao AniList), por isso o teto é bem menor. */
export const RULES = {
  default: { limit: Number(process.env.API_RATE_LIMIT) || 150, windowMs: 60_000 } as Rule,
  import: { limit: 10, windowMs: 60_000 } as Rule,
  // relato de erros: o navegador manda poucos por sessão; teto baixo impede que alguém encha o log
  erro: { limit: 10, windowMs: 60_000 } as Rule,
};

export function ruleFor(pathname: string): { name: keyof typeof RULES; rule: Rule } {
  if (pathname.startsWith("/api/erro")) return { name: "erro", rule: RULES.erro };
  return pathname.startsWith("/api/import") || pathname.startsWith("/api/anilist")
    ? { name: "import", rule: RULES.import }
    : { name: "default", rule: RULES.default };
}

/** IP do cliente. Atrás da Vercel/proxy o primeiro item do x-forwarded-for é o do visitante. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  return (xff?.split(",")[0].trim() || headers.get("x-real-ip") || "local").slice(0, 64);
}
