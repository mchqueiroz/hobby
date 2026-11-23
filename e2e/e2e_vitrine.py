# Lote do benchmark 2: vitrine, fila "A seguir", plataforma/formato, tempo dedicado e lista compartilhada por link.
from playwright.sync_api import sync_playwright
B="http://localhost:3100"; ok=0
def chk(c,m):
    print(("PASS " if c else "FAIL ")+m)
    global ok
    assert c,m; ok+=1
def obra(pg, id_): pg.goto(B+"/item/"+id_); pg.wait_for_selector("h1")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":390,"height":844},locale="pt-BR").new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B+"/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")

    # vitrine: fixa duas obras, a ordem do perfil segue a ordem em que foram fixadas
    for id_ in ["seed:jogo:hades", "seed:anime:cowboy-bebop"]:
        obra(pg, id_); pg.get_by_test_id("vitrine").click(); pg.wait_for_timeout(200)
    chk("Na vitrine" in pg.get_by_test_id("vitrine").inner_text(), "botão mostra que está na vitrine")
    pg.goto(B+"/perfil"); pg.wait_for_selector("[data-testid=vitrine-perfil]")
    v=pg.inner_text("[data-testid=vitrine-perfil]")
    chk("vitrine" in v.lower() and "favoritos" not in v.lower().split("\n")[0], "perfil troca 'Seus favoritos' por 'Vitrine'")
    chk(v.index("Hades") < v.index("Cowboy Bebop"), "vitrine na ordem em que foi fixada")

    # fila: só aparece para "quero"; Início mostra em ordem; subir e começar
    obra(pg, "seed:anime:cowboy-bebop"); chk(pg.get_by_test_id("fila").count()==0, "concluído não oferece 'A seguir'")
    for id_ in ["seed:filme:bacurau", "seed:livro:neuromancer"]:
        obra(pg, id_); pg.get_by_test_id("fila").click(); pg.wait_for_timeout(200)
    pg.goto(B+"/inicio"); pg.wait_for_selector("[data-testid=a-seguir]")
    t=pg.inner_text("[data-testid=a-seguir]")
    chk(t.index("Bacurau") < t.index("Neuromancer"), "A seguir na ordem da fila")
    pg.get_by_role("button", name="Subir Neuromancer na fila").click(); pg.wait_for_timeout(200)
    t=pg.inner_text("[data-testid=a-seguir]")
    chk(t.index("Neuromancer") < t.index("Bacurau"), "subir troca a ordem")
    pg.locator("[data-testid=a-seguir]").get_by_role("button", name="Começar Neuromancer").click(); pg.wait_for_timeout(300)
    chk("Neuromancer" not in pg.inner_text("[data-testid=a-seguir]"), "começar tira da fila")

    # plataforma: escolhe na obra e filtra na Biblioteca
    obra(pg, "seed:jogo:hades"); pg.select_option("#formato", "Switch"); pg.wait_for_timeout(200)
    pg.goto(B+"/biblioteca"); pg.wait_for_selector("h1")
    pg.click("text=Época, estilo e ordem"); pg.wait_for_timeout(200)
    pg.locator("details").get_by_role("button", name="Switch").first.click(); pg.wait_for_timeout(300)
    lst=pg.inner_text("ul.cols2")
    chk("Hades" in lst and "Cowboy Bebop" not in lst, "filtro de plataforma mostra só o jogo no Switch")

    # tempo dedicado
    pg.goto(B+"/estatisticas"); pg.wait_for_selector("[data-testid=tempo]")
    tt=pg.inner_text("[data-testid=tempo]")
    chk(" h" in tt and "Estimativa" in tt, "estatísticas mostram tempo dedicado com nota de estimativa")

    # lista compartilhada: cria, gera link, abre em outro aparelho (contexto limpo) e salva cópia
    pg.goto(B+"/listas"); pg.wait_for_selector("h1")
    pg.fill("form input", "Fim de semana"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    lid=pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('hobby:v1')).lists)[0]")
    for id_ in ["seed:jogo:hades", "seed:livro:o-hobbit"]:
        obra(pg, id_); pg.get_by_role("button", name="Fim de semana").click(); pg.wait_for_timeout(200)
    pg.goto(B+"/listas/"+lid); pg.wait_for_selector("[data-testid=compartilhar-lista]")
    pg.evaluate("Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })")
    pg.context.grant_permissions(["clipboard-read", "clipboard-write"])
    pg.get_by_test_id("compartilhar-lista").click(); pg.wait_for_timeout(300)
    link=pg.evaluate("navigator.clipboard.readText()")
    chk("/listas/ver#d=" in link, "link copiado com a lista no fragmento")
    other=b.new_context(viewport={"width":390,"height":844},locale="pt-BR").new_page()
    other.goto(link); other.wait_for_selector("[data-testid=lista-compartilhada]")
    chk(other.inner_text("[data-testid=lista-compartilhada]")=="Fim de semana" and "O Hobbit" in other.inner_text("main"), "outro aparelho vê a lista")
    other.click("text=Salvar uma cópia nas minhas listas"); other.wait_for_url("**/listas/l*")
    chk(other.evaluate("Object.values(JSON.parse(localStorage.getItem('hobby:v1')).lists)[0].itemIds.length")==2, "cópia salva com os 2 itens")
    other.goto(B+"/listas/ver#d=lixo"); other.wait_for_selector("text=Link de lista inválido")
    chk(True, "link estragado mostra aviso em vez de quebrar")

    chk(not errs, "sem erros de página: "+"; ".join(errs[:2]))
    print(ok,"ok")
