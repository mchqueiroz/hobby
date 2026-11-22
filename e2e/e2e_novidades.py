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
    ana, bru = newpage(), newpage()
    for pg, email, lib in [(ana, "ana@ex.com", mklib(5, "Obra-prima, a trilha é incrível.")), (bru, "bruno@ex.com", mklib(4))]:
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero"); seed(pg, lib); signup(pg, email)
    publish(ana, "ana_dev", True); publish(bru, "bruno_x", False)
    social = ana.locator('nav[aria-label="Principal"] a', has_text="Social")

    # Ana abre a comunidade uma vez (marca como vista); sem novidades
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("#pub-handle"); ana.wait_for_selector("text=O que estão fazendo")
    check("sem novidades, sem bloco e sem selo", ana.get_by_test_id("novidades").count() == 0 and social.locator(".dot").count() == 0)
    time.sleep(1.2)  # garante que o próximo evento é mais novo que a "última visita"

    # Bruno segue a Ana e comenta na resenha dela
    bru.goto(BASE + "/comunidade"); bru.wait_for_selector("#pub-handle")
    bru.fill("input[aria-label='Buscar pessoas']", "ana"); bru.wait_for_selector("[data-testid=resultados]")
    bru.locator("[data-testid=resultados] button").first.click()
    bru.wait_for_selector("[data-testid=feed] li")
    open_thread(bru); comment(bru, "Concordo, a trilha é demais!")
    bru.wait_for_selector("[data-testid=comentario]")
    check("comentário gravado", until(lambda: len(cloud()["tables"]["comments"]) == 1))

    # Ana volta a uma página qualquer: o selo aparece no menu (2 novidades)
    ana.goto(BASE + "/inicio"); ana.wait_for_selector("[data-testid=meta]")
    check("selo no menu Social", until(lambda: social.locator(".dot").count() == 1))
    check("selo diz quantas novidades (para leitor de tela)", until(lambda: "2 novidades" in social.text_content()), social.text_content())

    # abrir Social mostra o bloco e zera o selo
    social.click(); ana.wait_for_selector("[data-testid=novidades]")
    nt = ana.get_by_test_id("novidades").inner_text()
    check("bloco lista o seguidor novo", "bruno_x começou a te seguir" in nt, nt)
    check("bloco lista o comentário novo", "comentou" in nt and "trilha é demais" in nt, nt)
    ana.goto(BASE + "/inicio"); ana.wait_for_selector("[data-testid=meta]")
    check("selo some depois de ver", until(lambda: social.locator(".dot").count() == 0))
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("text=O que estão fazendo")
    check("na próxima visita o bloco não repete", ana.get_by_test_id("novidades").count() == 0)
    check("sem erros", errs == [], str(errs))
print("FALHAS:", fails)
raise SystemExit(1 if fails else 0)
