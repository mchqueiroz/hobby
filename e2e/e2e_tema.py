import json
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"
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
    const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700; const need=(size>=24||(size>=18.66&&bold))?3:4.5;
    if(ratio<need) bad.push([el.textContent.trim().slice(0,30), ratio.toFixed(2), cs.color, `${bg.r},${bg.g},${bg.b}`]); }
  return bad;
}
"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ("light","dark"):
        ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="pt-BR",color_scheme=scheme)
        pg=ctx.new_page()
        pg.goto(BASE+"/importar"); pg.fill("#user","mockuser"); pg.click("text=Importar anime"); pg.wait_for_selector("text=Importação concluída")
        print(scheme,"importar",pg.evaluate(JS)); pg.screenshot(path=f"/tmp/{scheme}_importar.png")
        pg.goto(BASE+"/ajustes"); pg.wait_for_selector("text=Aparência")
        print(scheme,"perfil",pg.evaluate(JS)); pg.screenshot(path=f"/tmp/{scheme}_perfil.png",full_page=True)
        pg.goto(BASE+"/descobrir"); pg.wait_for_selector("li.card")
        print(scheme,"descobrir",pg.evaluate(JS)); pg.screenshot(path=f"/tmp/{scheme}_descobrir.png")
        pg.click('button[aria-label="Registrar um item"]'); pg.fill("#busca","dea"); pg.wait_for_timeout(900)
        print(scheme,"sheet",pg.evaluate(JS)); pg.screenshot(path=f"/tmp/{scheme}_sheet.png")
        ctx.close()
    # override manual
    ctx=b.new_context(viewport={"width":390,"height":844},locale="pt-BR",color_scheme="light"); pg=ctx.new_page()
    pg.goto(BASE+"/ajustes"); pg.click("text=Escuro")
    print("override:", pg.evaluate("[document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor, localStorage.getItem('hobby:theme')]"))
    pg.reload(); print("persistiu:", pg.evaluate("getComputedStyle(document.body).backgroundColor"))
    pg.click("text=Automático"); print("auto:", pg.evaluate("[document.documentElement.dataset.theme ?? null, getComputedStyle(document.body).backgroundColor]"))
    b.close()
