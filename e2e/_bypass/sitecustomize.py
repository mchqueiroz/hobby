# Os e2e usam wait_for_function com texto, que o Playwright avalia com eval; o CSP do app (corretamente) proíbe isso.
# Aqui os contextos nascem com bypassCSP, exceto quando E2E_CSP=1 (e2e_csp.py testa o CSP de verdade).
import os
if os.environ.get("E2E_CSP") != "1":
    try:
        from playwright._impl._browser import Browser
        _orig = Browser.new_context
        async def new_context(self, *a, **kw):
            if kw.get("bypassCSP") is None: kw["bypassCSP"] = True
            return await _orig(self, *a, **kw)
        Browser.new_context = new_context
    except Exception:
        pass
