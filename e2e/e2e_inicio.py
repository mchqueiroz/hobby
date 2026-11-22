from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

LIB = "() => JSON.parse(localStorage.getItem('hobby:v1')).entries"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)

    # biblioteca vazia vai para a importação; com dados, a raiz vai para o Início
    pg.goto(BASE + "/"); pg.wait_for_selector("[data-testid=cta-comecar]")
    check("visitante novo vê a apresentação", "Todos os seus hobbies em um perfil" in pg.locator("h1").inner_text())
    check("apresentação sem menu inferior", pg.locator('nav[aria-label="Principal"]').count() == 0)
    check("links de privacidade e termos", pg.get_by_role("link", name="Privacidade").count() >= 1 and pg.get_by_role("link", name="Termos de uso").count() >= 1)
    pg.goto(BASE + "/inicio"); pg.wait_for_selector("[data-testid=boas-vindas]")
    check("Início vazio mostra boas-vindas", pg.get_by_role("button", name="Registrar o primeiro item").count() == 1)
    pg.goto(BASE + "/privacidade"); pg.wait_for_selector("h1")
    check("página de privacidade", "LGPD" in pg.locator("main").inner_text() or "LGPD" in pg.locator("body").inner_text())
    pg.goto(BASE + "/termos"); pg.wait_for_selector("h1")
    check("página de termos", "moderação" in pg.locator("body").inner_text().lower())
    pg.goto(BASE + "/"); pg.get_by_test_id("cta-demo").click(); pg.wait_for_url("**/inicio")
    pg.wait_for_selector("[data-testid=meta]")
    pg.goto(BASE + "/"); pg.wait_for_url("**/inicio")
    check("quem já tem registros vai direto ao Início", True)
    robots = pg.request.get(BASE + "/robots.txt").text()
    check("robots e sitemap", "Sitemap:" in robots and "/api/" in robots and pg.request.get(BASE + "/sitemap.xml").ok)
    check("imagem de compartilhamento existe", pg.request.get(BASE + "/og.png").ok)
    check("metatag de compartilhamento", 'property="og:image"' in pg.request.get(BASE + "/").text())
    pg.wait_for_selector("[data-testid=meta]")
    check("saudação é o título", pg.locator("h1").inner_text() in ("Bom dia", "Boa tarde", "Boa noite", "Boa madrugada"))
    check("meta do ano aparece", "de" in pg.locator("[data-testid=meta]").inner_text())
    check("sugestão rápida aparece", pg.locator("[data-testid=sugestao]").count() == 1)
    check("sem rolagem horizontal", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    # coloca duas obras em andamento: uma com total, outra sem
    pg.evaluate("""() => { const l = JSON.parse(localStorage.getItem('hobby:v1')); const now = Date.now();
      l.entries['seed:anime:death-note'] = {itemId:'seed:anime:death-note', status:'andamento', at: now, progress: 36, total: 37};
      l.entries['seed:anime:cowboy-bebop'] = {itemId:'seed:anime:cowboy-bebop', status:'andamento', at: now - 1000};
      localStorage.setItem('hobby:v1', JSON.stringify(l)); }""")
    pg.reload(); pg.wait_for_selector("[data-testid=continuar]")
    check("as duas obras estão em 'Continuar'", pg.locator("[data-testid=continuar] li").count() >= 2)
    dn = pg.locator("[data-testid=continuar] li", has_text="Death Note"); cb = pg.locator("[data-testid=continuar] li", has_text="Cowboy Bebop")
    check("barra de progresso só na obra com total", dn.locator("[role=progressbar]").count() == 1 and cb.locator("[role=progressbar]").count() == 0)
    bar = dn.locator("[role=progressbar]")
    check("barra com valores certos", bar.get_attribute("aria-valuenow") == "36" and bar.get_attribute("aria-valuemax") == "37")

    # +1 na obra sem total soma e mostra toast
    cb.get_by_role("button", name="+1").click()
    e = pg.evaluate(LIB)
    check("+1 soma sem total", e["seed:anime:cowboy-bebop"].get("progress") == 1 and e["seed:anime:cowboy-bebop"]["status"] == "andamento")

    # +1 na que está em 36/37 conclui
    dn.get_by_role("button", name="+1").click()
    e = pg.evaluate(LIB)
    check("chegar no total conclui", e["seed:anime:death-note"]["status"] == "concluido" and e["seed:anime:death-note"].get("progress") == 37)
    check("conclusão ganha data", (e["seed:anime:death-note"].get("date") or 0) > 0)
    check("toast de conclusão", "concluído" in pg.locator(".toast").inner_text().lower())
    pg.locator(".toast button").click()
    e = pg.evaluate(LIB)
    check("desfazer reabre a obra", e["seed:anime:death-note"]["status"] == "andamento" and e["seed:anime:death-note"].get("progress") == 36)
    check("sequência de dias aparece", pg.locator("[data-testid=sequencia]").count() == 1)

    # Rever na página da obra
    pg.evaluate("""() => { const l = JSON.parse(localStorage.getItem('hobby:v1'));
      l.entries['seed:anime:death-note'].status = 'concluido'; localStorage.setItem('hobby:v1', JSON.stringify(l)); }""")
    pg.goto(BASE + "/item/seed%3Aanime%3Adeath-note"); pg.wait_for_selector("[data-testid=rever]")
    check("primeira vez", pg.locator("[data-testid=vezes]").inner_text() == "Primeira vez")
    pg.locator("[data-testid=rever]").click()
    check("rever soma uma vez", "2 vezes" in pg.locator("[data-testid=vezes]").inner_text())
    check("rever grava no registro", pg.evaluate(LIB)["seed:anime:death-note"].get("rounds") == 2)
    pg.locator(".toast button").click()
    check("desfazer o rever", pg.evaluate(LIB)["seed:anime:death-note"].get("rounds") in (None, 1))

    # total pelo editor
    pg.evaluate("""() => { const l = JSON.parse(localStorage.getItem('hobby:v1'));
      l.entries['seed:anime:death-note'].status = 'andamento'; l.entries['seed:anime:death-note'].progress = 5; delete l.entries['seed:anime:death-note'].total;
      localStorage.setItem('hobby:v1', JSON.stringify(l)); }""")
    pg.reload(); pg.wait_for_selector("#total")
    pg.fill("#total", "10")
    check("total salvo", pg.evaluate(LIB)["seed:anime:death-note"].get("total") == 10)
    check("barra no editor", pg.locator("[role=progressbar]").count() == 1)

    # conquistas no perfil e barra na biblioteca
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("[data-testid=conquistas]")
    check("9 conquistas listadas", pg.locator("[data-testid=conquistas] li").count() == 9)
    check("conquista 'Primeiro passo' concluída com os dados de exemplo", pg.locator("[data-testid=conquistas] li[data-done=true]", has_text="Primeiro passo").count() == 1)
    pg.goto(BASE + "/biblioteca"); pg.get_by_role("button", name="Em andamento").click()
    check("barra de progresso na biblioteca", pg.locator("ul [role=progressbar]").count() >= 1)

    pg.goto(BASE + "/estatisticas"); pg.wait_for_selector("[data-testid=heatmap]")
    check("mapa de atividade com 20 colunas", pg.locator("[data-testid=heatmap] .heat > div").count() == 20)
    check("mapa tem dias com registro", pg.locator("[data-testid=heatmap] i.l1, [data-testid=heatmap] i.l2, [data-testid=heatmap] i.l3").count() >= 1)
    pg.goto(BASE + "/inicio"); pg.wait_for_selector("[data-testid=semana]")
    check("resumo dos 7 dias", "Nos últimos 7 dias" in pg.locator("[data-testid=semana]").inner_text())

    # lupa do cabeçalho
    pg.goto(BASE + "/inicio"); pg.get_by_role("link", name="Buscar", exact=True).click(); pg.wait_for_url("**/buscar")
    check("lupa leva à busca", True)
    check("sem erros", errs == [], str(errs))
print("FALHAS:", fails)
raise SystemExit(1 if fails else 0)
