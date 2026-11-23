"""Auditoria automática de acessibilidade (axe-core) nas telas principais, em tema claro e escuro.
Falha em violações 'serious' e 'critical'. Isso pega só o que máquina consegue medir (contraste, rótulos, nomes de botão,
ARIA); não substitui testar com leitor de tela."""
import json, urllib.parse
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
AXE = open("node_modules/axe-core/axe.min.js").read()
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

PAGES = ["/", "/privacidade", "/termos", "/inicio", "/estatisticas", "/descobrir", "/biblioteca", "/buscar", "/diario", "/listas", "/estatisticas", "/retrospectiva", "/perfil", "/ajustes", "/comunidade", "/importar",
         "/item/" + urllib.parse.quote("seed:jogo:hades", safe=""), "/item/" + urllib.parse.quote("seed:anime:attack-on-titan", safe=""), "/nao-existe"]

def scan(pg, label):
    pg.add_script_tag(content=AXE)
    r = pg.evaluate("axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0,2).map(n => n.target.join(' ') + ' :: ' + (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '')) })))")
    bad = [v for v in r if v["impact"] in ("serious", "critical")]
    check(f"{label}: sem violações graves", not bad, json.dumps(bad, ensure_ascii=False)[:600])
    minor = [f'{v["id"]}({v["impact"]},{v["n"]})' for v in r if v not in bad]
    if minor: print("   (avisos menores: " + ", ".join(minor) + ")")

with sync_playwright() as p:
    b = p.chromium.launch()
    for theme in ["light", "dark"]:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", color_scheme=theme)
        pg = ctx.new_page()
        pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
        pg.evaluate(f"localStorage.setItem('hobby:theme','{theme}')")
        for path in PAGES:
            pg.goto(BASE + path); pg.wait_for_selector("body"); pg.wait_for_timeout(700)
            scan(pg, f"{theme} {path.split('/')[1] or '/'}{'/' + path.split('/')[2][:12] if path.count('/') > 1 else ''}")
        # folha de registro aberta
        pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1")
        pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca", "hades"); pg.click('[role=dialog] button.result'); pg.wait_for_timeout(400)
        scan(pg, f"{theme} folha de registro")
        ctx.close()
    b.close()
print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
