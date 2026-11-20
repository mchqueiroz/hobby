#!/usr/bin/env bash
# Sobe o app e abre numa janela do tamanho de um celular (390x844), como app, sem barra de endereço.
# Uso: npm run celular        (porta 3000; mude com PORT=3001 npm run celular)
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
URL="http://localhost:$PORT"

setsid npx next dev -p "$PORT" >/tmp/hobby-dev.log 2>&1 &
DEV=$!
# setsid põe o servidor num grupo próprio: ao sair, derrubamos o grupo todo (npx + next)
trap 'kill -- -$DEV 2>/dev/null' EXIT INT TERM

echo "Subindo o app em $URL ..."
for _ in $(seq 1 60); do
  curl -fs -o /dev/null "$URL" && break
  kill -0 $DEV 2>/dev/null || { echo "O servidor caiu. Veja /tmp/hobby-dev.log"; exit 1; }
  sleep 1
done

# BROWSER=nome-do-navegador força a escolha; senão usa o primeiro que achar
for b in "${BROWSER:-}" google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
  [ -n "$b" ] && command -v "$b" >/dev/null 2>&1 && {
    echo "Abrindo no $b. Feche a janela e aperte Ctrl+C aqui para parar."
    "$b" --app="$URL" --window-size=390,844 --user-data-dir="${TMPDIR:-/tmp}/hobby-celular-profile" >/dev/null 2>&1
    exit 0
  }
done
echo "Não achei Chrome/Chromium. Abra $URL no navegador, aperte F12 e Ctrl+Shift+M (modo celular)."
echo "Deixe este terminal aberto. Ctrl+C para parar."
wait $DEV
