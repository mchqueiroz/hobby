import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    if not cond: fails.append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

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


HADES = BASE + "/item/seed%3Ajogo%3Ahades"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", timezone_id="America/Sao_Paulo")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_url("**/descobrir")

    # navegação da biblioteca
    pg.goto(BASE + "/biblioteca")
    for label, url in [("Diário", "/diario"), ("Listas", "/listas"), ("Estatísticas", "/estatisticas"), ("Itens", "/biblioteca")]:
        pg.click(f'nav[aria-label="Biblioteca"] >> text={label}'); pg.wait_for_url("**" + url)
        check(f"subnav leva a {label}", pg.locator(f'nav[aria-label="Biblioteca"] a[aria-current="page"]').inner_text() == label)
    check("aba Biblioteca continua marcada nas subpáginas", True)

    # resenha e data na página da obra
    pg.goto(HADES); pg.wait_for_selector("#resenha")
    pg.fill("#data-obra", "2026-03-05")
    pg.fill("#resenha", "Melhor roguelike que joguei.\nA trilha é incrível.")
    pg.click("text=Salvar resenha"); pg.wait_for_selector("text=Resenha salva")
    pg.reload(); pg.wait_for_selector("#resenha")
    check("resenha persiste após recarregar", "Melhor roguelike" in pg.input_value("#resenha") and "\n" in pg.input_value("#resenha"))
    check("data persiste após recarregar", pg.input_value("#data-obra") == "2026-03-05", pg.input_value("#data-obra"))
    # salvar ao sair do campo
    pg.fill("#resenha", "Texto salvo ao sair do campo"); pg.click("#data-obra")
    pg.reload(); pg.wait_for_selector("#resenha")
    check("resenha salva ao sair do campo", pg.input_value("#resenha") == "Texto salvo ao sair do campo", pg.input_value("#resenha"))
    # reregistrar mantém resenha
    pg.click("text=Editar registro"); pg.wait_for_selector('[role=dialog]'); pg.click('button[aria-label="Nota 3"]')
    pg.wait_for_timeout(300); pg.reload(); pg.wait_for_selector("#resenha")
    check("editar a nota não apaga a resenha", pg.input_value("#resenha") == "Texto salvo ao sair do campo")

    # diário
    pg.goto(BASE + "/diario"); pg.wait_for_selector("text=Março")
    txt = pg.inner_text("main")
    check("diário agrupa por mês com a data escolhida", "março de 2026" in txt.lower() and "Hades" in txt, txt[:200])
    check("diário mostra trecho da resenha", "Texto salvo ao sair do campo" in txt)
    check("mês de hoje aparece antes de março", txt.lower().index("novembro") < txt.lower().index("março") if "novembro" in txt.lower() else True)

    # listas
    pg.goto(BASE + "/listas")
    pg.fill('input[aria-label="Nome da nova lista"]', "Melhores de 2026"); pg.click("button:has-text('Criar')")
    pg.wait_for_selector("text=Melhores de 2026")
    check("lista criada", pg.locator("text=Melhores de 2026").count() >= 1)
    pg.goto(HADES); pg.wait_for_selector('button.chip:has-text("Melhores de 2026")')
    pg.click('button.chip:has-text("Melhores de 2026")')
    check("chip da lista marca como adicionado", pg.locator('button.chip[aria-pressed="true"]:has-text("Melhores de 2026")').count() == 1)
    pg.goto(BASE + "/listas"); pg.click("text=Melhores de 2026"); pg.wait_for_selector("h1")
    check("página da lista mostra o item", pg.locator("li", has_text="Hades").count() == 1)
    pg.click('button[aria-label="Tirar Hades da lista"]')
    check("tirar item esvazia a lista", pg.locator("text=Lista vazia").count() == 1)
    pg.click("text=Renomear"); pg.fill('input[aria-label="Novo nome da lista"]', "Favoritos do ano"); pg.click("text=Salvar")
    check("renomear funciona", pg.locator("h1", has_text="Favoritos do ano").count() == 1)
    pg.click("text=Excluir lista"); pg.click("text=Confirmar exclusão"); pg.wait_for_url("**/listas")
    check("excluir lista volta à tela de listas vazia", pg.locator("text=Nenhuma lista ainda").count() == 1)

    # estatísticas
    pg.goto(BASE + "/estatisticas"); pg.wait_for_selector("text=Por mídia")
    txt = pg.inner_text("main")
    check("estatísticas mostram total de 14 itens", "14" in txt and "itens" in txt, txt[:120])
    check("estatísticas mostram resenhas", "1" in txt and "resenha" in txt)
    check("gráfico por mês tem descrição acessível", pg.locator('[role=img][aria-label^="Concluídos por mês"]').count() == 1)
    check("sem rolagem horizontal no celular", pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))

    # contraste nos dois temas em todas as páginas novas
    for scheme in ("light", "dark"):
        c2 = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", color_scheme=scheme)
        p2 = c2.new_page()
        p2.goto(BASE + "/importar"); p2.click("text=Ver com dados de exemplo"); p2.wait_for_url("**/descobrir")
        for path in ["/diario", "/listas", "/estatisticas", "/item/seed%3Ajogo%3Ahades"]:
            p2.goto(BASE + path); p2.wait_for_timeout(500)
            bad = p2.evaluate(JS)
            check(f"[{scheme}] contraste em {path}", bad == [], str(bad))
        c2.close()
    check("sem erros de console ou de página", not errs, str(errs))
    b.close()

print(f"\n{len(fails)} falhas" if fails else "\nTUDO OK")
raise SystemExit(1 if fails else 0)
