# Os e2e usam wait_for_function com texto, que o Playwright avalia com eval; o CSP do app (corretamente) proíbe isso.
# Aqui os contextos nascem com bypassCSP, exceto quando E2E_CSP=1 (e2e_csp.py testa o CSP de verdade).
# O Playwright 1.6x renomeou o módulo (_browser -> browser) e o parâmetro (bypassCSP -> bypass_csp); aceita os dois.
import inspect
import os
if os.environ.get("E2E_CSP") != "1":
    try:
        try:
            from playwright._impl.browser import Browser
        except ImportError:
            from playwright._impl._browser import Browser
        _orig = Browser.new_context
        _key = "bypass_csp" if "bypass_csp" in inspect.signature(_orig).parameters else "bypassCSP"
        async def new_context(self, *a, **kw):
            if kw.get(_key) is None: kw[_key] = True
            return await _orig(self, *a, **kw)
        Browser.new_context = new_context
    except Exception as e:
        print("aviso: bypass de CSP não aplicado:", e)
