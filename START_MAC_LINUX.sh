#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required to run WareWise XR."
  exit 1
fi
echo "Starting WareWise XR on http://127.0.0.1:8080"
node server.js &
PID=$!
sleep 2
if command -v open >/dev/null 2>&1; then open http://127.0.0.1:8080 >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://127.0.0.1:8080 >/dev/null 2>&1 || true
fi
wait "$PID"
