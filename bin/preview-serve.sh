#!/bin/bash
#
# Serve this checkout (or worktree) for previewing from another machine through
# VS Code Remote-SSH port forwarding. Drafts and later-today posts included.
#
# Picks free ports outside the static SSH forwards (5173, 4173, 8080, 6006 land
# on a different host and hold those ports on the laptop), waits for the first
# build, asks VS Code to forward the port and open the page, then exits and
# leaves the server running in the background.
#
# Usage: bin/preview-serve.sh [url-path]
#   bin/preview-serve.sh /blog/2026/my-post/
# Override ports with PREVIEW_PORT / PREVIEW_LIVERELOAD_PORT.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

URL_PATH="${1:-/}"

free_port() {
  local port
  for port in $(seq "$1" "$2"); do
    if ! ss -ltnH "( sport = :$port )" | grep -q .; then
      echo "$port"
      return 0
    fi
  done
  echo "No free port in $1-$2" >&2
  return 1
}

# Worktrees have no vendor/bundle of their own; reuse the main checkout's gems.
if [ -z "${BUNDLE_PATH:-}" ]; then
  MAIN_CHECKOUT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
  if [ -d "$REPO_ROOT/vendor/bundle" ]; then
    export BUNDLE_PATH="$REPO_ROOT/vendor/bundle"
  elif [ -d "$MAIN_CHECKOUT/vendor/bundle" ]; then
    export BUNDLE_PATH="$MAIN_CHECKOUT/vendor/bundle"
    export BUNDLE_FROZEN=true
  fi
fi

PORT="${PREVIEW_PORT:-$(free_port 8090 8099)}"
LIVERELOAD_PORT="${PREVIEW_LIVERELOAD_PORT:-$(free_port 35729 35739)}"
LOG="$(mktemp -t preview-serve.XXXXXX.log)"

# setsid gives the server its own session, so it survives when the caller's process group is
# killed (agent shells and CI steps do this when a command returns). nohup alone does not.
DETACH=(nohup)
command -v setsid >/dev/null && DETACH=(setsid nohup)
"${DETACH[@]}" bundle exec jekyll serve --host 127.0.0.1 --port "$PORT" \
  --livereload --livereload-port "$LIVERELOAD_PORT" --unpublished --future \
  >"$LOG" 2>&1 </dev/null &
PID=$!
disown "$PID"

echo "[preview] building (first build takes about 80s), log: $LOG"
for _ in $(seq 1 150); do
  if grep -q "Server running" "$LOG"; then
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "[preview] jekyll exited during the build:" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  sleep 2
done

if ! grep -q "Server running" "$LOG"; then
  echo "[preview] build did not finish in 300s; still running as pid $PID, see $LOG" >&2
  exit 1
fi

URL="http://localhost:$PORT$URL_PATH"

# In a VS Code Remote-SSH session, $BROWSER forwards the port and opens the URL
# on the laptop.
if [ -n "${BROWSER:-}" ]; then
  "$BROWSER" "$URL" >/dev/null 2>&1 || true
fi

echo "[preview] $URL"
echo "[preview] live reload on $LIVERELOAD_PORT (works when VS Code forwards it too)"
echo "[preview] stop with: kill $PID"
