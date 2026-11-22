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
HAIK = "seed:anime:haikyu"
def mklib2(r1, r2):
    es = {HADES: {"itemId": HADES, "status": "concluido", "rating": r1, "at": 1000}, HAIK: {"itemId": HAIK, "status": "concluido", "rating": r2, "at": 1000}}
    return {"items": {}, "dismissed": [], "goal": 80, "lists": {}, "entries": es, "ts": {f"e:{HADES}": 5000, f"e:{HAIK}": 5000}}
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
    ana, bru, car = newpage(), newpage(), newpage()
    for pg, email, lib in [(ana, "ana@ex.com", mklib2(5, 4)), (bru, "bruno@ex.com", mklib(4)), (car, "carla@ex.com", mklib2(4.5, 4))]:
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero"); seed(pg, lib); signup(pg, email)
    publish(ana, "ana_dev", False); publish(bru, "bruno_x", False)
    # ---- curtidas: Bruno segue a Ana e curte
    bru.goto(BASE + "/comunidade"); bru.wait_for_selector("#pub-handle")
    bru.fill("input[aria-label='Buscar pessoas']", "ana"); bru.wait_for_selector("[data-testid=resultados]")
    bru.locator("[data-testid=resultados] button").first.click()
    bru.wait_for_selector("[data-testid=feed] li")
    check("começa com 0 curtidas", bru.get_by_test_id("curtidas").first.inner_text().strip() == "0")
    bru.get_by_test_id("curtir").first.click()
    check("curtir mostra 1 na hora", bru.get_by_test_id("curtidas").first.inner_text().strip() == "1")
    check("curtida gravada", until(lambda: len(cloud()["tables"]["likes"]) == 1))
    bru.reload(); bru.wait_for_selector("[data-testid=feed] li")
    check("curtida persiste", bru.get_by_test_id("curtidas").first.inner_text().strip() == "1" and bru.get_by_test_id("curtir").first.get_attribute("aria-pressed") == "true")
    # Ana vê a curtida e não pode curtir o próprio registro
    ana.goto(BASE + "/u/ana_dev"); ana.wait_for_selector("[data-testid=curtir]", timeout=10000)
    check("dona vê a contagem e o botão fica desligado", ana.get_by_test_id("curtidas").first.inner_text().strip() == "1" and ana.get_by_test_id("curtir").first.is_disabled())
    # a curtida aparece nas novidades da Ana
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("#pub-handle")
    ana.wait_for_selector("[data-testid=curtida-recebida]", timeout=10000)
    check("novidades mostram quem curtiu e o quê", "bruno" in ana.get_by_test_id("curtida-recebida").first.inner_text().lower() and "Hades" in ana.get_by_test_id("curtida-recebida").first.inner_text())
    # descurtir
    bru.get_by_test_id("curtir").first.click()
    check("descurtir volta a 0", bru.get_by_test_id("curtidas").first.inner_text().strip() == "0" and until(lambda: len(cloud()["tables"]["likes"]) == 0))
    # ---- sugestões: Carla tem as mesmas obras da Ana
    car.goto(BASE + "/comunidade"); car.wait_for_selector("#pub-handle")
    car.wait_for_selector("[data-testid=sugestoes]", timeout=10000)
    t = car.get_by_test_id("sugestoes").inner_text()
    check("sugere a Ana com obras em comum", "ana" in t.lower() and "2 obras em comum" in t and "nota parecida" in t)
    check("não sugere quem não tem 2 obras em comum (Bruno)", "bruno" not in t.lower())
    car.get_by_role("button", name="Seguir Ana").click()
    car.wait_for_selector("[data-testid=sugestoes]", state="detached", timeout=10000)
    check("seguir tira a pessoa das sugestões", True)
    check("sem erros de página", not errs)
print("FAILS:", fails)
