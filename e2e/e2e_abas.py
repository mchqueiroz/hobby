import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def registrar(pg, busca, nota):
    pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", busca)
    pg.click('[role=dialog] button.result'); pg.click(f'[role=dialog] button[aria-label="Nota {nota}"]'); pg.wait_for_selector(".toast")
ents = lambda pg: json.loads(pg.evaluate("localStorage.getItem('hobby:v1')") or '{"entries":{}}')["entries"]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    A = ctx.new_page(); B = ctx.new_page()
    for pg in (A, B): pg.on("pageerror", lambda e: errs.append(str(e)))

    # ---- dado corrompido: não some, fica guardado ao lado
    A.goto(BASE + "/importar"); A.evaluate("localStorage.setItem('hobby:v1', '{quebrado')"); A.reload(); A.wait_for_selector("text=Ver com dados de exemplo")
    registrar_ok = True
    check("JSON quebrado: app abre sem travar", A.evaluate("document.body.innerText.length") > 20)
    # o caminho mais perigoso: gravar por cima sem ter lido (aqui, "dados de exemplo" direto da tela de importar)
    A.click("text=Ver com dados de exemplo"); A.wait_for_url("**/descobrir")
    check("o texto original foi guardado numa cópia antes de ser sobrescrito", A.evaluate("localStorage.getItem('hobby:v1:corrupt')") == "{quebrado")
    check("a biblioteca nova está válida", len(ents(A)) >= 10)

    # ---- duas abas
    A.goto(BASE + "/biblioteca"); A.wait_for_selector("h1")
    B.goto(BASE + "/biblioteca"); B.wait_for_selector("h1")
    n0 = B.locator("ul.cols2 li").count()
    registrar(A, "celeste", "4")
    B.wait_for_function(f"document.querySelectorAll('ul.cols2 li').length === {n0 + 1}", timeout=6000)
    check("aba B recebe o registro feito na aba A sem recarregar", B.locator("ul.cols2 li").count() == n0 + 1)
    registrar(B, "o nome da rosa", "5")
    A.wait_for_function(f"document.querySelectorAll('ul.cols2 li').length === {n0 + 2}", timeout=6000)
    check("aba A recebe o registro da aba B", A.locator("ul.cols2 li").count() == n0 + 2)
    ea, eb = ents(A), ents(B)
    check("as duas abas terminam com tudo e iguais", "seed:jogo:celeste" in ea and "seed:livro:o-nome-da-rosa" in ea and sorted(ea) == sorted(eb), f"{len(ea)} {len(eb)}")

    # registros simultâneos (cada aba grava o seu antes de ver o da outra) não se perdem
    A.evaluate("window.__a = 1"); 
    registrar(A, "death note", "3"); registrar(B, "monster", "2")
    A.wait_for_timeout(600); B.wait_for_timeout(600)
    ea = ents(A)
    check("registros quase simultâneos nas duas abas se somam", ea["seed:anime:death-note"]["rating"] == 3 and ea["seed:anime:monster"]["rating"] == 2)

    # ---- excluir tudo numa aba esvazia a outra e nada ressuscita
    A.goto(BASE + "/ajustes"); A.wait_for_selector("text=Seus dados")
    A.get_by_role("button", name="Excluir meus dados").click(); A.get_by_role("button", name="Confirmar exclusão").click()
    B.wait_for_selector("text=Sua biblioteca está vazia", timeout=6000)
    check("excluir tudo numa aba esvazia a outra", B.locator("text=Sua biblioteca está vazia").count() == 1)
    B.wait_for_timeout(800)
    check("nada ressuscita no armazenamento depois de excluir", len(ents(A)) == 0 and len(ents(B)) == 0)

    # ---- armazenamento cheio/bloqueado: a pessoa é avisada
    C = ctx.new_page(); C.on("pageerror", lambda e: errs.append(str(e)))
    C.goto(BASE + "/importar"); C.click("text=Ver com dados de exemplo"); C.wait_for_url("**/descobrir")
    check("sem aviso quando tudo funciona", C.get_by_test_id("aviso-armazenamento").count() == 0)
    C.evaluate("() => { window.__orig = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'hobby:v1') throw new DOMException('cheio', 'QuotaExceededError'); return window.__orig.call(this, k, v); }; }")
    C.goto(BASE + "/biblioteca") if False else None
    registrar(C, "celeste", "4")
    C.wait_for_selector("[data-testid=aviso-armazenamento]", timeout=5000)
    check("falha ao gravar mostra o aviso com caminho para exportar", "exporte seus dados" in C.get_by_test_id("aviso-armazenamento").inner_text())
    C.evaluate("() => { Storage.prototype.setItem = window.__orig; }")
    registrar(C, "hollow knight", "5")
    C.wait_for_selector("[data-testid=aviso-armazenamento]", state="detached", timeout=5000)
    check("aviso some quando volta a gravar", C.get_by_test_id("aviso-armazenamento").count() == 0)
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
