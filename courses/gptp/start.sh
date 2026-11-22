#!/usr/bin/env bash
# Launch the gPTP automotive course in your browser.
#
#   ./start.sh            # serve on http://localhost:8080 and open the browser
#   ./start.sh 9000       # use another port
#   NO_BROWSER=1 ./start.sh
#
# Only needs python3 (or, as a fallback, node's npx). Serves on 127.0.0.1 only.
set -euo pipefail

PORT="${1:-8080}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:${PORT}/"

cd "$DIR"

open_browser() {
  [ "${NO_BROWSER:-0}" = "1" ] && return 0
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v wslview >/dev/null 2>&1; then wslview "$URL"
  else echo "Open $URL in your browser."
  fi
}

echo "──────────────────────────────────────────────"
echo "  gPTP automotive course →  $URL"
echo "  Press Ctrl+C to stop."
echo "──────────────────────────────────────────────"

open_browser &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server -p "$PORT" -a 127.0.0.1 -c-1 .
else
  echo "Need python3 or node/npx to serve the course." >&2
  echo "Alternatively open index.html directly in your browser." >&2
  exit 1
fi
