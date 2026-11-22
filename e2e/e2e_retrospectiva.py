import json, datetime
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))
ms = lambda y, m, d: int(datetime.datetime(y, m, d, 12).timestamp() * 1000)
def entry(i, status, date, rating=None):
    e = {"itemId": i, "status": status, "at": date, "date": date}
    if rating: e["rating"] = rating
    return e

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    pg = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR").new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto(BASE + "/retrospectiva"); pg.wait_for_selector("h1")
    check("sem registros: mensagem amigável e sem quebrar", "Ainda não há um ano para contar" in pg.locator("main").inner_text())

    lib = {"items": {}, "dismissed": [], "goal": 80, "lists": {}, "entries": {e["itemId"]: e for e in [
        entry("seed:jogo:hades", "concluido", ms(2026, 3, 5), 5),
        entry("seed:jogo:celeste", "concluido", ms(2026, 3, 20), 4.5),
        entry("seed:anime:death-note", "concluido", ms(2026, 7, 2), 4),
        entry("seed:anime:monster", "abandonei", ms(2026, 8, 1)),
        entry("seed:filme:parasita", "concluido", ms(2025, 12, 30), 4),
        {"itemId": "seed:livro:1984", "status": "concluido", "at": 0},
    ]}}
    pg.goto(BASE + "/importar"); pg.evaluate("d => localStorage.setItem('hobby:v1', JSON.stringify(d))", lib)
    pg.goto(BASE + "/estatisticas"); pg.wait_for_selector("text=Ver minha retrospectiva do ano")
    pg.get_by_role("link", name="Ver minha retrospectiva do ano").click(); pg.wait_for_url("**/retrospectiva")
    pg.wait_for_selector("[data-testid=resumo-ano]")
    check("abre no ano mais recente com a contagem certa", "3 obras concluídas" in pg.get_by_test_id("total-ano").inner_text(), pg.get_by_test_id("total-ano").inner_text())
    txt = pg.locator("main").inner_text()
    check("mês mais cheio e média", "março" in txt and "nota média 4,5" in txt.replace("★", "") or "4.5" in txt, txt[:300])
    check("abandonados aparecem sem entrar na conta", "Largou 1" in txt)
    check("melhores notas em ordem (Hades primeiro)", pg.get_by_test_id("melhores").locator("li").first.inner_text().startswith("1") and "Hades" in pg.get_by_test_id("melhores").locator("li").first.inner_text())
    check("avisa sobre item sem data", "sem data" in txt)
    pg.get_by_role("button", name="2025").click()
    pg.wait_for_function("document.querySelector('[data-testid=total-ano]').innerText.includes('1 obra concluída')")
    check("trocar de ano muda o resumo", "1 obra concluída" in pg.get_by_test_id("total-ano").inner_text())
    check("página não rola na horizontal", pg.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"))
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()
print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
