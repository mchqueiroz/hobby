import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR").new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    ent = lambda: json.loads(pg.evaluate("localStorage.getItem('hobby:v1')"))["entries"]

    # caminho curto continua em 2 toques, sem resenha
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "hades")
    pg.click('[role=dialog] button.result')
    check("resenha começa recolhida (o registro rápido não muda)", pg.locator("#resenha-registro").count() == 0 and pg.get_by_role("button", name="+ Escrever resenha").count() == 1)
    pg.click('[role=dialog] button[aria-label="Nota 4"]'); pg.wait_for_selector(".toast")
    check("registro rápido sem resenha", ent()["seed:jogo:hades"]["rating"] == 4 and not ent()["seed:jogo:hades"].get("review"))

    # com resenha: escreve, toca na nota e tudo é salvo junto
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "stardew")
    pg.click('[role=dialog] button.result')
    pg.get_by_role("button", name="+ Escrever resenha").click()
    pg.fill("#resenha-registro", "Relaxante demais, joguei a madrugada toda.")
    check("aviso de privacidade aparece junto do campo", "Comunidade" in pg.locator("[role=dialog]").inner_text())
    pg.click('[role=dialog] button[aria-label="Nota 4,5"]'); pg.wait_for_selector(".toast")
    e = ent()["seed:jogo:stardew-valley"]
    check("nota e resenha salvas juntas", e["rating"] == 4.5 and e["review"].startswith("Relaxante demais"), str(e))

    # aparece na página da obra e a visibilidade está explicada
    pg.goto(BASE + "/item/seed%3Ajogo%3Astardew-valley"); pg.wait_for_selector("#resenha")
    check("a resenha está no editor da obra", pg.input_value("#resenha").startswith("Relaxante demais"))
    check("diz que só você vê (perfil não público)", "Só você vê" in pg.get_by_test_id("visibilidade-resenha").inner_text())

    # refazer o registro sem escrever nada mantém a resenha
    pg.click('button[aria-label="Registrar um item"]') if pg.locator('button[aria-label="Registrar um item"]').count() else None
    pg.goto(BASE + "/biblioteca"); pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "stardew"); pg.click('[role=dialog] button.result')
    check("ao registrar de novo a resenha vem preenchida", pg.input_value("#resenha-registro").startswith("Relaxante demais"))
    pg.click('[role=dialog] button[aria-label="Nota 3"]'); pg.wait_for_selector(".toast")
    check("e continua salva", ent()["seed:jogo:stardew-valley"]["review"].startswith("Relaxante demais") and ent()["seed:jogo:stardew-valley"]["rating"] == 3)

    # desfazer volta a nota anterior
    pg.click(".toast button") if pg.locator(".toast button").count() else None
    pg.wait_for_timeout(300)
    check("desfazer restaura a nota anterior", ent()["seed:jogo:stardew-valley"]["rating"] == 4.5, str(ent()["seed:jogo:stardew-valley"]))
    check("sem erros de página", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
