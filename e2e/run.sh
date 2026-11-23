#!/usr/bin/env bash
# Roda todos os e2e: sobe o mock, faz o build apontando para ele, inicia o app e roda cada script com o mock reiniciado.
# Uso: bash e2e/run.sh [script.py ...]   (sem argumentos roda todos)
set -u
cd "$(dirname "$0")/.."
M=http://localhost:4010
export NEXT_PUBLIC_SUPABASE_URL=$M
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=pk_test_mock
npm run build >/tmp/e2e-build.log 2>&1 || { tail -20 /tmp/e2e-build.log; exit 1; }
# o app é reiniciado a cada script: o limite de requisições por IP (src/proxy.ts) fica na memória e todos os scripts vêm do mesmo IP
start_app() {
  pkill -f "next-server"; pkill -f "next start" 2>/dev/null; sleep 1
  ANILIST_URL=$M TMDB_BASE=$M IGDB_BASE=$M TWITCH_TOKEN_URL=$M/oauth2/token OPENLIB_BASE=$M MUSICBRAINZ_BASE=$M DEEZER_BASE=$M STEAM_BASE=$M STEAMSPY_BASE=$M \
  TMDB_READ_TOKEN=tmdbtoken IGDB_CLIENT_ID=cid IGDB_CLIENT_SECRET=csecret \
    nohup npx next start -p 3100 >/tmp/e2e-app.log 2>&1 &
  for _ in $(seq 1 30); do curl -sf -o /dev/null http://localhost:3100/descobrir && break; sleep 0.5; done
}
SCRIPTS=("$@"); [ ${#SCRIPTS[@]} -eq 0 ] && SCRIPTS=(e2e/e2e.py e2e/e2e_remote.py e2e/e2e_tema.py e2e/e2e_obra.py e2e/e2e_diario.py e2e/e2e_detalhes.py e2e/e2e_nav.py e2e/e2e_perfil.py e2e/e2e_manga_livro.py e2e/e2e_foto.py e2e/e2e_conta.py e2e/e2e_social.py e2e/e2e_biblioteca.py e2e/e2e_discussao.py e2e/e2e_resenha.py e2e/e2e_robustez.py e2e/e2e_moderacao.py e2e/e2e_offline.py e2e/e2e_a11y.py e2e/e2e_abas.py e2e/e2e_retrospectiva.py e2e/e2e_inicio.py e2e/e2e_novidades.py e2e/e2e_lote1.py e2e/e2e_pausei.py e2e/e2e_lancamentos.py e2e/e2e_cartao_ano.py e2e/e2e_respostas.py e2e/e2e_painel_moderacao.py e2e/e2e_rede.py e2e/e2e_descobrir.py e2e/e2e_csp.py e2e/e2e_vitrine.py)
RC=0
for s in "${SCRIPTS[@]}"; do
  [ -f "$s" ] || continue
  start_app
  pkill -f "e2e/mock.mjs" 2>/dev/null; sleep 0.5
  nohup node e2e/mock.mjs >/tmp/mock.log 2>&1 &
  sleep 1
  echo "=== $s"
  PYTHONPATH=e2e/_bypass E2E_CSP=$([ "$s" = e2e/e2e_csp.py ] && echo 1 || echo 0) python3 "$s" >/tmp/last-e2e.log 2>&1 || RC=1
  grep -E "^FAIL |Traceback|Error" /tmp/last-e2e.log | head -20
  echo "$(grep -c '^PASS' /tmp/last-e2e.log) ok"
  grep -q "^FAIL " /tmp/last-e2e.log && RC=1
done
pkill -f "e2e/mock.mjs"; pkill -f "next-server"; pkill -f "next start"
exit $RC
