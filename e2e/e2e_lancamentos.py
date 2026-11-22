from playwright.sync_api import sync_playwright
B="http://localhost:3100"; fails=[]
def check(n,c):
    if not c: fails.append(n)
    print(("PASS " if c else "FAIL ")+n)
SEED="""()=>{const l=JSON.parse(localStorage.getItem('hobby:v1'));
const add=(id,title,media,source,status,year)=>{l.items[id]={id,title,media,year,vibes:['aventura'],source};l.entries[id]={itemId:id,status,at:Date.now()};};
add('tmdb:movie:438631','Duna','filme','tmdb','quero',2021);
add('igdb:hades','Hades','jogo','igdb','pausei',2020);
add('anilist:1','Death Note','anime','anilist','andamento',2006);
localStorage.setItem('hobby:v1',JSON.stringify(l));localStorage.removeItem('hobby:releases:v1');}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":390,"height":844},locale="pt-BR").new_page()
    pg.goto(B+"/importar"); pg.click("text=Ver com dados de exemplo"); pg.wait_for_timeout(1500)
    pg.goto(B+"/lancamentos"); pg.wait_for_timeout(500)
    check("vazio no começo", pg.locator("[data-testid=sem-lancamentos]").count()==1 or pg.locator("[data-testid^=grupo-]").count()==0)
    pg.evaluate(SEED)
    pg.goto(B+"/lancamentos"); pg.wait_for_selector("[data-testid^=grupo-]",timeout=15000); pg.wait_for_timeout(800)
    t=pg.inner_text("main")
    check("episódio 5 do anime", "Episódio 5" in t and "Death Note" in t)
    check("estreia do filme", "Duna" in t and "Estreia" in t)
    check("jogo no grupo do mês", "Lançamento" in pg.inner_text("[data-testid=grupo-mes]") and "Hades" in pg.inner_text("[data-testid=grupo-mes]"))
    check("semana tem anime e filme", "Death Note" in pg.inner_text("[data-testid=grupo-semana]") and "Duna" in pg.inner_text("[data-testid=grupo-semana]"))
    check("ordem: anime antes do filme", t.index("Death Note")<t.index("Duna"))
    check("cache salvo", pg.evaluate("()=>!!localStorage.getItem('hobby:releases:v1')"))
    pg.goto(B+"/inicio"); pg.wait_for_selector("[data-testid=lancamentos-breve]",timeout=10000)
    check("Início mostra em breve", "Death Note" in pg.inner_text("[data-testid=lancamentos-breve]"))
print("FAILS:",fails)
