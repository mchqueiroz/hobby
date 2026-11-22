import json, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
ID = "11111111-1111-4111-8111-111111111111"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))
def api(path): return json.load(urllib.request.urlopen(BASE + path))

d = api("/api/details?id=" + urllib.parse.quote(f"musicbrainz:{ID}") + "&title=Disco%20Mock&media=musica")["details"]
check("álbum: detalhes com tipo, ano e tags", d and d["facts"][:2] == ["Álbum", "1997"] and "alternative rock" in d["facts"], str(d))
check("álbum: artista em 'makers'", d and d["makers"] == ["Banda Mock"], str(d))
d2 = api("/api/details?id=seed:musica:x&title=Disco%20Mock&media=musica&artist=Banda%20Mock")["details"]
check("álbum do catálogo base acha os detalhes por título e artista", d2 and d2["makers"] == ["Banda Mock"], str(d2))
c = api("/api/cover?title=Disco%20Mock&media=musica&artist=Banda%20Mock&year=1997")
check("capa de álbum vem do Cover Art Archive", c["url"] and c["url"].startswith("https://coverartarchive.org/release-group/" + ID), str(c))
check("id que não é MBID não vira caminho de consulta (cai na busca por título)", api("/api/details?id=musicbrainz:../../etc&title=Nada&media=musica")["details"] is None)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")

    check("Descobrir tem o filtro de álbuns", pg.locator("button.chip", has_text="Álbuns").count() == 1)
    pg.locator("button.chip", has_text="Álbuns").click(); pg.wait_for_timeout(400)
    tags = [t for t in pg.locator("main .tag").all_inner_texts() if t not in ("Brasil", "Aposta")]
    check("filtro de álbuns: há sugestões e só de álbuns", len(tags) > 0 and set(tags) == {"Álbum"}, str(tags))
    check("sugestão de álbum mostra o artista", pg.locator("main").inner_text().count("·") >= 0)

    pg.goto(BASE + "/buscar"); pg.wait_for_selector("#busca-global")
    pg.fill("#busca-global", "disco mock")
    pg.wait_for_selector("li >> text=Disco Mock")
    check("busca mostra o álbum e não o ao vivo", pg.locator("li", has_text="Disco Mock").count() >= 1 and pg.locator("text=Ao Vivo").count() == 0)
    pg.get_by_role("button", name="Quero ouvir Disco Mock").click()
    ent = pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:v1')).entries")
    check("álbum entra na biblioteca", ent.get(f"musicbrainz:{ID}", {}).get("status") == "quero")

    pg.goto(BASE + "/item/" + urllib.parse.quote(f"musicbrainz:{ID}", safe="")); pg.wait_for_selector("h1")
    txt = pg.locator("main").inner_text()
    check("página do álbum mostra o artista", "Banda Mock" in txt)
    pg.wait_for_timeout(600)
    check("detalhes do álbum aparecem", "alternative rock" in pg.locator("main").inner_text())
    pg.screenshot(path="/tmp/hobby-shots/m1_album.png")

    # catálogo base: capa e detalhes consultam com o artista
    pg.goto(BASE + "/item/" + urllib.parse.quote("seed:musica:ok-computer", safe="")); pg.wait_for_selector("h1")
    check("álbum do catálogo base mostra artista", "Radiohead" in pg.locator("main").inner_text())

    # registrar e marcar progresso
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector("h1")
    pg.locator("button.chip", has_text="Quero ver").click()
    pg.locator("button.chip", has_text="Álbuns").click()
    check("biblioteca filtra por álbuns", pg.locator("text=Disco Mock").count() > 0)
    check("sem erros de console", not errs, str(errs[:3]))
    check("sem rolagem horizontal", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    b.close()

print("\nFALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
