import re
import os; os.makedirs("/tmp/hobby-shots", exist_ok=True)
import json, re, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails, passes = [], []
def check(name, cond, extra=""):
    (passes if cond else fails).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="pt-BR")
    pg = ctx.new_page()
    errors, bad = [], []
    # capas do mock apontam para CDNs reais com arquivos inventados: 404/CORS delas não é falha do app
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and not m.text.startswith("Failed to load resource") and not m.text.startswith("Access to image at") else None)
    pg.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 and "/api/anilist" not in r.url and r.url.startswith(("http://localhost", "http://127.0.0.1")) else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))

    # 1. entrada vazia mostra a apresentação, e o botão leva para importar
    pg.goto(BASE + "/"); pg.wait_for_selector("[data-testid=cta-comecar]", timeout=8000)
    pg.click("[data-testid=cta-comecar]"); pg.wait_for_url("**/importar", timeout=8000)
    check("home vazia mostra apresentação e 'Começar' leva a /importar", pg.url.endswith("/importar"))

    # 2. erros da importação
    for user, expected in [("ghost", "Não encontramos"), ("privado", "privada")]:
        pg.fill("#user", user); pg.click("text=Importar anime")
        pg.wait_for_selector("#erro", timeout=8000)
        check(f"importação '{user}' mostra erro claro", expected in pg.inner_text("#erro"), pg.inner_text("#erro"))
    check("botão desabilita com nome inválido", (pg.fill("#user", "a/b") or True) and pg.is_disabled("text=Importar anime"))

    # 3. importação com sucesso
    pg.fill("#user", "mockuser"); pg.click("text=Importar anime")
    pg.wait_for_selector("text=Importação concluída", timeout=8000)
    txt = pg.inner_text("section[aria-live=polite]")
    check("importa 11 animes (duplicata de lista personalizada contada uma vez)", "11" in txt and "animes" in txt, txt)
    flat = re.sub(r"\s+", " ", txt)
    check("resumo por status correto (8 concluídos, 1 andamento, 1 quero ver, 1 abandonado)", "8 concluídos · 1 em andamento · 1 quero ver · 1 abandonado" in flat, flat)
    check("avisa item sem vibes", "1 título não trouxe gêneros" in txt, txt)
    pg.screenshot(path="/tmp/hobby-shots/01_importar.png")

    # 4. favoritos
    pg.click("text=Escolher favoritos de jogos e filmes"); pg.wait_for_url("**/favoritos")
    cont = pg.locator("button.btn", has_text="Continuar")
    check("continuar desabilitado sem favoritos", cont.is_disabled())
    for t in ["Hades, Jogo", "Hollow Knight, Jogo", "Cidade de Deus, Filme ou série", "Blade Runner, Filme ou série", "Disco Elysium, Jogo", "The Last of Us, Jogo"]:
        pg.click(f'button[aria-label="{t}"]')
    pressed = pg.locator('button[aria-pressed="true"]').count()
    check("limite de 5 favoritos respeitado", pressed == 5, str(pressed))
    check("favoritos já na biblioteca não aparecem de novo", pg.locator('button[aria-label="Death Note, Anime"]').count() == 0)
    pg.screenshot(path="/tmp/hobby-shots/02_favoritos.png")
    pg.click("text=Continuar (5/5)"); pg.wait_for_url("**/descobrir")

    # 5. descobrir
    pg.wait_for_selector("li.card")
    cards = pg.locator("li.card")
    n = cards.count()
    check("mostra 5 sugestões", n == 5, str(n))
    titles = [cards.nth(i).locator("a").first.inner_text() for i in range(n)]
    animes = [cards.nth(i).locator("a").first.inner_text() for i in range(n) if cards.nth(i).locator(".tag.m-anime").count()]
    reasons = [cards.nth(i).locator("p").first.inner_text() for i in range(n)]
    print("   sugestões:", titles)
    for t, r in zip(titles, reasons):
        check(f"motivo presente para {t}", r.startswith("Porque você") and "★" in r or r.startswith("Porque você concluiu"), r)
    check("não sugere o que foi importado (Death Note, Cowboy Bebop)", not any(t in ("Death Note", "Cowboy Bebop", "Monster", "Steins;Gate") for t in animes), str(animes))
    check("não sugere favoritos escolhidos", not any(t in ("Hades", "Hollow Knight", "Disco Elysium") for t in titles), str(titles))
    medias = {cards.nth(i).locator(".tag").first.inner_text() for i in range(n)}
    check("sugestões de mais de uma mídia", len(medias) > 1, str(medias))
    pg.screenshot(path="/tmp/hobby-shots/03_descobrir.png")

    # 6. não é pra mim reordena e some
    first = titles[0]
    cards.nth(0).locator("text=Não é pra mim").click()
    pg.wait_for_timeout(300)
    titles2 = [pg.locator("li.card").nth(i).locator("a").first.inner_text() for i in range(pg.locator("li.card").count())]
    check("'Não é pra mim' remove o item da lista na hora", first not in titles2, str(titles2))
    check("lista continua com 5 sugestões", len(titles2) == 5, str(titles2))
    pg.screenshot(path="/tmp/hobby-shots/04_descobrir_dispensou.png")
    pg.click("text=Desfazer"); pg.wait_for_timeout(300)
    titles3 = [pg.locator("li.card").nth(i).locator("a").first.inner_text() for i in range(pg.locator("li.card").count())]
    check("Desfazer traz o item de volta", first in titles3, str(titles3))

    # 7. 'Quero ver' sai da lista e entra na biblioteca
    pg.locator("li.card").nth(0).get_by_role("button", name=re.compile(r"^Quero (ver|ler|jogar|ouvir)$")).click(); pg.wait_for_selector(".toast")

    # regressão: com o aviso na tela, a folha de registro precisa abrir e fechar (Esc e clique no fundo)
    pg.click('button[aria-label="Registrar um item"]'); pg.wait_for_selector("[role=dialog]")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("com aviso visível, Esc fecha a folha", pg.locator("[role=dialog]").count() == 0)
    pg.click('button[aria-label="Registrar um item"]'); pg.wait_for_selector("[role=dialog]")
    pg.click(".backdrop", position={"x": 5, "y": 5}); pg.wait_for_timeout(300)
    check("com aviso visível, clique no fundo fecha a folha", pg.locator("[role=dialog]").count() == 0)

    # 8. registro rápido: 2 toques
    pg.click('button[aria-label="Registrar um item"]')
    pg.wait_for_selector("[role=dialog]")
    pg.fill("#busca", "stardew")
    pg.click('[role=dialog] button.result')                 # toque 1: escolher o item
    pg.click('[role=dialog] button[aria-label="Nota 4"]')    # toque 2: nota
    pg.wait_for_selector(".toast")
    check("toast confirma o registro com a nota", "Stardew Valley" in pg.inner_text(".toast") and "4★" in pg.inner_text(".toast"), pg.inner_text(".toast"))
    ev = pg.evaluate("JSON.parse(localStorage.getItem('hobby:events')||'[]')")
    save = [e for e in ev if e["type"] == "register_save"][-1]
    check("registro em exatamente 2 toques", save["data"]["taps"] == 2, str(save))
    print("   tempo do registro (inclui digitar e a automação):", save["data"]["ms"], "ms")
    pg.screenshot(path="/tmp/hobby-shots/05_toast.png")
    pg.click(".toast >> text=Desfazer"); pg.wait_for_timeout(200)
    lib = pg.evaluate("JSON.parse(localStorage.getItem('hobby:v1'))")
    check("Desfazer remove o registro", "seed:jogo:stardew-valley" not in lib["entries"])

    # meia estrela
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "stardew")
    pg.click('[role=dialog] button.result'); pg.click('[role=dialog] button[aria-label="Nota 3,5"]'); pg.wait_for_selector(".toast")
    lib = pg.evaluate("JSON.parse(localStorage.getItem('hobby:v1'))")
    check("meia estrela salva 3,5", lib["entries"]["seed:jogo:stardew-valley"]["rating"] == 3.5)
    # busca sem resultado
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "xyzxyz")
    pg.wait_for_selector("text=Não encontramos esse título", timeout=5000)
    check("busca sem resultado mostra aviso", "Não encontramos esse título" in pg.inner_text("[role=dialog]"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Esc fecha a folha", pg.locator("[role=dialog]").count() == 0)

    # 9. biblioteca / item / perfil / métricas
    pg.click("nav >> text=Biblioteca"); pg.wait_for_url("**/biblioteca"); pg.wait_for_selector("ul li")
    rows = pg.locator("ul li").count()
    check("biblioteca abre mostrando tudo, inclusive o que ainda não foi concluído", rows == 18, str(rows))
    pg.get_by_role("button", name="Concluídos").click(); pg.wait_for_timeout(200)
    rows = pg.locator("ul li").count()
    check("filtrar por Concluídos mostra 14 (8 importados + 5 favoritos + 1 registrado)", rows == 14, str(rows))
    pg.screenshot(path="/tmp/hobby-shots/06_biblioteca.png")
    pg.click("text=Quero ver"); pg.wait_for_timeout(200)
    check("aba 'Quero ver' tem Haikyu!! importado + 1 aceito", pg.locator("ul li").count() == 2, str(pg.locator("ul li").count()))
    pg.click("text=Abandonei"); check("abandonados mostra Evangelion", "Neon Genesis Evangelion" in pg.inner_text("ul"))

    pg.click("a:has-text('Neon Genesis')"); pg.wait_for_url("**/item/**")
    check("página do item mostra vibes e o registro", "seu registro" in pg.inner_text("main").lower() and "abandonei" in pg.inner_text("main").lower())
    pg.screenshot(path="/tmp/hobby-shots/07_item.png")

    pg.goto(BASE + "/item/" + "seed%3Ajogo%3Adisco-elysium"); pg.wait_for_selector("h1")
    pg.goto(BASE + "/item/nao-existe"); check("item inexistente mostra estado de erro", pg.locator("text=Item não encontrado").count() == 1)

    pg.click("nav >> text=Perfil"); pg.wait_for_url("**/perfil")
    ptxt = pg.inner_text("main")
    check("perfil mostra metas e vibes", "meta de" in ptxt.lower() and "suas vibes" in ptxt.lower())
    pg.screenshot(path="/tmp/hobby-shots/08_perfil.png", full_page=True)

    # exportar
    with pg.expect_download() as d: pg.click("text=Exportar meus dados")
    data = json.load(open(d.value.path()))
    check("exportação traz entradas e itens importados", len(data["entries"]) >= 14 and any(k.startswith("anilist:") for k in data["items"]))

    # métricas
    pg.click("text=Métricas do teste"); pg.wait_for_selector("table")
    mtxt = pg.inner_text("table")
    check("métricas mostram registros e mediana de toques", "Registros feitos" in mtxt and "Mediana de toques" in mtxt)
    pg.screenshot(path="/tmp/hobby-shots/09_metricas.png")

    # excluir dados (LGPD)
    pg.goto(BASE + "/perfil"); pg.click("text=Excluir meus dados"); pg.click("text=Confirmar exclusão"); pg.wait_for_timeout(300)
    check("excluir apaga biblioteca e eventos", pg.evaluate("localStorage.getItem('hobby:events')") is None and not json.loads(pg.evaluate("localStorage.getItem('hobby:v1')") or "{}").get("entries"))
    pg.goto(BASE + "/"); pg.wait_for_selector("[data-testid=cta-comecar]")
    check("depois de excluir, volta à apresentação", True)

    # dados de exemplo
    pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/inicio"); pg.goto(BASE + "/descobrir"); pg.wait_for_selector("li.card")
    check("dados de exemplo geram sugestões", pg.locator("li.card").count() >= 3)
    pg.screenshot(path="/tmp/hobby-shots/10_demo.png")

    # armazenamento corrompido não derruba o app
    pg.evaluate("localStorage.setItem('hobby:v1','{lixo')"); pg.goto(BASE + "/descobrir"); pg.wait_for_timeout(500)
    check("armazenamento corrompido: app abre vazio sem quebrar", pg.locator("text=Ainda não conhecemos seu gosto").count() == 1)

    # sem rolagem horizontal em 360px
    pg.set_viewport_size({"width": 360, "height": 740})
    for path in ["/importar", "/favoritos", "/descobrir", "/biblioteca", "/perfil", "/debug"]:
        pg.goto(BASE + path); pg.wait_for_timeout(250)
        over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(f"sem rolagem horizontal em 360px: {path}", over <= 0, f"+{over}px")

    check("sem erros no console", len(errors) == 0, "; ".join(errors[:3]))
    check("nenhum recurso falhou (fora os erros de importação provocados no teste)", len(bad) == 0, "; ".join(bad[:4]))
    b.close()

print(f"\n{len(passes)} passaram, {len(fails)} falharam")
sys.exit(1 if fails else 0)
