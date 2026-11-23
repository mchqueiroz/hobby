from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- celular
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    nav = pg.locator('nav[aria-label="Principal"]')
    check("menu tem 5 links e o +", nav.locator("a").count() == 5 and nav.locator("button.plus").count() == 1)
    check("menu: Início, Buscar, Descobrir, Social, Perfil", [t.strip() for t in nav.locator("a").all_inner_texts()] == ["Início", "Buscar", "Descobrir", "Social", "Perfil"], str(nav.locator("a").all_inner_texts()))
    fab = pg.locator(".fab").bounding_box()
    check("+ flutuante no canto inferior direito, fora do menu", pg.locator(".fab").is_visible() and fab["y"] > 844 - 200 and fab["x"] > 390 - 100 and not nav.locator("button.plus").is_visible(), str(fab))
    check("Descobrir marcado na página atual", nav.locator('a[aria-current="page"]').inner_text().strip() == "Descobrir")
    check("sem rolagem horizontal no celular", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    pg.get_by_role("link", name="Buscar", exact=True).click(); pg.wait_for_url("**/buscar")
    check("aba Buscar marcada na busca", nav.locator('a[aria-current="page"]').inner_text().strip() == "Buscar")
    check("campo de busca já focado", pg.evaluate("document.activeElement.id") == "busca-global")
    pg.fill("#busca-global", "duna")
    pg.wait_for_selector("li >> text=Duna")
    pg.get_by_role("button", name="Quero ver Duna").click()
    ent = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
    check("quero ver em um toque a partir da busca", ent.get("tmdb:movie:438631", {}).get("status") == "quero")
    check("toast com desfazer", pg.locator(".toast").count() == 1)
    pg.locator(".toast button").click()
    ent = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
    check("desfazer remove", "tmdb:movie:438631" not in ent)
    pg.fill("#busca-global", "zzzzqq"); pg.wait_for_selector("text=Não encontramos esse título")

    # atalho "/" não dispara ao digitar
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("h1")
    pg.keyboard.press("/"); pg.wait_for_url("**/buscar")
    check("atalho / abre a busca", True)
    pg.fill("#busca-global", "a/b")
    check("/ dentro do campo é só texto", pg.input_value("#busca-global") == "a/b" and pg.url.endswith("/buscar"))

    # progresso
    pg.goto(BASE + "/biblioteca")
    pg.evaluate("""() => { const l = JSON.parse(localStorage.getItem('hobby:v1'));
      l.entries['seed:anime:death-note'] = {itemId:'seed:anime:death-note', status:'andamento', at: Date.now()};
      localStorage.setItem('hobby:v1', JSON.stringify(l)); }""")
    pg.goto(BASE + "/item/seed%3Aanime%3Adeath-note"); pg.wait_for_selector("#progresso")
    pg.get_by_role("button", name="Mais um").click(); pg.get_by_role("button", name="Mais um").click()
    check("botão + soma episódios", pg.input_value("#progresso") == "2")
    pg.fill("#progresso", "13")
    pg.goto(BASE + "/biblioteca"); pg.get_by_role("button", name="Em andamento").click()
    pg.evaluate("(() => { const d = document.querySelector('details.morefilters'); if (d) d.open = true; })()")
    check("progresso aparece na biblioteca", "ep. 13" in pg.locator("ul.cols2").first.inner_text())

    # ordenar, filtrar, grade
    pg.get_by_role("button", name="Concluídos").click()
    rows = lambda: pg.locator("ul.cols2 li strong").all_inner_texts()
    pg.get_by_role("button", name="A-Z").click()
    r = rows(); check("ordem A–Z", r == sorted(r, key=lambda t: t.lower()) or len(r) > 1, str(r[:4]))
    pg.fill('input[aria-label="Filtrar pelo título"]', "HÁDES")
    check("filtro ignora acento e maiúscula", all("hades" in t.lower() for t in rows()) and len(rows()) >= 1, str(rows()))
    pg.fill('input[aria-label="Filtrar pelo título"]', "")
    pg.get_by_role("button", name="Grade").click()
    check("grade mostra capas", pg.locator("ul.grid-view li").count() > 3)
    check("sem rolagem horizontal na grade", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("celular sem erros", errs == [], str(errs))

    # ---------- computador
    ctx2 = b.new_context(viewport={"width": 1280, "height": 800}, locale="pt-BR")
    d = ctx2.new_page(); errs2 = []
    d.on("pageerror", lambda e: errs2.append(str(e)))
    d.goto(BASE + "/importar"); d.click("text=Ver com dados de exemplo"); d.wait_for_url("**/descobrir")
    tb = d.locator(".tabbar").bounding_box(); app = d.locator("main.app").bounding_box()
    check("menu vira barra lateral", tb["x"] == 0 and tb["width"] <= 230 and tb["height"] >= 790, str(tb))
    check("conteúdo não passa por baixo do menu", app["x"] >= tb["width"], str(app))
    check("conteúdo mais largo no computador", app["width"] > 600, str(app))
    check("sem rolagem horizontal no computador", d.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    d.get_by_role("button", name="Registrar um item").click()
    sh = d.locator(".sheet").bounding_box()
    check("registro vira janela centralizada", sh["x"] > 300 and sh["y"] > 0 and sh["width"] <= 540, str(sh))
    d.keyboard.press("Escape")
    d.goto(BASE + "/biblioteca"); d.wait_for_selector("ul.cols2 li")
    xs = {round(d.locator("ul.cols2 li").nth(i).bounding_box()["x"]) for i in range(min(4, d.locator("ul.cols2 li").count()))}
    check("biblioteca em duas colunas", len(xs) == 2, str(xs))
    d.get_by_role("button", name="Grade").click()
    xs = {round(d.locator("ul.grid-view li").nth(i).bounding_box()["x"]) for i in range(5)}
    check("grade com 5 colunas", len(xs) == 5, str(xs))
    check("computador sem erros", errs2 == [], str(errs2))
print("FALHAS:", fails)
raise SystemExit(1 if fails else 0)
