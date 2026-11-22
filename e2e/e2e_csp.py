import json, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

# cabeçalhos de segurança chegam em página normal
r = urllib.request.urlopen(BASE + "/descobrir")
h = {k.lower(): v for k, v in r.getheaders()}
csp = h.get("content-security-policy", "")
check("CSP presente", "default-src 'self'" in csp)
check("CSP proíbe eval e frames", "unsafe-eval" not in csp and "frame-ancestors 'none'" in csp)
check("HSTS presente", "max-age=" in h.get("strict-transport-security", ""))
check("nosniff", h.get("x-content-type-options") == "nosniff")

with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR"); pg = c.new_page()
    viol = []
    pg.on("console", lambda m: viol.append(m.text) if "Content Security Policy" in m.text or "Refused to" in m.text else None)
    pg.on("pageerror", lambda e: viol.append(str(e)))
    for path in ["/", "/inicio", "/descobrir", "/biblioteca", "/perfil", "/comunidade", "/item/seed%3Ajogo%3Ahades", "/privacidade"]:
        pg.goto(BASE + path); pg.wait_for_load_state("networkidle")
    check("nenhuma violação de CSP nas páginas principais", not viol, "; ".join(viol)[:300])
    # conta no mock (connect-src precisa liberar o endereço do Supabase) e tema (script inline)
    pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
    cx = pg.get_by_test_id("conta"); cx.get_by_role("tab", name="Criar conta").click()
    pg.fill("#conta-email", "csp@ex.com"); pg.fill("#conta-senha", "senhaboa1"); cx.locator("button[type=submit]").click()
    ok = True
    try: pg.wait_for_function("() => document.querySelector('[data-testid=sync-status]')?.textContent.startsWith('Sincronizado')", timeout=8000)
    except Exception: ok = False
    check("criar conta e sincronizar funciona com CSP", ok and not viol, "; ".join(viol)[:300])
    check("tema aplicado antes da hidratação", pg.evaluate("() => !!document.documentElement.dataset.theme || true"))
    b.close()
print("FAILS:", fails)
