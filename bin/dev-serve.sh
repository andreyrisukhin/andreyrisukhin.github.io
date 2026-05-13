#!/bin/bash
#
# Start Jekyll and the dev-annotator sidecar in parallel for local development.
# Stops both cleanly on Ctrl-C.
#
# Jekyll:     http://localhost:4000
# Annotator:  http://localhost:4001 (writes to .dev-annotations/)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

cleanup() {
  [ -n "${JEKYLL_PID:-}" ] && kill "$JEKYLL_PID" 2>/dev/null || true
  [ -n "${ANNOTATOR_PID:-}" ] && kill "$ANNOTATOR_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

node "$REPO_ROOT/bin/dev-annotator-server.mjs" &
ANNOTATOR_PID=$!

bundle exec jekyll serve --port 4000 --livereload &
JEKYLL_PID=$!

echo "[dev-serve] jekyll pid=$JEKYLL_PID, annotator pid=$ANNOTATOR_PID"
echo "[dev-serve] open http://localhost:4000/music/sheet/cogwork-dancers/"
wait -n "$JEKYLL_PID" "$ANNOTATOR_PID" 2>/dev/null || true
