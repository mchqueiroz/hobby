#!/usr/bin/env bash
# Roda todos os e2e: sobe o mock, faz o build apontando para ele, inicia o app e roda cada script com o mock reiniciado.
# Uso: bash e2e/run.sh [script.py ...]   (sem argumentos roda todos)
set -u
cd "$(dirname "$0")/.."
M=http://localhost:4010
export NEXT_PUBLIC_SUPABASE_URL=$M
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=pk_test_mock
npm run build >/tmp/e2e-build.log 2>&1 || { tail -20 /tmp/e2e-build.log; exit 1; }
pkill -f "next-server"; pkill -f "next start" 2>/dev/null; sleep 1
ANILIST_URL=$M TMDB_BASE=$M IGDB_BASE=$M TWITCH_TOKEN_URL=$M/oauth2/token OPENLIB_BASE=$M MUSICBRAINZ_BASE=$M \
TMDB_READ_TOKEN=tmdbtoken IGDB_CLIENT_ID=cid IGDB_CLIENT_SECRET=csecret \
  nohup npx next start -p 3100 >/tmp/e2e-app.log 2>&1 &
sleep 4
SCRIPTS=("$@"); [ ${#SCRIPTS[@]} -eq 0 ] && SCRIPTS=(e2e/e2e.py e2e/e2e_remote.py e2e/e2e_tema.py e2e/e2e_obra.py e2e/e2e_diario.py e2e/e2e_detalhes.py e2e/e2e_nav.py e2e/e2e_perfil.py e2e/e2e_manga_livro.py e2e/e2e_musica.py e2e/e2e_foto.py e2e/e2e_conta.py e2e/e2e_social.py e2e/e2e_biblioteca.py e2e/e2e_discussao.py e2e/e2e_resenha.py)
RC=0
for s in "${SCRIPTS[@]}"; do
  [ -f "$s" ] || continue
  pkill -f "e2e/mock.mjs" 2>/dev/null; sleep 0.5
  nohup node e2e/mock.mjs >/tmp/mock.log 2>&1 &
  sleep 1
  echo "=== $s"
  python3 "$s" >/tmp/last-e2e.log 2>&1 || RC=1
  grep -E "FAIL|Traceback|Error" /tmp/last-e2e.log | head -20
  echo "$(grep -c '^PASS' /tmp/last-e2e.log) ok"
  grep -q "^FAIL" /tmp/last-e2e.log && RC=1
done
pkill -f "e2e/mock.mjs"; pkill -f "next-server"; pkill -f "next start"
exit $RC
