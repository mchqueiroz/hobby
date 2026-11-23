import struct
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

import importlib.util
_spec = importlib.util.spec_from_file_location("d", "e2e/e2e_diario.py")
# o verificador de contraste vive no e2e_diario; lê o texto e desfaz o escape de barras do Python
_src = open("e2e/e2e_diario.py").read()
JS = _src[_src.index('"""') + 3:_src.index('"""', _src.index('"""') + 3)].replace("\\\\", "\\")

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in [("celular", {"width": 390, "height": 844}), ("computador", {"width": 1280, "height": 800})]:
        ctx = b.new_context(viewport=vp, locale="pt-BR", accept_downloads=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)

        # perfil vazio
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
        t = pg.locator("main").inner_text()
        check(f"{label}: perfil vazio orienta e não quebra", "Registre algumas obras" in t)
        pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
        check(f"{label}: cartão bloqueado sem registros", pg.get_by_role("button", name="Baixar imagem").is_disabled())

        pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
        t = pg.locator("main").inner_text()
        check(f"{label}: arquétipo", "Você curte" in t)
        check(f"{label}: favoritos", pg.locator("#fav-t").count() == 1 and pg.locator("section[aria-labelledby=fav-t] li").count() >= 1)
        check(f"{label}: perfil sem conquistas e desafios", "Conquistas" not in t and "Desafios" not in t)
        check(f"{label}: biblioteca dentro do perfil", pg.locator('nav[aria-label="Seções do perfil"] a[aria-current=page]').inner_text() == "Biblioteca" and pg.locator("ul.cols2 li").count() >= 10)
        check(f"{label}: sem rolagem horizontal", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))

        # nome
        pg.get_by_role("button", name="Adicionar seu nome").click()
        pg.fill("#nome", "  Michael   Queiroz  "); pg.get_by_role("button", name="Salvar").click()
        check(f"{label}: nome salvo e normalizado", pg.locator("section.hero h2").inner_text() == "Michael Queiroz")
        check(f"{label}: iniciais no avatar", pg.locator(".avatar").inner_text() == "MQ")
        pg.reload(); pg.wait_for_selector("section.hero")
        check(f"{label}: nome persiste", pg.locator("section.hero h2").inner_text() == "Michael Queiroz")

        # cartão e meta ficam nos Ajustes
        pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
        check(f"{label}: meta do ano nos ajustes", "meta de" in pg.locator("main").inner_text().lower())
        with pg.expect_download() as dl:
            pg.get_by_role("button", name="Baixar imagem").click()
        path = dl.value.path()
        data = open(path, "rb").read()
        w, h = struct.unpack(">II", data[16:24])
        check(f"{label}: cartão é um PNG 1080×1350 de bom tamanho", data[:8] == b"\x89PNG\r\n\x1a\n" and (w, h) == (1080, 1350) and len(data) > 20000, f"{w}x{h} {len(data)}")
        if label == "celular": open("/tmp/hobby-cartao.png", "wb").write(data)

        # conexões (servidor de teste tem TMDB e IGDB configurados)
        pg.wait_for_selector("section[aria-labelledby=con-t] .pill.ok >> nth=2")
        c = pg.locator("section[aria-labelledby=con-t]").inner_text()
        check(f"{label}: conexões mostram TMDB e IGDB ativos", c.count("ativo\n") >= 3 and "desligado\nAniList" not in c and "desligado\nTMDB" not in c and "desligado\nIGDB" not in c, c)
        check(f"{label}: /api/status não vaza chave", "tmdbtoken" not in pg.evaluate("fetch('/api/status').then(r=>r.text())") and "csecret" not in pg.evaluate("fetch('/api/status').then(r=>r.text())"))

        # contraste em claro e escuro (no perfil)
        pg.goto(BASE + "/perfil"); pg.wait_for_selector("section.hero")
        for scheme in ["light", "dark"]:
            pg.emulate_media(color_scheme=scheme); pg.reload(); pg.wait_for_selector("section.hero")
            odd = pg.evaluate("""() => { const o=[]; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
              while(w.nextNode()){const el=w.currentNode.parentElement; if(!w.currentNode.textContent.trim()||!el) continue; const c=getComputedStyle(el).color; if(!/^rgba?\\(/.test(c)) o.push([el.tagName, el.className, c]);} return o.slice(0,4);}""")
            if odd: print("   cores fora de rgb:", odd)
            bad = pg.evaluate(JS)
            check(f"{label}/{scheme}: contraste AA no perfil", bad == [], str(bad[:4]))
            if label == "computador": pg.screenshot(path=f"/tmp/perfil_{scheme}.png", full_page=True)
        pg.emulate_media(color_scheme="light")

        # excluir apaga o nome
        pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
        pg.click("text=Excluir meus dados"); pg.click("text=Confirmar exclusão"); pg.wait_for_timeout(300)
        check(f"{label}: excluir apaga o nome", pg.evaluate("localStorage.getItem('hobby:profile')") is None)
        check(f"{label}: sem erros", errs == [], str(errs))
        ctx.close()
print("FALHAS:", fails)
raise SystemExit(1 if fails else 0)
