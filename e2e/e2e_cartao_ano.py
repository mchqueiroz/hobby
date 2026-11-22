from playwright.sync_api import sync_playwright
B="http://localhost:3100"; fails=[]
def check(n,c):
    if not c: fails.append(n)
    print(("PASS " if c else "FAIL ")+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},locale="pt-BR",accept_downloads=True); pg=ctx.new_page()
    pg.goto(B+"/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_timeout(1500)
    pg.goto(B+"/retrospectiva"); pg.wait_for_selector("[data-testid=compartilhar-ano]")
    btn=pg.get_by_role("button",name="Baixar imagem")
    if btn.is_enabled():
        with pg.expect_download() as d: btn.click()
        dl=d.value; path=dl.path(); import shutil; shutil.copy(path,"/tmp/cartao_ano.png")
        raw=open(path,"rb").read(24)
        check("baixou PNG", raw[:8]==b"\x89PNG\r\n\x1a\n")
        w=int.from_bytes(raw[16:20],"big"); h=int.from_bytes(raw[20:24],"big")
        check("1080x1350", (w,h)==(1080,1350))
        check("nome do arquivo", dl.suggested_filename.startswith("retrospectiva-hobby-"))
    else:
        check("sem obras no ano: botão desligado e aviso", "Conclua algo" in pg.inner_text("[data-testid=compartilhar-ano]"))
print("FAILS:",fails)
