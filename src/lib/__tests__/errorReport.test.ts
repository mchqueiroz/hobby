import { describe, expect, it } from "vitest";
import { buildPayload } from "../errorReport";

describe("relato de erros", () => {
  it("corta mensagem e pilha, e tira a query do caminho", () => {
    const e = new Error("x".repeat(500));
    e.stack = Array.from({ length: 30 }, (_, i) => `at f${i} (app.js:1:1)`).join("\n");
    const p = buildPayload(e, "tela", "/item/abc?token=segredo#x")!;
    expect(p.message).toHaveLength(300);
    expect(p.stack!.split("\n").length).toBeLessThanOrEqual(8);
    expect(p.path).toBe("/item/abc");
  });
  it("ignora ruído do navegador e de extensões", () => {
    expect(buildPayload(new Error("ResizeObserver loop completed with undelivered notifications."), "window")).toBeNull();
    expect(buildPayload("Script error.", "window")).toBeNull();
  });
  it("aceita o que não é Error e leva o digest do Next", () => {
    expect(buildPayload("deu ruim", "promise")!.message).toBe("deu ruim");
    expect(buildPayload(Object.assign(new Error("a"), { digest: "123" }), "tela")!.digest).toBe("123");
  });
});
