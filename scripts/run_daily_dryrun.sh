#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SAFETYGUARD_PORT:-3021}"
COUNT="${SAFETYGUARD_DRYRUN_COUNT:-100}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$ROOT/logs/dryrun-api/$RUN_ID"
PID_FILE="$OUT_DIR/server.pid"
SERVER_LOG="$OUT_DIR/server.log"
SUMMARY="$OUT_DIR/summary.json"
DETAILS="$OUT_DIR/details.json"

mkdir -p "$OUT_DIR"

cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    PID="$(cat "$PID_FILE" || true)"
    if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" >/dev/null 2>&1 || true
      wait "$PID" 2>/dev/null || true
    fi
  fi
}
trap cleanup EXIT

cd "$ROOT"
npm run build > "$OUT_DIR/build.log" 2>&1
PORT="$PORT" npm run start > "$SERVER_LOG" 2>&1 &
echo $! > "$PID_FILE"

python3 - <<PY
import time, urllib.request, urllib.error
url = 'http://127.0.0.1:${PORT}/api/search?q=test'
last = None
for _ in range(120):
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            if r.status < 500:
                print('server-ready')
                raise SystemExit(0)
    except Exception as e:
        last = e
        time.sleep(1)
print(f'server-not-ready: {last}')
raise SystemExit(1)
PY

SAFETYGUARD_BASE_URL="http://127.0.0.1:${PORT}" \
SAFETYGUARD_DRYRUN_COUNT="$COUNT" \
SAFETYGUARD_OUT_DIR="$OUT_DIR" \
node "$ROOT/scripts/dryrun_api_runner.mjs" > "$OUT_DIR/runner.log" 2>&1

echo "$SUMMARY"
echo "$DETAILS"
