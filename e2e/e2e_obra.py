import io, re
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
ITEM = BASE + "/item/" + "seed%3Afilme%3Ablade-runner"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def png(rgb):
    b = io.BytesIO(); Image.new("RGB", (40, 60), rgb).save(b, "PNG"); return b.getvalue()

JS = """
() => {
  const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const p=m[1].split(',').map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const lum = ({r,g,b}) => { const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const bgOf = el => { while(el){ const c=parse(getComputedStyle(el).backgroundColor); if(c&&c.a>0.9) return c; el=el.parentElement;} return {r:255,g:255,b:255,a:1}; };
  const bad=[]; const seen=new Set();
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){ const n=w.currentNode; if(!n.textContent.trim()) continue; const el=n.parentElement; if(!el||seen.has(el)) continue; seen.add(el);
    const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none') continue;
    const fg=parse(cs.color), bg=bgOf(el); const l1=lum(fg),l2=lum(bg); const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700; const need=(size>=24||(size>=18.66&&bold)||el.closest('.stars'))?3:4.5;
    if(ratio<need) bad.push([el.textContent.trim().slice(0,30), ratio.toFixed(2), cs.color, `${bg.r},${bg.g},${bg.b}`]); }
  return bad;
}
"""

def hue(css):
    r, g, b = [int(x) for x in re.findall(r"\d+", css)[:3]]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn: return -1
    d = mx - mn
    h = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return h * 60

with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ("light", "dark"):
        # 1) capa legível (com CORS): usa a cor da capa. Azul.
        ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", color_scheme=scheme)
        ctx.route("https://image.tmdb.org/**", lambda r: r.fulfill(status=200, content_type="image/png", body=png((30, 80, 200)), headers={"access-control-allow-origin": "*"}))
        pg = ctx.new_page()
        pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
        pg.goto(ITEM); pg.wait_for_selector('.obra[data-tone="capa"]', timeout=10000)
        acc = pg.evaluate("getComputedStyle(document.querySelector('.obra')).getPropertyValue('--obra-accent')")
        # o CSS resolve var() dentro de var(): lê direto o botão
        btn = pg.evaluate("getComputedStyle(document.querySelector('.obra .btn:not(.ghost)')).backgroundColor")
        h = hue(btn)
        check(f"[{scheme}] botão da obra pega o azul da capa", 205 <= h <= 235, f"{btn} h={h}")
        wash = pg.evaluate("getComputedStyle(document.querySelector('.obra')).backgroundImage")
        check(f"[{scheme}] fundo da obra é um degradê tingido", "linear-gradient" in wash, wash[:80])
        bad = pg.evaluate(JS)
        check(f"[{scheme}] contraste do texto na página da obra", bad == [], str(bad))
        pg.screenshot(path=f"/tmp/obra_{scheme}_azul.png")
        ctx.close()

    # 2) capa sem permissão de leitura (sem CORS): cai nas vibes, e ainda assim colore
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", color_scheme="light")
    # a tag <img> comum carrega; a leitura com CORS (para amostrar cores) é recusada, como num servidor sem o cabeçalho
    ctx.route("https://image.tmdb.org/**", lambda r: r.abort() if "origin" in r.request.headers else r.fulfill(status=200, content_type="image/png", body=png((200, 30, 30))))
    pg = ctx.new_page()
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.goto(ITEM); pg.wait_for_selector('.cover img', timeout=10000)
    pg.wait_for_timeout(1500)
    check("sem CORS usa o tom das vibes", pg.locator('.obra[data-tone="vibes"]').count() == 1)
    pg.screenshot(path="/tmp/obra_vibes.png")
    ctx.close()

    # 3) sem capa nenhuma (fonte desligada/erro): vibes, sem erro de página
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    ctx.route("https://image.tmdb.org/**", lambda r: r.fulfill(status=404))
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    pg.goto(ITEM); pg.wait_for_selector(".obra"); pg.wait_for_timeout(800)
    check("capa quebrada não derruba a página da obra", not errs and pg.locator("h1", has_text="Blade Runner").count() == 1, str(errs))
    # tons diferentes para obras diferentes
    pg.goto(BASE + "/item/seed%3Afilme%3Abacurau"); pg.wait_for_selector(".obra")
    c1 = pg.evaluate("getComputedStyle(document.querySelector('.obra .btn:not(.ghost)')).backgroundColor")
    pg.goto(BASE + "/item/seed%3Ajogo%3Ahades"); pg.wait_for_selector(".obra")
    c2 = pg.evaluate("getComputedStyle(document.querySelector('.obra .btn:not(.ghost)')).backgroundColor")
    check("obras diferentes ganham cores diferentes", c1 != c2, f"{c1} vs {c2}")
    b.close()

print(f"\n{len(fails)} falhas" if fails else "\nTUDO OK")
raise SystemExit(1 if fails else 0)
