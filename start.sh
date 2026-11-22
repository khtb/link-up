#!/usr/bin/env bash
# Build the Link Up and serve it locally.
#
#   ./start.sh              build into ./docs, serve http://localhost:8080
#   ./start.sh 9000         another port
#   HOST=0.0.0.0 ./start.sh share on your LAN (others browse to http://<your-ip>:8080)
#   NO_BUILD=1 ./start.sh   serve the existing ./docs without rebuilding
#   NO_BROWSER=1 ./start.sh
set -euo pipefail
PORT="${1:-8080}"; HOST="${HOST:-127.0.0.1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
[ "${NO_BUILD:-0}" = "1" ] || python3 build.py
URL="http://localhost:${PORT}/"
echo "──────────────────────────────────────────────"
echo "  Link Up →  $URL   (serving $DIR/docs on $HOST)"
[ "$HOST" != "127.0.0.1" ] && echo "  Note: the MACsec crypto labs need https or localhost; on a LAN IP they are disabled by the browser."
echo "  Press Ctrl+C to stop."
echo "──────────────────────────────────────────────"
if [ "${NO_BROWSER:-0}" != "1" ] && command -v xdg-open >/dev/null; then (sleep 1; xdg-open "$URL" >/dev/null 2>&1) & fi
exec python3 "$DIR/serve.py" "$PORT" "$HOST" "$DIR/docs"
