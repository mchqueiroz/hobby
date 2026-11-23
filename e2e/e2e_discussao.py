import re
import json, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"; MOCK = "http://localhost:4010"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))
def cloud(): return json.load(urllib.request.urlopen(MOCK + "/__cloud"))
def until(fn, secs=8):
    end = time.time() + secs
    while time.time() < end:
        try:
            if fn(): return True
        except Exception: pass
        time.sleep(0.15)
    return False

HADES = "seed:jogo:hades"; URL_HADES = BASE + "/item/seed%3Ajogo%3Ahades"
def mklib(rating, review=None):
    e = {"itemId": HADES, "status": "concluido", "rating": rating, "at": 1000}
    if review: e["review"] = review
    return {"items": {}, "dismissed": [], "goal": 80, "lists": {}, "entries": {HADES: e}, "ts": {f"e:{HADES}": 5000}}
def seed(pg, d):
    pg.evaluate("d => localStorage.setItem('hobby:v1', JSON.stringify(d))", d); pg.reload(); pg.wait_for_selector("h1")
def signup(pg, email):
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
    c = pg.get_by_test_id("conta"); c.get_by_role("tab", name="Criar conta").click()
    pg.fill("#conta-email", email); pg.fill("#conta-senha", "senhaboa1"); c.locator("button[type=submit]").click()
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)
def publish(pg, handle, reviews):
    pg.goto(BASE + "/comunidade"); pg.wait_for_selector("#pub-handle")
    pg.fill("#pub-handle", handle)
    pg.get_by_label("Tornar meu perfil público").check()
    rb = pg.get_by_label("Mostrar também minhas resenhas")
    if rb.is_checked() != reviews: rb.set_checked(reviews)
    pg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[data-testid=publico-msg]")
def open_thread(pg, scope=None):
    root = scope or pg
    root.get_by_test_id("abrir-comentarios").first.click(); pg.wait_for_selector("[data-testid=conversa]")
def comment(pg, text):
    pg.locator("[data-testid=conversa] textarea").first.fill(text)
    pg.locator("[data-testid=conversa]").get_by_role("button", name="Comentar").first.click()

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def newpage(w=390, h=844):
        c = b.new_context(viewport={"width": w, "height": h}, locale="pt-BR"); pg = c.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e))); return pg
    ana, bru, car = newpage(), newpage(), newpage()
    for pg, email, lib in [(ana, "ana@ex.com", mklib(5, "Obra-prima, a trilha é incrível.")), (bru, "bruno@ex.com", mklib(4)), (car, "carla@ex.com", mklib(3))]:
        pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1"); seed(pg, lib); signup(pg, email)
    publish(ana, "ana_dev", True); publish(bru, "bruno_x", False)

    # ---- Bruno segue a Ana e comenta no feed
    bru.goto(BASE + "/comunidade"); bru.wait_for_selector("#pub-handle")
    bru.fill("input[aria-label='Buscar pessoas']", "ana"); bru.wait_for_selector("[data-testid=resultados]")
    bru.get_by_role("button", name="Seguir Ana").click() if bru.get_by_role("button", name="Seguir Ana").count() else bru.locator("[data-testid=resultados] button").first.click()
    bru.wait_for_selector("[data-testid=feed] li")
    check("feed mostra a resenha da Ana", "Obra-prima" in bru.get_by_test_id("feed").inner_text())
    check("botão de comentários começa com 0", bru.get_by_test_id("abrir-comentarios").first.inner_text().strip().endswith("0"))
    open_thread(bru)
    # a conversa mostra "Carregando…" antes de chegar a lista vazia
    try: bru.get_by_test_id("conversa").get_by_text("Ninguém comentou").wait_for(timeout=5000)
    except Exception: pass
    check("conversa vazia convida a comentar", "Ninguém comentou" in bru.get_by_test_id("conversa").inner_text())
    check("comentário vazio não envia", bru.locator("[data-testid=conversa]").get_by_role("button", name="Comentar").is_disabled())
    bru.locator("[data-testid=conversa] textarea").fill("x" * 520)
    check("comentário grande demais não envia", bru.locator("[data-testid=conversa]").get_by_role("button", name="Comentar").is_disabled())
    comment(bru, "Concordo! O Zagreus é demais. Qual final você achou melhor?")
    bru.wait_for_selector("[data-testid=comentario]")
    check("comentário aparece na conversa", "Zagreus" in bru.get_by_test_id("conversa").inner_text())
    check("contador sobe para 1", until(lambda: bru.get_by_test_id("abrir-comentarios").first.inner_text().strip().endswith("1")) or "1" in bru.get_by_test_id("abrir-comentarios").first.inner_text())
    check("autor vê o botão de apagar o próprio comentário", bru.get_by_role("button", name="Apagar comentário de Bruno").count() == 1 if False else bru.locator("[data-testid=comentario] >> text=Apagar").count() == 1)
    rows = [c for c in cloud()["tables"]["comments"]]
    check("comentário foi gravado ligado à atividade certa", len(rows) == 1 and rows[0]["target_item"] == HADES)

    # texto é texto, nunca HTML
    comment(bru, "<img src=x onerror=window.__xss=1> <b>negrito</b>")
    bru.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 2")
    check("HTML digitado aparece como texto", "<img src=x" in bru.get_by_test_id("conversa").inner_text() and bru.locator("[data-testid=conversa] img, [data-testid=conversa] b").count() == 0 and bru.evaluate("window.__xss === undefined"))

    # ---- Ana vê no perfil dela, responde e modera
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("[data-testid=comentarios-recebidos]")
    check("Ana vê 'Comentários no seu perfil'", "bruno_x" in ana.get_by_test_id("comentarios-recebidos").inner_text() and "Hades" in ana.get_by_test_id("comentarios-recebidos").inner_text(), ana.get_by_test_id("comentarios-recebidos").inner_text())
    ana.goto(BASE + "/u/ana_dev"); ana.wait_for_selector("[data-testid=atividade]")
    check("na página da Ana o contador mostra 2", until(lambda: ana.get_by_test_id("abrir-comentarios").first.inner_text().strip().endswith("2")))
    open_thread(ana)
    ana.wait_for_selector("[data-testid=comentario]")
    check("Ana lê os comentários do Bruno", "Zagreus" in ana.get_by_test_id("conversa").inner_text())
    ana.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 2")
    check("Ana (dona) pode apagar qualquer comentário", ana.locator("[data-testid=comentario] >> text=Apagar").count() == 2)
    comment(ana, "O final com a ||Perséfone||! Joga com a Arma do Estige.")
    ana.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 3")
    ana.locator("[data-testid=comentario]").nth(1).get_by_role("button", name=re.compile("^Apagar")).click()   # apaga o comentário do HTML
    ana.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 2")
    check("dona apagou o comentário do Bruno", len(cloud()["tables"]["comments"]) == 2)

    # ---- Bruno vê a resposta e não pode apagar a da Ana
    bru.goto(BASE + "/u/ana_dev"); bru.wait_for_selector("[data-testid=atividade]"); open_thread(bru)
    bru.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 2")
    check("Bruno vê a resposta da Ana", "Arma do Estige" in bru.get_by_test_id("conversa").inner_text())
    check("Bruno só tem 'Apagar' no próprio comentário", bru.locator("[data-testid=comentario] >> text=Apagar").count() == 1)

    # ---- página da obra: resenhas da comunidade (inclusive para visitante)
    bru.goto(URL_HADES); bru.wait_for_selector("[data-testid=resenhas-comunidade]")
    check("página da obra mostra a resenha da Ana", "Obra-prima" in bru.get_by_test_id("resenhas-comunidade").inner_text())
    open_thread(bru, bru.get_by_test_id("resenhas-comunidade")); bru.wait_for_selector("[data-testid=comentario]")
    check("e a conversa dela", "Arma do Estige" in bru.get_by_test_id("resenhas-comunidade").inner_text())
    vis = newpage()
    vis.goto(URL_HADES); vis.wait_for_selector("[data-testid=resenhas-comunidade]")
    open_thread(vis, vis.get_by_test_id("resenhas-comunidade"))
    vis.wait_for_selector("[data-testid=comentario]")
    check("visitante lê a conversa", "Arma do Estige" in vis.get_by_test_id("conversa").inner_text())
    check("visitante é convidado a entrar para comentar", vis.get_by_test_id("conversa").get_by_role("link", name="Entre na sua conta").count() == 1 and vis.locator("[data-testid=conversa] textarea").count() == 0)
    check("visitante não vê botão de apagar", vis.locator("[data-testid=comentario] >> text=Apagar").count() == 0)

    # ---- perfil privado lê, mas é orientado a publicar
    car.goto(URL_HADES); car.wait_for_selector("[data-testid=resenhas-comunidade]"); open_thread(car, car.get_by_test_id("resenhas-comunidade"))
    check("perfil privado não comenta: vê convite para publicar", car.get_by_test_id("conversa").get_by_role("link", name="publique seu perfil").count() == 1 and car.locator("[data-testid=conversa] textarea").count() == 0)

    # ---- freio contra enxurrada
    for i in range(10):
        comment(bru, f"spam {i}"); bru.wait_for_timeout(120)
    bru.wait_for_selector("[data-testid=thread-erro]", timeout=8000)
    check("enxurrada de comentários é freada com aviso", "Calma" in bru.get_by_test_id("thread-erro").inner_text())

    # ---- sem resenha liberada, a obra não lista a resenha
    publish(ana, "ana_dev", False)
    until(lambda: all(not (a.get("review")) for a in cloud()["tables"]["activity"] if a["item_id"] == HADES))
    vis.goto(URL_HADES); vis.wait_for_selector("[data-testid=resenhas-comunidade]")
    check("tirar 'mostrar resenhas' esconde a resenha da obra", "Obra-prima" not in vis.get_by_test_id("resenhas-comunidade").inner_text())

    # ---- despublicar leva os comentários junto
    publish(ana, "ana_dev", True)
    publish(ana, "ana_dev", True)

    bru.goto(BASE + '/comunidade'); bru.wait_for_selector('[data-testid=feed] li'); open_thread(bru)
    bru.wait_for_selector("[data-testid=conversa] button.spoiler")
    sp = bru.locator("[data-testid=conversa] button.spoiler")
    check("spoiler vem escondido", sp.count() == 1 and "Perséfone" not in bru.get_by_test_id("conversa").inner_text() and "toque para ver" in sp.inner_text())
    sp.click()
    check("tocar revela o spoiler", "Perséfone" in sp.inner_text() and sp.get_attribute("aria-pressed") == "true")
    check("o texto no banco continua com as marcas", any("||Perséfone||" in c["body"] for c in cloud()["tables"]["comments"]))
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("#pub-handle")
    ana.get_by_label("Tornar meu perfil público").uncheck(); ana.get_by_role("button", name="Salvar").click(); ana.wait_for_selector("[data-testid=publico-msg]")
    check("despublicar apaga a atividade e os comentários dela", until(lambda: not [c for c in cloud()["tables"]["comments"] if c["target_item"] == HADES]))
    check("sem erros de página", not errs, str(errs[:3]))
    b.close()

print("FALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
