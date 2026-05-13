#!/bin/bash
#
# Convert a MuseScore .mscz file to MusicXML using the MuseScore 4 CLI.
# Drop the output alongside the source so the Jekyll site can serve both.
#
# Usage:
#   bin/mscz-to-musicxml.sh <path/to/score.mscz>
#
# Install MuseScore 4 if missing:
#   brew install --cask musescore
#
# See NOTES-sheet-music-rendering.md for the full pipeline rationale.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <path/to/score.mscz>" >&2
  exit 64
fi

SRC="$1"
if [ ! -f "$SRC" ]; then
  echo "error: $SRC not found" >&2
  exit 66
fi

MSCORE="${MSCORE:-/opt/homebrew/bin/mscore}"
if [ ! -x "$MSCORE" ] && ! command -v "$MSCORE" >/dev/null 2>&1; then
  MSCORE="/Applications/MuseScore 4.app/Contents/MacOS/mscore"
fi
if [ ! -x "$MSCORE" ]; then
  echo "error: MuseScore CLI not found. Install with: brew install --cask musescore" >&2
  exit 69
fi

DIR="$(cd "$(dirname "$SRC")" && pwd)"
BASE="$(basename "$SRC" .mscz)"
OUT="$DIR/$BASE.musicxml"

echo "converting: $SRC -> $OUT"
"$MSCORE" "$SRC" -o "$OUT" 2> >(grep -v 'qt.qml.typeregistration' >&2 || true)

if [ ! -s "$OUT" ]; then
  echo "error: conversion produced empty file at $OUT" >&2
  exit 70
fi

echo "done: $(wc -c <"$OUT" | tr -d ' ') bytes"
