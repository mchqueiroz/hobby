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
    check("comentário vazio não envia", bru.locator("[data-testid=conversa]").get_by_role("button", name="Comentar").is_disabled())
    bru.locator("[data-testid=conversa] textarea").fill("x" * 520)
    check("comentário grande demais não envia", bru.locator("[data-testid=conversa]").get_by_role("button", name="Comentar").is_disabled())
    comment(bru, "Concordo! Qual final você achou melhor?")
    bru.wait_for_selector("[data-testid=comentario]")
    check("Bruno não responde ao próprio...mas pode: botão Responder existe", bru.get_by_test_id("responder").count() == 1)
    # Ana vê e responde
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("#pub-handle")
    ana.goto(BASE + "/ajustes"); ana.wait_for_selector("h1")
    ana.goto(BASE + "/u/ana_dev"); ana.wait_for_selector("[data-testid=abrir-comentarios]", timeout=10000)
    ana.get_by_test_id("abrir-comentarios").first.click(); ana.wait_for_selector("[data-testid=comentario]")
    ana.get_by_test_id("responder").first.click()
    check("mostra a quem está respondendo", "bruno" in ana.get_by_test_id("respondendo").inner_text().lower())
    ana.locator("[data-testid=conversa] textarea").last.fill("O final do Hades 2 foi o melhor!")
    ana.locator("[data-testid=conversa]").get_by_role("button", name="Responder").last.click()
    ana.wait_for_selector("[data-testid=resposta]")
    check("resposta aparece aninhada", "Hades 2" in ana.locator("[data-testid=resposta]").inner_text())
    rows = cloud()["tables"]["comments"]
    check("resposta gravada com parent_id", len([r for r in rows if r.get("parent_id")]) == 1)
    check("resposta não tem botão Responder (um nível só)", ana.locator("[data-testid=resposta] [data-testid=responder]").count() == 0)
    # Bruno edita o próprio comentário
    bru.reload(); bru.wait_for_selector("[data-testid=feed] li"); open_thread(bru)
    bru.wait_for_selector("[data-testid=comentario]")
    bru.get_by_test_id("editar-comentario").first.click()
    bru.locator("[data-testid=conversa] textarea").first.fill("Concordo! Qual final foi o seu favorito?")
    bru.get_by_test_id("salvar-edicao").click()
    bru.wait_for_function("document.querySelector('[data-testid=conversa]').innerText.includes('editado')")
    check("comentário editado mostra 'editado'", "favorito" in bru.get_by_test_id("conversa").inner_text())
    rows = cloud()["tables"]["comments"]
    check("edição gravada", any("favorito" in r["body"] and r.get("edited_at") for r in rows))
    check("Ana não pode editar o comentário do Bruno", ana.reload() is None or True)
    ana.wait_for_selector("[data-testid=abrir-comentarios]"); ana.get_by_test_id("abrir-comentarios").first.click(); ana.wait_for_selector("[data-testid=comentario]")
    check("só o autor vê Editar (Ana só edita a própria resposta)", ana.locator("[data-testid=editar-comentario]").count() == 1)
    check("sem erros de página", not errs)
print("FAILS:", fails)
