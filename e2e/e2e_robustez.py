import json, urllib.request, urllib.error
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def get(path, ip):
    req = urllib.request.Request(BASE + path, headers={"x-forwarded-for": ip})
    try:
        r = urllib.request.urlopen(req); return r.status, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers)

# cabeçalhos de segurança
st, h = get("/", "7.7.7.1")
hl = {k.lower(): v for k, v in h.items()}
check("cabeçalhos de segurança presentes", hl.get("x-content-type-options") == "nosniff" and hl.get("x-frame-options") == "DENY" and "frame-ancestors 'none'" in hl.get("content-security-policy", "") and "camera=()" in hl.get("permissions-policy", ""), str(hl))
check("não anuncia o framework", "x-powered-by" not in hl)

# limite de requisições: importação tem teto de 10 por minuto por IP; outro IP não é afetado
codes = [get("/api/anilist?user=ab", "7.7.7.2")[0] for _ in range(13)]
check("importação é limitada (429 depois de 10)", codes.count(429) >= 3 and 429 not in codes[:10], str(codes))
st, h = get("/api/anilist?user=ab", "7.7.7.2")
check("429 traz Retry-After", st == 429 and int({k.lower(): v for k, v in h.items()}["retry-after"]) >= 1)
check("outro IP não é afetado", get("/api/anilist?user=ab", "7.7.7.3")[0] != 429)
check("busca comum continua liberada", get("/api/search?q=hades", "7.7.7.4")[0] == 200)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # página 404 própria
    r = pg.goto(BASE + "/isso-nao-existe")
    check("404 mostra página própria", r.status == 404 and pg.get_by_role("heading", name="Página não encontrada").count() == 1)

    # backup: exportar, apagar tudo, restaurar
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")
    ent = lambda: json.loads(pg.evaluate("localStorage.getItem('hobby:v1')") or '{"entries":{}}')["entries"]
    antes = len(ent())
    check("dados de exemplo carregados", antes >= 10, str(antes))
    pg.goto(BASE + "/ajustes"); pg.wait_for_selector("text=Seus dados")
    with pg.expect_download() as dl:
        pg.get_by_role("button", name="Exportar meus dados").click()
    path = dl.value.path()
    pg.get_by_role("button", name="Excluir meus dados").click()
    pg.get_by_role("button", name="Confirmar exclusão").click()
    pg.wait_for_timeout(300)
    check("exclusão esvaziou a biblioteca", len(ent()) == 0)
    pg.set_input_files('[data-testid=restaurar]', path)
    pg.wait_for_selector("[data-testid=restaurar-msg]")
    msg = pg.locator("[data-testid=restaurar-msg]").inner_text()
    check("backup restaurado com a contagem", len(ent()) == antes and f"{antes} registros" in msg, msg)

    # restaurar de novo não duplica nem apaga o que é novo
    pg.evaluate("""() => { const k='hobby:v1'; const l=JSON.parse(localStorage.getItem(k)); l.entries['x:novo']={itemId:'x:novo',status:'quero',at:Date.now()}; l.items['x:novo']={id:'x:novo',title:'Novo',media:'jogo',vibes:[],source:'igdb'}; localStorage.setItem(k, JSON.stringify(l)); }""")
    pg.reload(); pg.wait_for_selector("[data-testid=restaurar]", state="attached")
    pg.set_input_files('[data-testid=restaurar]', path)
    pg.wait_for_selector("[data-testid=restaurar-msg]")
    check("restaurar de novo não perde registro novo nem duplica", len(ent()) == antes + 1 and "Nada novo" in pg.locator("[data-testid=restaurar-msg]").inner_text())

    # arquivo inválido: mensagem clara e nada muda
    pg.set_input_files('[data-testid=restaurar]', files=[{"name": "lixo.json", "mimeType": "application/json", "buffer": b"{nao e json"}])
    pg.wait_for_function("document.querySelector('[data-testid=restaurar-msg]').innerText.includes('JSON')")
    check("arquivo inválido é recusado sem mexer nos dados", len(ent()) == antes + 1)
    pg.set_input_files('[data-testid=restaurar]', files=[{"name": "outro.json", "mimeType": "application/json", "buffer": b'{"foo": 1}'}])
    pg.wait_for_function("document.querySelector('[data-testid=restaurar-msg]').innerText.includes('backup do Hobby')")
    check("JSON de outro tipo é recusado", len(ent()) == antes + 1)

    # verbos por mídia: o botão acompanha o tipo da obra
    for id_, verbo in [("seed:jogo:celeste", "jogar"), ("seed:livro:1984", "ler"), ("seed:anime:attack-on-titan", "ver")]:
        pg.goto(BASE + "/item/" + urllib.request.quote(id_, safe="")); pg.wait_for_selector("h1")
        ok = pg.get_by_role("button", name="Quero " + verbo, exact=True).count() == 1 and pg.get_by_role("button", name="Quero ver", exact=True).count() == (1 if verbo == "ver" else 0)
        check(f"{id_.split(':')[1]} oferece 'Quero {verbo}'", ok, pg.locator("main").inner_text()[:120])
    # "Parecidos com esta"
    pg.goto(BASE + "/item/" + urllib.request.quote("seed:jogo:hades", safe="")); pg.wait_for_selector("[data-testid=parecidos]")
    cards = pg.locator("[data-testid=parecidos] li a")
    check("item mostra obras parecidas (de mais de uma mídia)", cards.count() >= 3 and len({l.split(",")[-1].strip() for l in cards.all_inner_texts()}) >= 2, str(cards.all_inner_texts()))
    check("página não rola na horizontal", pg.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"))
    primeiro = cards.first.inner_text().split("\n")[0].strip()
    cards.first.click(); pg.wait_for_url(lambda u: "hades" not in u); pg.wait_for_selector("h1")
    check("tocar leva à obra parecida", pg.locator("h1").first.inner_text().strip() == primeiro, primeiro)
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()

print("FALHAS:", fails) if fails else print("TUDO OK")
raise SystemExit(1 if fails else 0)
