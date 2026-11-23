import json, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"; MOCK = "http://localhost:4010"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def cloud(): return json.load(urllib.request.urlopen(MOCK + "/__cloud"))
def post(path, obj): urllib.request.urlopen(urllib.request.Request(MOCK + path, json.dumps(obj).encode(), {"Content-Type": "application/json"}))

def lib(ids_ts):
    ids = list(ids_ts)
    return {"items": {}, "dismissed": [], "goal": 80, "lists": {},
            "entries": {i: {"itemId": i, "status": "concluido", "rating": 5, "at": 1} for i in ids},
            "ts": {f"e:{i}": t for i, t in ids_ts.items()}}

def seed(pg, data):
    pg.evaluate("d => localStorage.setItem('hobby:v1', JSON.stringify(d))", data)
    pg.reload(); pg.wait_for_selector("h1")

def local_ids(pg):
    return sorted(json.loads(pg.evaluate("localStorage.getItem('hobby:v1')"))["entries"].keys())

def conta(pg): return pg.get_by_test_id("conta")
def status(pg): return pg.get_by_test_id("sync-status")

def fill_login(pg, email, pw, tab):
    conta(pg).get_by_role("tab", name=tab).click()
    pg.fill("#conta-email", email)
    if pw is not None: pg.fill("#conta-senha", pw)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
    check("cartão de conta aparece", conta(pg).count() == 1)

    # validações do formulário
    fill_login(pg, "ana@ex.com", "curta", "Criar conta")
    check("senha curta bloqueia o envio", conta(pg).locator("button[type=submit]").is_disabled())
    fill_login(pg, "ana@ex.com", "senhaboa1", "Entrar")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_selector("[data-testid=conta-msg]")
    check("entrar sem conta mostra erro claro", "incorretos" in pg.get_by_test_id("conta-msg").inner_text())

    # aparelho A: tem dados locais, cria conta, e os dados sobem
    seed(pg, lib({"seed:jogo:hades": 1000, "seed:anime:death-note": 1100}))
    fill_login(pg, "ana@ex.com", "senhaboa1", "Criar conta")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_selector("text=Você está em", timeout=8000)
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)
    c = cloud()
    check("criar conta sobe a biblioteca local", len(c["libs"]) == 1 and sorted(list(c["libs"].values())[0]["data"]["lib"]["entries"]) == ["seed:anime:death-note", "seed:jogo:hades"], str(c["saves"]))
    check("primeira gravação usa versão 0 (cria a linha)", c["saves"][0]["expected"] == 0)
    check("dados locais continuam intactos", local_ids(pg) == ["seed:anime:death-note", "seed:jogo:hades"])

    # aparelho B: já tinha um item próprio; ao entrar, junta com o da nuvem sem perder nenhum
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pb = ctx2.new_page(); pb.on("pageerror", lambda e: errs.append(str(e)))
    pb.goto(BASE + "/ajustes"); pb.wait_for_selector("h1")
    seed(pb, lib({"seed:filme:parasita": 2000}))
    fill_login(pb, "ana@ex.com", "senhaboa1", "Entrar")
    conta(pb).locator("button[type=submit]").click()
    pb.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)
    check("aparelho B recebe o da nuvem e mantém o próprio", local_ids(pb) == ["seed:anime:death-note", "seed:filme:parasita", "seed:jogo:hades"], str(local_ids(pb)))
    c = cloud()
    check("nuvem passa a ter os três", len(list(c["libs"].values())[0]["data"]["lib"]["entries"]) == 3)

    # aparelho A pega a mudança de B ao sincronizar
    conta(pg).get_by_role("button", name="Sincronizar agora").click()
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')")
    pg.wait_for_function("JSON.parse(localStorage.getItem('hobby:v1')).entries['seed:filme:parasita']")
    check("A recebe o item que B registrou", "seed:filme:parasita" in local_ids(pg))

    # conflito: outro aparelho grava na nuvem enquanto A tem mudança local pendente
    cur = list(cloud()["libs"].values())[0]["data"]
    cur2 = json.loads(json.dumps(cur)); cur2["lib"]["entries"]["seed:jogo:celeste"] = {"itemId": "seed:jogo:celeste", "status": "quero", "at": 5}
    cur2["lib"]["ts"]["e:seed:jogo:celeste"] = 9_999_999_999_999
    post("/__putlib", {"email": "ana@ex.com", "data": cur2})
    pg.evaluate("""() => { const d = JSON.parse(localStorage.getItem('hobby:v1')); d.entries['seed:jogo:hollow-knight'] = {itemId:'seed:jogo:hollow-knight', status:'quero', at:3}; d.ts['e:seed:jogo:hollow-knight'] = 5000; localStorage.setItem('hobby:v1', JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_selector("h1")
    conta(pg).get_by_role("button", name="Sincronizar agora").click()
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')")
    final = sorted(list(cloud()["libs"].values())[0]["data"]["lib"]["entries"])
    check("conflito junta os dois lados sem perder nada", "seed:jogo:celeste" in final and "seed:jogo:hollow-knight" in final, str(final))
    check("local também tem tudo", "seed:jogo:celeste" in local_ids(pg) and "seed:jogo:hollow-knight" in local_ids(pg))

    # falha do servidor: avisa, não mexe no local, e recupera depois
    before = local_ids(pg)
    post("/__fail", {"sync": True})
    conta(pg).get_by_role("button", name="Sincronizar agora").click()
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Não sincronizou')", timeout=8000)
    check("falha mostra aviso e mantém dados locais", local_ids(pg) == before)
    post("/__fail", {"sync": False})
    conta(pg).get_by_role("button", name="Sincronizar agora").click()
    pg.wait_for_function("document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)
    check("recupera quando o servidor volta", True)

    # sair mantém os dados locais; sessão persiste ao recarregar antes de sair
    pg.reload(); pg.wait_for_selector("h1")
    pg.wait_for_selector("text=Você está em")
    check("sessão sobrevive a recarregar a página", True)
    conta(pg).get_by_role("button", name="Sair").click()
    pg.wait_for_selector("#conta-email")
    check("sair mantém os dados no aparelho", local_ids(pg) == before)

    # criação com confirmação por e-mail, e-mail repetido, recuperar senha
    fill_login(pg, "confirma@ex.com", "senhaboa1", "Criar conta")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_selector("[data-testid=conta-msg]")
    check("conta que exige confirmação orienta a abrir o e-mail", "confirmação" in pg.get_by_test_id("conta-msg").inner_text())
    fill_login(pg, "confirma@ex.com", "senhaboa1", "Entrar")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_function("document.querySelector('[data-testid=conta-msg]')?.textContent.includes('Confirme')")
    check("entrar sem confirmar pede confirmação", True)
    fill_login(pg, "ana@ex.com", "outrasenha1", "Criar conta")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_function("document.querySelector('[data-testid=conta-msg]')?.textContent.includes('já tem conta')")
    check("e-mail repetido avisa", True)
    fill_login(pg, "ana@ex.com", None, "Esqueci a senha")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_function("document.querySelector('[data-testid=conta-msg]')?.textContent.includes('link')")
    check("recuperar senha envia pedido ao servidor", "ana@ex.com" in cloud()["recover"])

    # excluir meus dados com conta apaga a nuvem junto
    fill_login(pg, "ana@ex.com", "senhaboa1", "Entrar")
    conta(pg).locator("button[type=submit]").click()
    pg.wait_for_selector("text=Você está em")
    pg.get_by_role("button", name="Excluir meus dados").click()
    pg.get_by_role("button", name="Confirmar exclusão").click()
    pg.wait_for_selector("#conta-email", timeout=8000)
    c = cloud()
    check("excluir dados com conta apaga a conta na nuvem", "ana@ex.com" in c["deleted"] and not c["libs"])
    check("e limpa o aparelho", local_ids(pg) == [])
    check("sem erros de página", not errs, str(errs[:3]))
    b.close()

print("FALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
