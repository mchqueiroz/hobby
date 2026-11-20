import json, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))
def api(path): return json.load(urllib.request.urlopen(BASE + path))

# detalhes e capa pelas rotas
d = api("/api/details?id=" + urllib.request.quote("openlibrary:OL777W") + "&title=Arrakis%20Mock&media=livro")["details"]
check("livro: sinopse sem a cauda de links", d and d["synopsis"] == "Um duque muda de planeta.", str(d))
check("livro: assuntos viram fatos, sem 'Accessible book'", d and d["facts"] == ["Science fiction", "Adventure"], str(d))
c = api("/api/cover?title=Arrakis%20Mock&media=livro")
check("capa de livro vem do Open Library", c["url"] and "covers.openlibrary.org" in c["url"], str(c))
dm = api("/api/details?id=" + urllib.request.quote("anilist:manga:888001") + "&title=Pluto&media=manga")["details"]
check("mangá: detalhes pelo AniList", dm and dm["synopsis"], str(dm))
try:
    urllib.request.urlopen(BASE + "/api/cover?title=x&media=podcast"); check("mídia inválida recusada", False)
except urllib.error.HTTPError as e:
    check("mídia inválida recusada (400)", e.code == 400)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")

    # filtros de mídia
    check("Descobrir tem filtro de mangás e livros", pg.locator("button.chip", has_text="Mangás").count() == 1 and pg.locator("button.chip", has_text="Livros").count() == 1)
    pg.locator("button.chip", has_text="Livros").click()
    pg.wait_for_timeout(300)
    tags = [t for t in pg.locator("main .tag").all_inner_texts() if t != "Brasil"]
    check("filtro de livros: há sugestões e só de livros", len(tags) > 0 and set(tags) == {"Livro"}, str(tags))

    # busca traz mangá e livro e dá para registrar
    pg.goto(BASE + "/buscar"); pg.wait_for_selector("#busca-global")
    pg.fill("#busca-global", "mock")
    pg.wait_for_selector("li >> text=Arrakis Mock")
    check("busca mostra o mangá", pg.locator("li >> text=Pluto Mock").count() > 0)
    pg.get_by_role("button", name="Quero ver Arrakis Mock").click()
    ent = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
    check("livro entra na biblioteca", ent.get("openlibrary:OL777W", {}).get("status") == "quero", str(list(ent)[-3:]))

    # página do livro: autor e progresso em páginas
    pg.goto(BASE + "/item/" + urllib.request.quote("openlibrary:OL777W", safe=""))
    pg.wait_for_selector("h1")
    check("página do livro mostra o autor", "Frank Mock" in pg.locator("main").inner_text())
    pg.screenshot(path="/tmp/livro.png")

    # catálogo base: mangá e livro aparecem nas sugestões quando o gosto combina
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1")
    pg.get_by_role("button", name="Quero ver", exact=True).click()
    pg.locator("button.chip", has_text="Livros").click()
    check("biblioteca filtra por livros", pg.locator("text=Arrakis Mock").count() > 0)
    check("sem erros de console", not errs, str(errs[:3]))

    # sem rolagem horizontal
    check("sem rolagem horizontal", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    b.close()

print("\nFALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
