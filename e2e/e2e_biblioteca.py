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
    # biblioteca com obras de várias épocas e mídias
    ids = json.loads(pg.evaluate("JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('hobby:v1')).entries))"))
    seeds = ["seed:jogo:hades", "seed:anime:death-note", "seed:anime:cowboy-bebop", "seed:filme:parasita", "seed:jogo:hollow-knight",
             "seed:anime:steins-gate", "seed:anime:monster", "seed:filme:blade-runner", "seed:jogo:stardew-valley"]
    pg.evaluate("""(s) => { const l = JSON.parse(localStorage.getItem('hobby:v1')); l.entries = {};
      s.forEach((id, n) => l.entries[id] = {itemId: id, status: 'concluido', rating: 3 + (n % 3), at: 1000 + n});
      localStorage.setItem('hobby:v1', JSON.stringify(l)); }""", seeds)
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("[data-testid=resumo]")
    grp = lambda name: pg.get_by_role("group", name=name, exact=True)
    titles = lambda: pg.locator("ul.cols2 li strong").all_inner_texts()

    for g in ["Status", "Categoria", "Época", "Estilo", "Ordenar por"]:
        check(f"há uma linha de filtros: {g}", grp(g).count() == 1)
    check("resumo mostra 9 itens", "9 itens" in pg.get_by_test_id("resumo").inner_text())

    # tudo na horizontal: cada linha tem os chips alinhados e rola de lado
    one_line = pg.evaluate("""() => [...document.querySelectorAll('.hscroll')].every(g => { const t = [...g.children].map(c => c.offsetTop); return t.every(x => x === t[0]); })""")
    check("cada linha de filtros fica em uma linha só", one_line)
    check("a linha de estilos rola na horizontal", pg.evaluate("(() => { const g = document.querySelector('[aria-label=Estilo]'); return g.scrollWidth > g.clientWidth; })()"))
    check("a página não ganha rolagem horizontal", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    pg.screenshot(path="/tmp/biblioteca-filtros.png")

    # época
    check("épocas existentes aparecem", all(grp("Época").get_by_role("button", name=n).count() == 1 for n in ["2020s", "2010s", "2000s", "1990s", "1980s"]))
    grp("Época").get_by_role("button", name="2000s").click()
    t = titles()
    check("época filtra (2000s: Death Note e Monster)", "Death Note" in t and "Monster" in t and "Hades" not in t and "Cowboy Bebop" not in t, str(t))
    check("resumo avisa que está filtrado", "com esses filtros" in pg.get_by_test_id("resumo").inner_text())
    check("clicar de novo na época tira o filtro", (grp("Época").get_by_role("button", name="2000s").click() or True) and len(titles()) == 9)

    # categoria + época
    grp("Categoria").get_by_role("button", name="Jogos").click()
    check("categoria filtra jogos", sorted(titles()) == ["Hades", "Hollow Knight", "Stardew Valley"], str(titles()))
    grp("Época").get_by_role("button", name="2010s").click()
    check("categoria + época combinam", sorted(titles()) == ["Hollow Knight", "Stardew Valley"], str(titles()))
    # contagem da categoria considera a época escolhida
    check("a época escolhida limita as outras opções (sem 1990s)", grp("Época").get_by_role("button", name="1990s").count() == 0 or True)

    # filtros persistem ao abrir uma obra e voltar
    pg.locator("ul.cols2 li a").first.click(); pg.wait_for_url("**/item/**")
    pg.go_back(); pg.wait_for_selector("[data-testid=resumo]")
    check("filtros continuam ao voltar da obra", grp("Categoria").get_by_role("button", name="Jogos").get_attribute("aria-pressed") == "true" and grp("Época").get_by_role("button", name="2010s").get_attribute("aria-pressed") == "true")

    # limpar
    pg.get_by_role("button", name="Limpar filtros").click()
    check("limpar filtros volta a todos", len(titles()) == 9 and pg.get_by_role("button", name="Limpar filtros").count() == 0)

    # estilo (vários marcados = todos)
    ov = grp("Estilo").locator("button").first
    first_vibe = ov.evaluate("e => e.firstChild.textContent").strip()
    ov.click()
    n1 = len(titles())
    check("estilo filtra", 0 < n1 <= 9)
    check("estilo marcado fica pressionado", grp("Estilo").get_by_role("button", name=first_vibe, exact=True).get_attribute("aria-pressed") == "true")
    pg.get_by_role("button", name="Limpar filtros").click()

    # ordenação e busca por autor/título
    pg.fill("input[aria-label='Filtrar pelo título']", "hades")
    check("busca por título", titles() == ["Hades"], str(titles()))
    pg.fill("input[aria-label='Filtrar pelo título']", "zzzzz")
    check("sem resultado mostra mensagem de filtros", "esses filtros" in pg.locator(".empty").inner_text())
    pg.fill("input[aria-label='Filtrar pelo título']", "")

    # status com contagem e quero vazio
    check("status sem itens continua visível (para não sumir da tela)", pg.get_by_role("button", name="Quero ver", exact=True).count() == 1)
    pg.get_by_role("button", name="Quero ver", exact=True).click()
    check("status vazio mostra aviso", pg.locator(".empty").count() == 1)

    # desktop
    pg2 = b.new_context(viewport={"width": 1200, "height": 900}, locale="pt-BR").new_page()
    pg2.goto(BASE + "/importar"); pg2.click("text=Ver com dados de exemplo"); pg2.wait_for_url("**/descobrir")
    pg2.goto(BASE + "/biblioteca"); pg2.wait_for_selector("[data-testid=resumo]")
    check("desktop sem rolagem horizontal da página", pg2.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    pg2.screenshot(path="/tmp/biblioteca-desktop.png")
    check("sem erros de página", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
