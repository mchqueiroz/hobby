from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def item(pg, id_):
    pg.goto(BASE + "/item/" + id_.replace(":", "%3A"))
    pg.wait_for_selector('section[aria-label="Sobre a obra"]:not([aria-busy])', timeout=8000)
    return pg.locator('section[aria-label="Sobre a obra"]').inner_text()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")

    # Detalhes: filme (TMDB), jogo (IGDB), anime (AniList)
    # item de API precisa estar no cache local: abre pela busca de um item remoto já salvo
    pg.evaluate("""() => { const l = JSON.parse(localStorage.getItem('hobby:v1')); 
      l.items['tmdb:movie:438631'] = {id:'tmdb:movie:438631', title:'Duna', media:'filme', year:2021, vibes:['ficção científica','aventura'], source:'tmdb'};
      localStorage.setItem('hobby:v1', JSON.stringify(l)); }""")
    t = item(pg, "tmdb:movie:438631")
    check("filme: sinopse", "herdeiro viaja ao planeta" in t, t)
    check("filme: elenco e direção", "Zendaya" in t and "Denis Villeneuve" in t, t)
    check("filme: streaming no Brasil", "Max" in t)
    check("filme: duração e gêneros", "2h 35min" in t, t)
    check("filme: link do trailer seguro", pg.locator('a:has-text("Ver trailer")').get_attribute("href") == "https://www.youtube.com/watch?v=duneTrailer1"
          and pg.locator('a:has-text("Ver trailer")').get_attribute("rel") == "noopener noreferrer")
    t = item(pg, "seed:jogo:hades")
    check("jogo: sinopse e estúdio", "Fuja do submundo" in t and "Supergiant Games" in t, t)
    check("jogo: parecidos", "Dead Cells" in t)
    t = item(pg, "seed:anime:death-note")
    check("anime: sinopse com quebra de linha", "Um estudante acha um caderno." in t and "Madhouse" in t, t)
    check("anime: nota 8,5", "8,5 de 10" in t, t)
    # obra sem dados na fonte
    t = item(pg, "seed:jogo:hollow-knight")
    check("sem retorno da fonte, aviso discreto", "Não encontramos detalhes" in t, t)

    # O que ver hoje
    pg.goto(BASE + "/descobrir"); pg.wait_for_selector("#tonight-t")
    sec = pg.locator('section[aria-labelledby="tonight-t"]')
    sec.get_by_role("button", name="Sortear", exact=True).click()
    pg.wait_for_selector('section[aria-labelledby="tonight-t"] [aria-live=polite]')
    first = sec.locator("[aria-live=polite] a").first.inner_text()
    check("sorteio devolve uma obra", len(first) > 0)
    check("sorteio mostra motivo e outras opções", "Também combinam" in sec.inner_text())
    # filtro de mídia respeitado
    sec.get_by_role("button", name="Jogo", exact=True).click()
    for _ in range(6):
        sec.get_by_role("button", name="Sortear").click()
        pg.wait_for_timeout(100)
        check("filtro Jogo só devolve jogo", "Jogo" in sec.locator("[aria-live=polite]").inner_text())
    # aceitar vira "quero ver"
    name = sec.locator("[aria-live=polite] a").first.inner_text()
    sec.get_by_role("button", name="Quero ver").click()
    st = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
    check("aceitar grava como quero ver", any(e["status"] == "quero" for e in st.values()))
    # da minha lista: só itens de quero ver
    sec.get_by_role("button", name="Da minha lista").click()
    sec.get_by_role("button", name="Sortear").click()
    pg.wait_for_timeout(200)
    txt = sec.inner_text()
    check("da minha lista responde (item ou aviso)", "Vou começar agora" in txt or "Nada na sua lista" in txt, txt)
    if "Vou começar agora" in txt:
        sec.get_by_role("button", name="Vou começar agora").click()
        st = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
        check("começar vira em andamento", any(e["status"] == "andamento" for e in st.values()))
    check("sem erros no console", errs == [], str(errs))
print("FALHAS:", fails)
raise SystemExit(1 if fails else 0)
