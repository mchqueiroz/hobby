from playwright.sync_api import sync_playwright
B="http://localhost:3100"; ok=0
def chk(c,m):
    print(("PASS " if c else "FAIL ")+m)
    global ok
    assert c,m; ok+=1
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":390,"height":844},locale="pt-BR").new_page()
    pg.goto(B+"/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const l=JSON.parse(localStorage.getItem('hobby:v1'));const e=l.entries['seed:anime:haikyu'];e.status='pausei';e.at=Date.now();localStorage.setItem('hobby:v1',JSON.stringify(l));}""")
    pg.goto(B+"/inicio"); pg.wait_for_selector("[data-testid=retomar]")
    chk("Retomar" in pg.inner_text("[data-testid=retomar]"),"bloco Retomar")
    pg.goto(B+"/biblioteca"); pg.get_by_role("button",name="Pausei").first.click(); pg.wait_for_timeout(300)
    chk("Pausei" in pg.inner_text("main"),"filtro e rótulo Pausei")
    pg.goto(B+"/inicio"); pg.wait_for_selector("[data-testid=retomar]")
    pg.locator("[data-testid=retomar] button").first.click(); pg.wait_for_timeout(500)
    chk(pg.locator("[data-testid=retomar]").count()==0,"sai de Retomar ao retomar")
    print(ok,"ok")
