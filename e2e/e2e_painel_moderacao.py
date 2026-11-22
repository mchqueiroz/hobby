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
    pg.evaluate("d => localStorage.setItem('hobby:v1', JSON.stringify(d))", d); pg.reload(); pg.wait_for_selector("section.hero")
def signup(pg, email):
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
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
    ana, bru, car, adm = newpage(), newpage(), newpage(), newpage()
    for pg, email, lib in [(ana, "ana@ex.com", mklib(5, "Obra-prima, a trilha é incrível.")), (bru, "bruno@ex.com", mklib(4)), (car, "carla@ex.com", mklib(3)), (adm, "admin@ex.com", mklib(3))]:
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero"); seed(pg, lib); signup(pg, email)
    publish(ana, "ana_dev", True); publish(bru, "bruno_x", False)
    # Bruno comenta no perfil da Ana
    bru.goto(BASE + "/u/ana_dev"); bru.wait_for_selector("[data-testid=abrir-comentarios]", timeout=10000)
    open_thread(bru); comment(bru, "Compre meu curso de bitcoin agora!"); bru.wait_for_selector("[data-testid=comentario]")
    # Carla denuncia como spam
    car.goto(BASE + "/u/ana_dev"); car.wait_for_selector("[data-testid=abrir-comentarios]", timeout=10000)
    open_thread(car); car.wait_for_selector("[data-testid=comentario]")
    car.get_by_test_id("mais-opcoes").first.click()
    car.get_by_role("button", name="Spam ou propaganda").click()
    check("denúncia enviada", until(lambda: len(cloud()["tables"]["reports"]) == 1))
    # quem não é admin não entra
    ana.goto(BASE + "/moderacao"); ana.wait_for_selector("[data-testid=sem-acesso]", timeout=10000)
    check("não-admin vê aviso e nenhuma denúncia", ana.locator("[data-testid=denuncia]").count() == 0)
    # admin vê e modera
    adm.on("dialog", lambda d: d.accept())
    adm.goto(BASE + "/moderacao"); adm.wait_for_selector("[data-testid=denuncia]", timeout=10000)
    t = adm.get_by_test_id("denuncia").inner_text()
    check("mostra texto, motivo e autor", "bitcoin" in t and "Spam" in t and "bruno" in t.lower() and "1 denúncia" in t)
    adm.get_by_role("button", name="Esconder").click(); adm.wait_for_selector("text=Mostrar de novo")
    check("esconder grava hidden", any(c.get("hidden") for c in cloud()["tables"]["comments"]))
    adm.get_by_role("button", name="Mostrar de novo").click(); adm.wait_for_selector("[data-testid=sem-denuncias]")
    check("mostrar de novo limpa denúncias", len(cloud()["tables"]["reports"]) == 0 and not any(c.get("hidden") for c in cloud()["tables"]["comments"]))
    # denuncia de novo e apaga
    car.reload(); car.wait_for_selector("[data-testid=abrir-comentarios]"); open_thread(car); car.wait_for_selector("[data-testid=comentario]")
    car.get_by_test_id("mais-opcoes").first.click(); car.get_by_role("button", name="Ofensivo ou assédio").click()
    until(lambda: len(cloud()["tables"]["reports"]) == 1)
    adm.reload(); adm.wait_for_selector("[data-testid=denuncia]", timeout=10000)
    adm.get_by_role("button", name="Apagar").click(); adm.wait_for_selector("[data-testid=sem-denuncias]")
    check("apagar remove o comentário", len(cloud()["tables"]["comments"]) == 0)
    check("sem erros de página", not errs)
print("FAILS:", fails)
