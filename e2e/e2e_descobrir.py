from playwright.sync_api import sync_playwright
B="http://localhost:3100"; ok=0
def chk(c,m):
    print(("PASS " if c else "FAIL ")+m)
    global ok
    assert c,m; ok+=1
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":390,"height":844},locale="pt-BR").new_page()
    asked=[]
    pg.on("request", lambda r: asked.append(r.url) if "/api/discover" in r.url else None)
    pg.goto(B+"/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.wait_for_selector("ul.cols2 li.card"); pg.wait_for_timeout(1200)
    cards=lambda: pg.locator("ul.cols2 li.card")
    n=cards().count()
    chk(n==5,f"mostra 5 sugestões ({n})")
    chk(all("Porque você" in t or "Combina com" in t for t in cards().locator("p").all_inner_texts() if t.startswith(("Porque","Combina"))),"todas explicam o motivo")
    chk(pg.get_by_test_id("aposta").count()==1,"uma e só uma aposta")
    chk("Foge um pouco" in pg.locator("main").inner_text(),"a aposta diz por que é aposta")
    last=cards().nth(n-1)
    chk(last.get_by_test_id("aposta").count()==1,"a aposta é a última da lista")
    chk(any("page=1" in u for u in asked),"pediu a página 1 de candidatos")
    # a ordem: sugestões antes do sorteio
    html=pg.locator("main").inner_html()
    chk(html.index("Quero ")<html.index("O que ver hoje?"),"sugestões vêm antes do 'O que ver hoje?'")
    # mostrar mais
    ids=[c.locator("a").first.inner_text() for c in cards().all()]
    pg.get_by_test_id("mais-sugestoes").click(); pg.wait_for_timeout(1200)
    n2=cards().count()
    chk(n2>n,f"mostrar mais traz mais sugestões ({n} -> {n2})")
    chk(any("page=2" in u for u in asked),"pediu a página 2 de candidatos")
    titles=[c.locator("a").first.inner_text() for c in cards().all()]
    chk(len(set(titles))==len(titles),"nenhuma sugestão repetida")
    chk(pg.get_by_test_id("aposta").count()<=1,"continua no máximo uma aposta")
    # salvar um quero ver e achar na biblioteca sem mexer em filtro
    first=cards().first.locator("a").first.inner_text()
    cards().first.get_by_role("button",name="Quero").click(); pg.wait_for_timeout(300)
    pg.goto(B+"/biblioteca"); pg.wait_for_selector("[data-testid=resumo]")
    chk(first in pg.locator("ul.cols2").inner_text(),"o que acabou de ir para 'quero' aparece na Biblioteca sem trocar de filtro")
    print(ok,"ok")
