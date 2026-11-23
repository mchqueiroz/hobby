import json, re, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"; MOCK = "http://localhost:4010"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))
def api(path): return json.load(urllib.request.urlopen(BASE + path))
def events(): return json.load(urllib.request.urlopen(MOCK + "/__events"))

# API direta
r = api("/api/search?q=dune")
ids = [i["id"] for i in r["items"]]
check("search junta as 5 mídias (música saiu do app)", ids == ["anilist:777001", "anilist:manga:888001", "openlibrary:OL777W", "igdb:119133", "tmdb:movie:438631", "tmdb:tv:85552"], str(ids))
check("search: sources ok (Steam desligada quando há IGDB)", r["sources"] == {"tmdb": "ok", "igdb": "ok", "steam": "off", "anilist": "ok", "openlibrary": "ok", "musicbrainz": "off"}, str(r["sources"]))
mg = next(i for i in r["items"] if i["id"] == "anilist:manga:888001")
check("mangá mapeado (mídia, id com tipo)", mg["media"] == "manga" and "ficção científica" in mg["vibes"], str(mg))
check("nenhum álbum na busca", not any(i["media"] == "musica" for i in r["items"]))
bk = next(i for i in r["items"] if i["id"] == "openlibrary:OL777W")
check("livro mapeado (autor, ano, capa, vibes, nota)", bk["media"] == "livro" and bk["author"] == "Frank Mock" and bk["year"] == 1949 and "covers.openlibrary.org" in bk["cover"] and "ficção científica" in bk["vibes"] and bk["quality"] == 8.2, str(bk))
tm = next(i for i in r["items"] if i["id"] == "tmdb:movie:438631")
check("TMDB mapeado (filme, ano, vibes)", tm["media"] == "filme" and tm["year"] == 2021 and "ficção científica" in tm["vibes"], str(tm))
check("pessoa do TMDB descartada", not any("777" == i["id"].split(":")[-1] for i in r["items"]))
r = api("/api/search?q=boom")
check("TMDB 500 não derruba as outras fontes", r["sources"]["tmdb"] == "error" and r["sources"]["igdb"] == "ok", str(r["sources"]))
check("q curto devolve vazio", api("/api/search?q=a")["items"] == [])
d = api("/api/discover?vibes=" + urllib.request.quote("ficção científica,psicológico"))
dids = sorted(i["id"] for i in d["items"])
check("discover traz todas as fontes", dids == ["anilist:777002", "anilist:manga:888002", "igdb:1942", "openlibrary:OL778W", "tmdb:movie:603", "tmdb:tv:1396"], str(dids))
check("discover ignora vibes inválidas", api("/api/discover?vibes=xxx")["items"] == [])

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto(BASE + "/importar")
    pg.wait_for_selector("text=Ajude no teste do Hobby")
    cb = pg.get_by_label("Aceito enviar métricas anônimas de uso")
    check("consentimento começa desligado", not cb.is_checked())

    # registrar sem consentimento: nada é enviado
    pg.fill("#user", "mockuser"); pg.click("text=Importar anime"); pg.wait_for_selector("text=Importação concluída")
    check("sem consentimento nenhum evento enviado", events() == [], str(events()))

    # busca remota no registro
    pg.click("text=Escolher favoritos de jogos e filmes"); pg.wait_for_url("**/favoritos")
    [pg.click(f'button[aria-label="{t}"]') for t in ["Hades, Jogo", "Hollow Knight, Jogo", "Cidade de Deus, Filme ou série"]]; pg.click("text=Continuar (3/5)"); pg.wait_for_url("**/descobrir")
    pg.wait_for_selector("li.card"); pg.wait_for_timeout(1500)
    titles = [pg.locator("li.card").nth(i).locator("a").first.inner_text() for i in range(pg.locator("li.card").count())]
    print("   sugestões:", titles)
    # itens das APIs entram no mesmo ranking: filtra anime e dispensa as sugestões do catálogo base até o remoto aparecer
    pg.click("text=Anime")
    seen_remote = False
    for _ in range(20):
        pg.wait_for_timeout(250)
        names = pg.locator("li.card a").all_inner_texts()
        if "Ergo Proxy" in names: seen_remote = True; break
        if not names: break
        pg.locator("button", has_text="Não é pra mim").first.click()
    check("sugestão vinda do AniList aparece no ranking com motivo", seen_remote)
    if seen_remote:
        card = pg.locator("li.card", has_text="Ergo Proxy")
        check("sugestão remota explica o motivo", "Porque você" in card.inner_text() or "Combina" in card.inner_text(), card.inner_text())
        card.locator("a").first.click(); pg.wait_for_selector("text=Ergo Proxy")
        check("página do item remoto abre", pg.locator("text=Item não encontrado").count() == 0)

    # liga consentimento nos ajustes
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("text=Ajude no teste do Hobby")
    pg.get_by_label("Aceito enviar métricas anônimas de uso").check()
    pg.goto(BASE + "/descobrir"); pg.wait_for_selector("li.card")
    pg.locator("button", has_text="Não é pra mim").first.click()
    pg.wait_for_timeout(800)
    ev = events()
    types = [e["type"] for e in ev]
    check("com consentimento eventos chegam", "rec_dismiss" in types, str(types))
    check("evento tem código anônimo e sem títulos", len(ev) > 0 and all(len(e["participant"]) == 36 for e in ev) and "title" not in json.dumps(ev).lower(), json.dumps(ev)[:300])

    # busca remota via folha de registro
    pg.click('button[aria-label="Registrar um item"]')
    pg.fill("#busca", "dune")
    pg.wait_for_selector("text=Elden Ring", timeout=5000)
    check("registro mostra resultados remotos", pg.locator("text=Duna").count() > 0 and pg.locator("text=Psycho-Pass").count() > 0)

    # excluir dados esquece o participante
    n_before = len(events())
    pg.keyboard.press("Escape")
    pg.goto(BASE + "/ajustes")
    pg.click("text=Excluir meus dados"); pg.click("text=Confirmar exclusão"); pg.wait_for_timeout(300)
    check("excluir dados remove código e consentimento", pg.evaluate("[localStorage.getItem('hobby:pid'), localStorage.getItem('hobby:consent')]") == [None, None])
    check("sem erros de página", not errs, str(errs))
    b.close()


# capas reais
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    asked = []
    def img(route):
        asked.append(route.request.url)
        route.fulfill(status=200, content_type="image/png", body=PNG)
    for host in ("image.tmdb.org", "images.igdb.com", "s4.anilist.co", "coverartarchive.org", "covers.openlibrary.org"):
        ctx.route(f"https://{host}/**", img)
    pg = ctx.new_page()
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.goto(BASE + "/biblioteca"); pg.wait_for_selector(".cover")
    # a biblioteca fica abaixo do cartão e da vitrine no perfil, e as capas carregam ao aparecer
    pg.locator("ul.cols2 li", has_text="Blade Runner").scroll_into_view_if_needed()
    pg.wait_for_function("(localStorage.getItem('hobby:covers')||'').includes('blade-runner') && [...document.querySelectorAll('.cover img')].filter(i => i.naturalWidth > 0).length >= 2", timeout=10000)
    check("capas de pôster aparecem na biblioteca", any("image.tmdb.org/t/p/w342/br.jpg" in u for u in asked), str(asked))
    check("capa de jogo vem do IGDB", any("images.igdb.com/igdb/image/upload/t_cover_big/hadescover.jpg" in u for u in asked), str(asked))
    n = pg.evaluate("document.querySelectorAll('.cover img').length")
    check("capas reais convivem com as geradas (sem falha de layout)", n >= 2 and pg.evaluate("document.querySelectorAll('.cover').length") > n, str(n))
    saved = pg.evaluate("JSON.parse(localStorage.getItem('hobby:covers')||'{}')")
    check("capas ficam guardadas no aparelho", "seed:filme:blade-runner" in saved, str(saved))
    # imagem quebrada cai para a capa gerada
    ctx.unroute("https://image.tmdb.org/**"); ctx.route("https://image.tmdb.org/**", lambda r: r.fulfill(status=404))
    pg.reload(); pg.wait_for_selector(".cover"); pg.wait_for_timeout(800)
    t = pg.locator(".cover", has_text="Blade Runner").first
    check("pôster quebrado mantém o título da capa gerada", t.count() == 1 and t.locator("img").count() == 0, "")
    b.close()

# importação por arquivo
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR").new_page()
    FX = "e2e/fixtures/"
    pg.goto(BASE + "/importar")
    pg.set_input_files('input[aria-label="Arquivo do MyAnimeList"]', FX + "ratings.csv")
    pg.wait_for_selector("#erro-mal")
    check("MAL: arquivo errado dá erro claro", "animelist.xml" in pg.inner_text("#erro-mal"), pg.inner_text("#erro-mal"))
    pg.set_input_files('input[aria-label="Arquivo do MyAnimeList"]', FX + "animelist.xml")
    pg.wait_for_selector("text=Importação concluída")
    txt = re.sub(r"\s+", " ", pg.inner_text("section[aria-live=polite]"))
    check("MAL: 4 animes encontrados no AniList", "4 animes" in txt, txt)
    check("MAL: avisa o que ficou de fora", "1 título não foi encontrado" in txt, txt)
    check("MAL: status corretos", "2 concluídos · 0 em andamento · 1 quero ver · 1 abandonado" in txt, txt)
    lib = pg.evaluate("JSON.parse(localStorage.getItem('hobby:v1'))")
    dn = lib["entries"].get("anilist:1535")
    check("MAL: nota 10 vira 5★ e dado entra com at=0", dn and dn["rating"] == 5 and dn["at"] == 0, str(dn))
    check("MAL: gêneros viraram vibes", "psicológico" in lib["items"]["anilist:1535"]["vibes"], str(lib["items"].get("anilist:1535")))

    pg2 = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR").new_page()
    pg2.goto(BASE + "/importar")
    pg2.set_input_files('input[aria-label="Arquivos do Letterboxd"]', [FX + "ratings.csv", FX + "watchlist.csv"])
    pg2.wait_for_selector("text=Importação concluída")
    txt = re.sub(r"\s+", " ", pg2.inner_text("section[aria-live=polite]"))
    check("Letterboxd: 3 filmes reconhecidos", "3 filmes" in txt, txt)
    check("Letterboxd: avisa o que o TMDB não achou", "1 não foi encontrado no TMDB" in txt, txt)
    check("Letterboxd: 2 concluídos e 1 quero ver", "2 concluídos · 0 em andamento · 1 quero ver" in txt, txt)
    lib = pg2.evaluate("JSON.parse(localStorage.getItem('hobby:v1'))")
    cd = lib["entries"].get("tmdb:movie:598")
    check("Letterboxd: nota 5 mantida e marcado como Brasil", cd and cd["rating"] == 5 and lib["items"]["tmdb:movie:598"].get("brazil") is True, str(cd))
    b.close()

print(f"\n{len(fails)} falhas" if fails else "\nTUDO OK")
raise SystemExit(1 if fails else 0)
