import base64, io, json, os
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
OUT = "/tmp/hobby-shots"; os.makedirs(OUT, exist_ok=True)
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

# imagens de teste: esquerda vermelha, direita azul (para provar o enquadramento)
def two_tone(w, h):
    im = Image.new("RGB", (w, h), (220, 20, 20))
    im.paste((20, 20, 220), (w // 2, 0, w, h))
    return im
wide = "/tmp/wide.png"; two_tone(1600, 900).save(wide)
# JPEG "de celular": com EXIF (orientação 6 e GPS)
exif = Image.Exif(); exif[274] = 6; exif[0x8825] = {1: "S", 2: (23.0, 33.0, 0.0), 3: "W", 4: (46.0, 38.0, 0.0)}; exif[271] = "CameraMaker"
phone = "/tmp/phone.jpg"; two_tone(1200, 800).save(phone, exif=exif.tobytes() if hasattr(exif, "tobytes") else exif, quality=90)
svg = "/tmp/x.svg"; open(svg, "w").write('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
huge = "/tmp/huge.png"; open(huge, "wb").write(b"\x89PNG\r\n\x1a\n" + b"0" * (11 * 1024 * 1024))

def profile(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('hobby:profile') || 'null')")
def pixel(pg, data, fx, fy):
    return pg.evaluate("""([d, fx, fy]) => new Promise(ok => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const x = c.getContext('2d'); x.drawImage(i, 0, 0); const p = x.getImageData(Math.floor(i.width*fx), Math.floor(i.height*fy), 1, 1).data; ok([i.width, i.height, p[0], p[1], p[2]]); }; i.src = d; })""", [data, fx, fy])

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.goto(BASE + "/perfil"); pg.wait_for_selector(".hero")
    check("hero tem banner e avatar com botões de edição", pg.get_by_role("button", name="Alterar banner").count() == 1 and pg.get_by_role("button", name="Alterar foto de perfil").count() == 1)
    check("sem foto: avatar mostra iniciais e banner é automático", pg.locator(".avatar").get_attribute("data-photo") == "nao" and pg.locator(".hero-banner").get_attribute("data-banner") == "auto")
    pg.screenshot(path=f"{OUT}/f1_hero_vazio.png")

    # ---------- avatar
    pg.get_by_role("button", name="Alterar foto de perfil").click()
    dlg = pg.locator("[role=dialog]"); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(svg)
    dlg.locator("[role=alert]").wait_for()
    check("SVG é recusado com mensagem", "JPG, PNG ou WebP" in dlg.locator("[role=alert]").inner_text())
    pg.locator('[data-testid="file-avatar"]').set_input_files(huge)
    check("arquivo grande demais é recusado", "grande demais" in dlg.locator("[role=alert]").inner_text())
    check("nada foi salvo após recusas", profile(pg) is None)

    pg.locator('[data-testid="file-avatar"]').set_input_files(wide)
    pg.wait_for_selector("canvas.crop-avatar")
    check("aparecem zoom, horizontal e vertical", all(dlg.get_by_label(t).count() == 1 for t in ["Zoom", "Horizontal", "Vertical"]))
    pg.screenshot(path=f"{OUT}/f2_editor_avatar.png")
    # enquadra à esquerda (vermelho)
    dlg.get_by_label("Horizontal").fill("-1")
    dlg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("[role=dialog]", state="detached")
    pr = profile(pg)
    check("avatar salvo como JPEG", pr and pr["avatar"].startswith("data:image/jpeg;base64,"), str(pr)[:100])
    w, h, r, g, bl = pixel(pg, pr["avatar"], .5, .5)
    check("avatar 320x320, enquadrado no lado vermelho", (w, h) == (320, 320) and r > 180 and bl < 80, f"{(w,h,r,g,bl)}")
    check("hero mostra a foto", pg.locator(".avatar").get_attribute("data-photo") == "sim")
    pg.screenshot(path=f"{OUT}/f3_hero_foto.png")

    # trocar: agora o lado azul, com zoom
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(wide); pg.wait_for_selector("canvas.crop-avatar")
    dlg.get_by_label("Horizontal").fill("1"); dlg.get_by_label("Zoom").fill("2")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    w, h, r, g, bl = pixel(pg, profile(pg)["avatar"], .5, .5)
    check("segunda foto enquadrada no azul", bl > 180 and r < 80, f"{(r,g,bl)}")

    # EXIF removido e rotação aplicada
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(phone); pg.wait_for_selector("canvas.crop-avatar")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    raw = base64.b64decode(profile(pg)["avatar"].split(",", 1)[1])
    check("EXIF/GPS não vai junto (sem 'Exif' no arquivo)", b"Exif" not in raw and b"GPS" not in raw and b"CameraMaker" not in raw)
    im = Image.open(io.BytesIO(raw)); check("imagem guardada é JPEG 320x320", im.format == "JPEG" and im.size == (320, 320), str(im.size))

    # remover foto
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    dlg.get_by_role("button", name="Remover foto").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    check("remover foto volta às iniciais", pg.locator(".avatar").get_attribute("data-photo") == "nao" and "avatar" not in (profile(pg) or {}))

    # cor do avatar
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    dlg.get_by_role("button", name="Livro").click()
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    check("cor do avatar escolhida", (profile(pg) or {}).get("color") == "livro")
    bg = pg.locator(".avatar").evaluate("e => getComputedStyle(e).backgroundColor")
    check("avatar usa a cor de livro", bg == "rgb(154, 90, 18)", bg)

    # ---------- banner
    pg.get_by_role("button", name="Alterar banner").click(); dlg.wait_for()
    dlg.get_by_role("button", name="Jogo").click()
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    check("banner de degradê guardado", (profile(pg) or {}).get("banner") == {"kind": "media", "media": "jogo"})
    check("hero reflete o banner", pg.locator(".hero-banner").get_attribute("data-banner") == "media")
    pg.screenshot(path=f"{OUT}/f4_banner_degrade.png")

    pg.get_by_role("button", name="Alterar banner").click(); dlg.wait_for()
    pg.locator('[data-testid="file-banner"]').set_input_files(wide); pg.wait_for_selector("canvas.crop-banner")
    pg.screenshot(path=f"{OUT}/f5_editor_banner.png")
    dlg.get_by_label("Zoom").fill("2"); dlg.get_by_label("Horizontal").fill("-1")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    bn = profile(pg)["banner"]
    w, h, r, g, bl = pixel(pg, bn["data"], .5, .5)
    check("banner 1200x400 em JPEG, lado vermelho", bn["kind"] == "image" and (w, h) == (1200, 400) and r > 180, f"{(w,h,r,g,bl)}")
    check("hero mostra o banner enviado", pg.locator(".hero-banner").get_attribute("data-banner") == "image")
    pg.screenshot(path=f"{OUT}/f6_hero_completo.png", full_page=False)

    # persistência
    pg.reload(); pg.wait_for_selector(".hero")
    check("tudo persiste após recarregar", pg.locator(".hero-banner").get_attribute("data-banner") == "image" and (profile(pg) or {}).get("color") == "livro")

    # Esc fecha sem salvar
    before = json.dumps(profile(pg))
    pg.get_by_role("button", name="Alterar banner").click(); dlg.wait_for()
    dlg.get_by_role("button", name="Jogo").click(); pg.keyboard.press("Escape")
    check("Esc fecha sem alterar nada", pg.locator("[role=dialog]").count() == 0 and json.dumps(profile(pg)) == before)

    # formato antigo e dado adulterado
    pg.evaluate("() => localStorage.setItem('hobby:profile', JSON.stringify({name:'Ana', avatar:'javascript:alert(1)', banner:{kind:'image',data:'<svg onload=1>'}}))")
    pg.reload(); pg.wait_for_selector(".hero")
    check("dado adulterado é ignorado (nome fica, imagens não)", "Ana" in pg.locator(".hero").inner_text() and pg.locator(".avatar").get_attribute("data-photo") == "nao" and pg.locator(".hero-banner").get_attribute("data-banner") == "auto")

    # armazenamento cheio
    pg.evaluate("() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'hobby:profile') throw new DOMException('full', 'QuotaExceededError'); return s.call(this, k, v); }; }")
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(wide); pg.wait_for_selector("canvas.crop-avatar")
    dlg.get_by_role("button", name="Salvar").click()
    dlg.locator("[role=alert]").wait_for()
    check("armazenamento cheio: mensagem clara e janela continua aberta", "não deixou guardar" in dlg.locator("[role=alert]").inner_text() and pg.locator("[role=dialog]").count() == 1)
    pg.keyboard.press("Escape")
    pg.reload(); pg.wait_for_selector(".hero")

    # ---------- cartão para compartilhar com foto e banner
    pg.evaluate("() => localStorage.removeItem('hobby:profile')")
    pg.reload(); pg.wait_for_selector(".hero")
    pg.get_by_role("button", name="Adicionar seu nome").click(); pg.fill("#nome", "Michael Cardoso"); pg.click("text=Salvar")
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(phone); pg.wait_for_selector("canvas.crop-avatar")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    pg.get_by_role("button", name="Alterar banner").click(); dlg.wait_for()
    pg.locator('[data-testid="file-banner"]').set_input_files(wide); pg.wait_for_selector("canvas.crop-banner")
    dlg.get_by_label("Horizontal").fill("0.4")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")  # o cartão para compartilhar fica nos Ajustes
    with pg.expect_download() as d: pg.get_by_role("button", name="Baixar imagem").click()
    path = d.value.path(); im = Image.open(path)
    check("cartão 1080x1350 gerado", im.size == (1080, 1350), str(im.size))
    im.save(f"{OUT}/f7_cartao_foto.png")
    # foto no círculo: o centro do avatar no cartão é vermelho/azul (foto), não a cor das iniciais
    cx, cy = 80 + 88, 230 + 6
    px = im.convert("RGB").getpixel((cx - 40, cy))
    check("cartão leva a foto no avatar", (px[0] > 150 and px[2] < 90) or (px[2] > 150 and px[0] < 90), str(px))
    bpx = im.convert("RGB").getpixel((540, 100))
    check("cartão leva o banner enviado (não o degradê)", abs(bpx[0] - bpx[2]) > 40, str(bpx))

    # cartão sem foto nem banner
    pg.evaluate("() => localStorage.removeItem('hobby:profile')"); pg.reload(); pg.wait_for_selector("h1")
    with pg.expect_download() as d: pg.get_by_role("button", name="Baixar imagem").click()
    im2 = Image.open(d.value.path()); im2.save(f"{OUT}/f8_cartao_padrao.png")
    check("cartão padrão (iniciais + degradê) também sai", im2.size == (1080, 1350))

    check("sem rolagem horizontal no celular", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    # excluir tudo apaga o perfil
    pg.goto(BASE + "/perfil"); pg.wait_for_selector(".hero")
    pg.get_by_role("button", name="Alterar foto de perfil").click(); dlg.wait_for()
    pg.locator('[data-testid="file-avatar"]').set_input_files(wide); pg.wait_for_selector("canvas.crop-avatar")
    dlg.get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[role=dialog]", state="detached")
    check("foto salva antes de excluir", bool((profile(pg) or {}).get("avatar")))
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("h1")
    pg.get_by_role("button", name="Excluir meus dados").click()
    pg.get_by_role("button", name="Confirmar exclusão").click()
    pg.wait_for_timeout(400)
    check("excluir os dados apaga foto e banner", profile(pg) is None, str(profile(pg))[:80])

    # tema escuro e telas largas
    pg.emulate_media(color_scheme="dark")
    pg.goto(BASE + "/perfil"); pg.wait_for_selector(".hero")
    pg.screenshot(path=f"{OUT}/f9_hero_escuro.png")
    pg2 = b.new_context(viewport={"width": 1100, "height": 800}, locale="pt-BR").new_page()
    pg2.goto(BASE + "/importar"); pg2.click("text=Ver com dados de exemplo"); pg2.wait_for_url("**/descobrir"); pg2.goto(BASE + "/perfil"); pg2.wait_for_selector(".hero")
    pg2.get_by_role("button", name="Alterar banner").click(); pg2.wait_for_selector("[role=dialog]")
    box = pg2.locator("[role=dialog]").bounding_box()
    check("janela de edição centrada e visível no desktop", box and box["x"] > 0 and box["y"] >= 0 and box["y"] + box["height"] <= 800, str(box))
    pg2.screenshot(path=f"{OUT}/f10_desktop_editor.png")
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()

print("\nFALHAS:", fails if fails else "nenhuma")
raise SystemExit(1 if fails else 0)
