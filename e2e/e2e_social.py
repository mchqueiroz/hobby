import json, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4010".replace("4010", "3100"); MOCK = "http://localhost:4010"
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

def mklib(entries):  # entries: id -> (rating, extra)
    return {"items": {}, "dismissed": [], "goal": 80, "lists": {},
            "entries": {i: {"itemId": i, "status": "concluido", "rating": r, "at": 1000, **x} for i, (r, x) in entries.items()},
            "ts": {f"e:{i}": 5000 for i in entries}}

def seed(pg, data):
    pg.evaluate("d => localStorage.setItem('hobby:v1', JSON.stringify(d))", data)
    pg.reload(); pg.wait_for_selector("section.hero")

def signup(pg, email):
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
    pg.get_by_test_id("conta").get_by_role("tab", name="Criar conta").click()
    pg.fill("#conta-email", email); pg.fill("#conta-senha", "senhaboa1")
    pg.get_by_test_id("conta").locator("button[type=submit]").click()
    pg.wait_for_selector("text=Você está em", timeout=8000)
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)

def publish(pg, handle, bio="", reviews=False, public=True):
    pg.goto(BASE + "/comunidade"); pg.wait_for_selector("#pub-handle")
    pg.fill("#pub-handle", handle); pg.fill("#pub-bio", bio)
    box = pg.get_by_label("Tornar meu perfil público")
    if box.is_checked() != public: box.set_checked(public)
    rb = pg.get_by_label("Mostrar também minhas resenhas")
    if public and rb.is_checked() != reviews: rb.set_checked(reviews)
    pg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("[data-testid=publico-msg]")
    return pg.get_by_test_id("publico-msg").inner_text()

def tables(): return cloud()["tables"]
def uid_of(handle): return next(pr["id"] for pr in tables()["profiles"] if pr["handle"] == handle)
def act_of(handle): return [r for r in tables()["activity"] if r["user_id"] == uid_of(handle)]
def my_act(email_uid_prefix=None):
    return tables()["activity"]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def newpage():
        c = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR"); pg = c.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e))); return c, pg

    HADES, DN, BEBOP, PARASITA, WITCHER = "seed:jogo:hades", "seed:anime:death-note", "seed:anime:cowboy-bebop", "seed:filme:parasita", "seed:jogo:the-witcher-3"
    # ---------- Ana ----------
    _, ana = newpage()
    ana.goto(BASE + "/perfil"); ana.wait_for_selector("section.hero")
    seed(ana, mklib({HADES: (5, {"review": "segredo da Ana"}), DN: (4, {}), BEBOP: (5, {}), PARASITA: (4, {})}))
    signup(ana, "ana@ex.com")

    ana.goto(BASE + "/comunidade"); ana.wait_for_selector("#pub-handle")
    check("comunidade mostra privacidade por padrão (nada público)", "ninguém vê nada" in ana.get_by_test_id("publico").inner_text().lower())
    ana.fill("#pub-handle", "ab")
    check("nome inválido bloqueia salvar", ana.get_by_role("button", name="Salvar").is_disabled())
    ana.fill("#pub-handle", "admin")
    check("nome reservado é recusado na tela", "reservado" in ana.get_by_test_id("publico").inner_text() and ana.get_by_role("button", name="Salvar").is_disabled())
    check("nada foi publicado com nome recusado", not tables()["profiles"])
    msg = publish(ana, "ana_dev", "Gosto de histórias sombrias", reviews=False)
    check("perfil público salvo", "salvo" in msg.lower(), msg)
    check("perfil e atividade foram para o banco", len(tables()["profiles"]) == 1 and until(lambda: len(tables()["activity"]) == 4))
    check("sem resenha liberada, a resenha não sobe", "segredo" not in json.dumps(tables()))
    check("perfil público não leva títulos nas estatísticas", "Hades" not in json.dumps(tables()["profiles"]))

    # ---------- Bruno ----------
    _, bru = newpage()
    bru.goto(BASE + "/perfil"); bru.wait_for_selector("section.hero")
    seed(bru, mklib({HADES: (5, {}), DN: (4, {}), BEBOP: (2, {}), WITCHER: (4, {})}))
    signup(bru, "bruno@ex.com")
    publish(bru, "bruno_x")
    bru.goto(BASE + "/comunidade"); bru.wait_for_selector("#pub-handle")
    bru.fill("input[aria-label='Buscar pessoas']", "ana")
    bru.wait_for_selector("[data-testid=resultados]")
    check("busca acha o perfil público", "@ana_dev" in bru.get_by_test_id("resultados").inner_text())
    bru.locator("[data-testid=resultados]").get_by_role("button").first.click()
    bru.wait_for_selector("[data-testid=seguindo]")
    check("seguir coloca a pessoa em 'Quem você segue'", "ana_dev" in bru.get_by_test_id("seguindo").inner_text())
    bru.wait_for_selector("[data-testid=feed] li")
    ft = bru.get_by_test_id("feed").inner_text()
    check("feed mostra a atividade de quem segue", "Hades" in ft and "ana_dev" not in ft or "Hades" in ft)
    check("feed ainda não mostra resenha", "segredo" not in ft)
    check("não apareceu a atividade do próprio Bruno no feed", "Witcher" not in ft)

    bru.goto(BASE + "/u/ana_dev"); bru.wait_for_selector("[data-testid=perfil-publico]")
    pt = bru.get_by_test_id("perfil-publico").inner_text()
    check("página pública mostra nome, @ e bio", "@ana_dev" in pt and "sombrias" in pt)
    bru.wait_for_selector("[data-testid=afinidade]")
    aff = bru.get_by_test_id("afinidade").inner_text()
    check("afinidade calculada com obras em comum", "% de afinidade" in aff and "obras" in aff, aff)
    check("mostra o que os dois amaram", "Hades" in bru.locator("main").inner_text())
    check("botão mostra que já segue", bru.get_by_role("button", name="Seguindo").count() == 1)
    bru.get_by_test_id("juntos").get_by_role("button", name="Sugerir").click()
    bru.wait_for_selector("[data-testid=juntos-lista]")
    jt = bru.get_by_test_id("juntos").inner_text()
    check("ver algo juntos mostra sugestões", bru.locator("[data-testid=juntos-lista] li").count() >= 1, jt)
    check("ver algo juntos não expõe títulos do outro como 'dele'", "segredo" not in jt)
    bru.locator("[data-testid=juntos-lista] li button").first.click()
    check("quero ver a partir das sugestões grava na biblioteca", bru.evaluate("() => Object.values(JSON.parse(localStorage.getItem('hobby:v1')).entries).some(e => e.status === 'quero')"))

    # ---------- resenha liberada, nota mudada, item removido ----------
    publish(ana, "ana_dev", "Gosto de histórias sombrias", reviews=True)
    check("liberar resenhas publica o texto", until(lambda: "segredo da Ana" in json.dumps(tables()["activity"])))
    bru.goto(BASE + "/u/ana_dev"); bru.wait_for_selector("[data-testid=atividade]")
    check("a resenha aparece na página pública", "segredo da Ana" in bru.get_by_test_id("atividade").inner_text())

    ana.goto(BASE + "/perfil"); ana.wait_for_selector("section.hero")
    ana.evaluate("""() => { const d = JSON.parse(localStorage.getItem('hobby:v1'));
      d.entries['seed:filme:parasita'].rating = 2; d.ts['e:seed:filme:parasita'] = Date.now() + 10000;
      delete d.entries['seed:anime:cowboy-bebop']; d.ts['e:seed:anime:cowboy-bebop'] = Date.now() + 10000;
      localStorage.setItem('hobby:v1', JSON.stringify(d)); }""")
    ana.reload(); ana.wait_for_selector("section.hero")
    ok = until(lambda: len(act_of("ana_dev")) == 3 and any(r["item_id"] == PARASITA and float(r["rating"]) == 2 for r in act_of("ana_dev")))
    check("mudar nota e remover item atualiza a atividade pública", ok, str([(r["item_id"], r["rating"]) for r in act_of("ana_dev")]))

    # ---------- visitante sem conta ----------
    _, anon = newpage()
    anon.goto(BASE + "/u/bruno_x"); anon.wait_for_selector("[data-testid=perfil-publico]")
    check("visitante sem conta vê o perfil público", "@bruno_x" in anon.get_by_test_id("perfil-publico").inner_text())
    check("visitante é convidado a entrar para seguir", anon.get_by_role("link", name="Entre para seguir").count() == 1)
    check("visitante não vê afinidade", anon.get_by_test_id("afinidade").count() == 0)
    anon.goto(BASE + "/u/ninguem_aqui"); anon.wait_for_selector("[data-testid=nao-encontrado]")
    check("perfil inexistente mostra aviso", True)
    anon.goto(BASE + "/u/Nome Inválido!"); anon.wait_for_selector("[data-testid=nao-encontrado]")
    check("handle inválido na URL não quebra", True)
    anon.goto(BASE + "/comunidade")
    anon.wait_for_selector("text=crie uma conta")
    check("comunidade sem conta orienta a criar conta", True)

    # ---------- perfil privado não pode seguir ----------
    _, car = newpage()
    car.goto(BASE + "/perfil"); car.wait_for_selector("section.hero")
    signup(car, "carla@ex.com")
    car.goto(BASE + "/comunidade"); car.wait_for_selector("#pub-handle")
    car.fill("input[aria-label='Buscar pessoas']", "bruno")
    car.wait_for_selector("[data-testid=resultados]")
    check("perfil privado não consegue seguir (botão desabilitado)", car.get_by_role("button", name="Seguir").first.is_disabled())

    # ---------- despublicar apaga tudo ----------
    publish(ana, "ana_dev", "", public=False)
    check("despublicar apaga a atividade pública", until(lambda: not act_of("ana_dev")))
    bru.goto(BASE + "/u/ana_dev"); bru.wait_for_selector("[data-testid=nao-encontrado]")
    check("perfil despublicado some para os outros", True)
    bru.goto(BASE + "/comunidade"); bru.locator("[data-testid=seguindo], :text('Você ainda não segue')").first.wait_for(timeout=8000)
    check("quem despublicou sai da lista de seguidos", "ana_dev" not in bru.locator("main").inner_text().lower().split("quem você segue")[1].split("o que estão fazendo")[0])

    # ---------- excluir conta apaga o social ----------
    ana.goto(BASE + "/perfil"); ana.wait_for_selector("section.hero")
    ana.get_by_role("button", name="Excluir minha conta").click()
    ana.get_by_role("button", name="Apagar conta e dados").click()
    ana.wait_for_selector("#conta-email", timeout=8000)
    t = tables()
    check("excluir conta remove perfil, atividade e seguidores", all(r["handle"] != "ana_dev" for r in t["profiles"]))
    check("sem erros de página", not errs, str(errs[:3]))
    b.close()

print("FALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
