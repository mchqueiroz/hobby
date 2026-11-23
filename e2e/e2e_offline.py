import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1")
    pg.evaluate("navigator.serviceWorker.ready.then(() => 1)")
    pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=8000)
    check("service worker ativo e controlando a página", True)
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")  # visita para entrar no cache
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1"); pg.wait_for_timeout(500)
    total = pg.locator("ul.cols2 li").count()
    check("biblioteca tem itens online", total >= 10, str(total))

    ctx.set_offline(True)
    pg.reload(); pg.wait_for_selector("h1", timeout=8000)
    check("biblioteca (no perfil) abre sem internet", pg.locator("h1").first.inner_text().strip().lower() == "perfil")
    check("os registros continuam lá offline", pg.locator("ul.cols2 li").count() == total)
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero", timeout=8000)
    check("outra tela já visitada também abre offline", pg.locator("section.hero").count() == 1)
    pg.goto(BASE + "/estatisticas")
    pg.wait_for_selector("text=sem conexão", timeout=8000)
    check("tela nunca visitada mostra a página offline explicativa", "Seus registros continuam guardados" in pg.locator("body").inner_text())
    # registrar offline funciona (tudo é local)
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1")
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "hades")
    pg.click('[role=dialog] button.result'); pg.click('[role=dialog] button[aria-label="Nota 5"]'); pg.wait_for_selector(".toast")
    ent = json.loads(pg.evaluate("localStorage.getItem('hobby:v1')"))["entries"]
    check("registrar offline funciona", ent["seed:jogo:hades"]["rating"] == 5)

    ctx.set_offline(False)
    pg.goto(BASE + "/estatisticas"); pg.wait_for_selector("h1")
    check("volta ao normal quando a internet volta", pg.locator("h1").first.inner_text().strip().lower().startswith("estat"))
    sw = pg.request.get(BASE + "/sw.js")
    check("sw.js nunca fica em cache do navegador", "no-store" in sw.headers.get("cache-control", ""))
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
