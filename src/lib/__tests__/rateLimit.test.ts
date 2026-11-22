import { beforeEach, describe, expect, it } from "vitest";
import { check, clientIp, resetRateLimit, ruleFor } from "../rateLimit";

const rule = { limit: 3, windowMs: 1000 };
beforeEach(resetRateLimit);

describe("rateLimit", () => {
  it("deixa passar até o limite e bloqueia o resto com Retry-After", () => {
    expect([1, 2, 3].map((i) => check("a", rule, 1000 + i).ok)).toEqual([true, true, true]);
    const r = check("a", rule, 1500);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThanOrEqual(1);
  });
  it("a janela desliza: depois do tempo volta a liberar", () => {
    for (let i = 0; i < 3; i++) check("a", rule, 1000);
    expect(check("a", rule, 1500).ok).toBe(false);
    expect(check("a", rule, 2100).ok).toBe(true);
  });
  it("cada IP tem a sua conta", () => {
    for (let i = 0; i < 3; i++) check("a", rule, 1000);
    expect(check("a", rule, 1001).ok).toBe(false);
    expect(check("b", rule, 1001).ok).toBe(true);
  });
  it("usa o primeiro IP do x-forwarded-for e tem valor padrão", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("local");
  });
  it("o relato de erros tem teto próprio e baixo", () => {
    expect(ruleFor("/api/erro").name).toBe("erro");
    expect(ruleFor("/api/erro").rule.limit).toBeLessThan(ruleFor("/api/search").rule.limit);
  });
  it("importação tem teto menor que o resto", () => {
    expect(ruleFor("/api/import/mal").rule.limit).toBeLessThan(ruleFor("/api/search").rule.limit);
    expect(ruleFor("/api/anilist").name).toBe("import");
  });
});
