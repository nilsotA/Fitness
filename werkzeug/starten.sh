#!/usr/bin/env bash
# Entwicklungsserver und Chromium starten – die Voraussetzung für alles in
# diesem Verzeichnis.
#
# Kein `pkill -f "node server/index.js"`: Das Muster steht in der eigenen
# Kommandozeile, die Shell bringt sich damit selbst um. Lieber einen anderen
# Port nehmen.
set -eu
PORT="${PORT:-3140}"
CDP_PORT="${CDP_PORT:-9560}"
WURZEL="$(cd "$(dirname "$0")/.." && pwd)"

CHROME="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)"
[ -n "$CHROME" ] || { echo "Chromium nicht gefunden unter /opt/pw-browsers/"; exit 1; }

if ! curl -sf -o /dev/null "http://localhost:$PORT/"; then
  (cd "$WURZEL" && PORT="$PORT" node server/index.js > /tmp/tracker-server.log 2>&1 &)
  sleep 1
fi

if ! curl -sf -o /dev/null "http://localhost:$CDP_PORT/json/version"; then
  "$CHROME" --headless=new --disable-gpu --no-sandbox \
    --remote-debugging-port="$CDP_PORT" \
    --user-data-dir="/tmp/chrome-tracker-$CDP_PORT" about:blank \
    > /tmp/tracker-chrome.log 2>&1 &
  sleep 3
fi

echo "Server auf http://localhost:$PORT · CDP auf $CDP_PORT"
