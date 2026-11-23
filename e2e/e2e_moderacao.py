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


def open_profile_thread(pg, handle):
    pg.goto(BASE + "/u/" + handle); pg.wait_for_selector("[data-testid=abrir-comentarios]")
    open_thread(pg)
    pg.wait_for_function("!document.querySelector('[data-testid=conversa]').innerText.includes('Carregando')")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def newpage():
        c = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR"); pg = c.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e))); return pg
    names = ["ana", "bruno", "carla", "dani", "eva"]
    pgs = {n: newpage() for n in names}
    for n, pg in pgs.items():
        pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1"); seed(pg, mklib(4)); signup(pg, f"{n}@ex.com")
        publish(pg, f"{n}_x", False)
    ana, bru, car, dan, eva = (pgs[n] for n in names)
    prof = lambda n: next(r for r in cloud()["tables"]["profiles"] if r["handle"] == f"{n}_x")
    ids = {n: prof(n)["id"] for n in names}

    # Bruno segue a Ana e comenta
    bru.goto(BASE + "/u/ana_x"); bru.get_by_role("button", name="Seguir", exact=True).click()
    bru.wait_for_selector("text=Seguindo")
    open_profile_thread(bru, "ana_x"); comment(bru, "Isso é spam, compre meu curso!")
    bru.wait_for_selector("[data-testid=comentario]")
    check("Bruno comentou", len(cloud()["tables"]["comments"]) == 1)
    check("autor não vê 'Denunciar' no próprio comentário", bru.locator("[data-testid=mais-opcoes]").count() == 0)

    # denúncias: 2 não escondem, a 3ª esconde
    def denunciar(pg, motivo="Spam ou propaganda"):
        open_profile_thread(pg, "ana_x")
        pg.get_by_test_id("mais-opcoes").first.click()
        pg.get_by_test_id("menu-denuncia").get_by_role("button", name=motivo).click()
        pg.wait_for_selector("[data-testid=thread-aviso]")
        return pg.get_by_test_id("thread-aviso").inner_text()
    msg = denunciar(car)
    check("denúncia enviada com mensagem", "Denúncia enviada" in msg, msg)
    check("denúncia gravada no banco", len(cloud()["tables"]["reports"]) == 1)
    msg2 = denunciar(car, "Ofensivo ou assédio")
    check("denunciar de novo não duplica", "já tinha denunciado" in msg2 and len(cloud()["tables"]["reports"]) == 1, msg2)
    denunciar(dan, "Outro motivo")
    open_profile_thread(eva, "ana_x"); eva.wait_for_selector("[data-testid=comentario]")
    check("com 2 denúncias o comentário ainda aparece", eva.locator("[data-testid=comentario]").count() == 1)
    denunciar(eva)
    check("3 denúncias de pessoas diferentes escondem o comentário", cloud()["tables"]["comments"][0].get("hidden") is True)
    open_profile_thread(eva, "ana_x")
    check("terceiros não veem mais o comentário", eva.locator("[data-testid=comentario]").count() == 0)
    open_profile_thread(ana, "ana_x")
    check("a dona do perfil ainda vê (e pode apagar)", ana.locator("[data-testid=comentario]").count() == 1)
    open_profile_thread(bru, "ana_x")
    check("o autor ainda vê o próprio comentário", bru.locator("[data-testid=comentario]").count() == 1)

    # Ana bloqueia o Bruno a partir de um comentário dele
    comment(bru, "Segundo comentário do Bruno")
    bru.wait_for_function("document.querySelectorAll('[data-testid=comentario]').length === 2")
    open_profile_thread(ana, "ana_x")
    ana.locator("[data-testid=comentario]", has_text="Segundo comentário").get_by_test_id("mais-opcoes").click()
    ana.get_by_test_id("bloquear-autor").click()
    ana.wait_for_selector("[data-testid=thread-aviso]")
    check("bloqueio avisa onde desbloquear", "bloqueado" in ana.get_by_test_id("thread-aviso").inner_text())
    check("bloqueio gravado", [(x["blocker"], x["blocked"]) for x in cloud()["tables"]["blocks"]] == [(ids["ana"], ids["bruno"])])
    check("seguir foi desfeito nos dois sentidos", cloud()["tables"]["follows"] == [])
    check("comentários do bloqueado somem para quem bloqueou", ana.locator("[data-testid=comentario]").count() == 0)

    # o bloqueado não consegue mais comentar nem seguir
    open_profile_thread(bru, "ana_x")
    n0 = len(cloud()["tables"]["comments"])
    comment(bru, "Tentando de novo")
    bru.wait_for_selector("[data-testid=thread-erro]")
    check("bloqueado não consegue comentar", len(cloud()["tables"]["comments"]) == n0)
    bru.goto(BASE + "/u/ana_x"); bru.wait_for_selector("h1")
    bru.get_by_role("button", name="Seguir", exact=True).click(); bru.wait_for_timeout(500)
    check("bloqueado não consegue seguir e vê o aviso", cloud()["tables"]["follows"] == [] and bru.get_by_test_id("seguir-erro").count() == 1)

    # lista de bloqueados e desbloqueio
    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("[data-testid=bloqueados]")
    check("lista mostra quem foi bloqueado", "bruno" in ana.get_by_test_id("bloqueados").inner_text().lower())
    ana.get_by_role("button", name="Desbloquear Bruno").click()
    ana.wait_for_selector("[data-testid=bloqueados]", state="detached")
    check("desbloquear apaga o bloqueio", cloud()["tables"]["blocks"] == [])

    # bloquear pelo perfil (com confirmação) e a busca esconde o bloqueado
    car.goto(BASE + "/u/dani_x"); car.wait_for_selector("[data-testid=bloquear]")
    car.get_by_test_id("bloquear").click()
    check("pede confirmação antes de bloquear", car.get_by_test_id("confirmar-bloqueio").count() == 1 and cloud()["tables"]["blocks"] == [])
    car.get_by_test_id("confirmar-bloqueio").click(); car.wait_for_selector("[data-testid=bloqueado]")
    check("bloqueio pelo perfil gravado", len(cloud()["tables"]["blocks"]) == 1)
    car.goto(BASE + "/comunidade"); car.wait_for_selector("#pub-handle")
    car.fill("input[aria-label='Buscar pessoas']", "dani")
    car.wait_for_selector("text=Ninguém com esse nome")
    check("busca não mostra pessoas bloqueadas", car.get_by_test_id("resultados").count() == 0)
    car.goto(BASE + "/u/dani_x"); car.wait_for_selector("[data-testid=bloqueado]")
    car.get_by_role("button", name="Desbloquear").click(); car.wait_for_selector("[data-testid=bloquear]")
    check("desbloquear pelo perfil", cloud()["tables"]["blocks"] == [])

    check("sem erros de console", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
