# NOTES — Sheet music rendering on the web

Reference for when I add notated music to the site. Not published; excluded from Jekyll build (same as `AGENTS.md`, `DESIGN.md`).

## Libraries for rendering sheet music in the browser

- **OpenSheetMusicDisplay (OSMD)** — highest-level choice. Hand it a MusicXML string or URL; it renders an engraved score as SVG. TypeScript, actively maintained, built on VexFlow. Default pick.
  - Repo: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay
  - Site: https://opensheetmusicdisplay.org/
- **VexFlow** — lower-level. Build the score note-by-note in JS (staves, voices, beams). More control, more work. OSMD uses it under the hood.
- **Verovio** — MEI-native but also reads MusicXML. Outputs SVG, ships as compiled WASM, used by the Music Encoding Initiative. Good if I care about MEI or want server-side rendering without a Node DOM shim.
- **abcjs** — only relevant if the source is ABC notation, not MuseScore.

## MuseScore → HTML pipeline

MuseScore doesn't emit HTML directly. The working route:

1. In MuseScore: `File → Export…` and pick **MusicXML** (`.musicxml` uncompressed, or `.mxl` compressed).
   - CLI equivalent: `mscore input.mscz -o output.musicxml`
2. Serve the file as a static asset (e.g. under `assets/music/`).
3. On the page, load OSMD and point it at the file:

   ```html
   <div id="score"></div>
   <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js"></script>
   <script>
     const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("score");
     osmd.load("/assets/music/my-piece.musicxml").then(() => osmd.render());
   </script>
   ```

Result: responsive SVG sheet music inline. OSMD also accepts the XML as a string if I want to generate it at build time.

## Build-time alternatives (no client-side JS)

- **Headless OSMD/Verovio** → static SVG, dropped into the page. Faster load, no runtime dependency, loses interactivity (playback cursor, zoom).
- **Direct export from MuseScore**: `mscore input.mscz -o out.svg` (also `.png`, `.pdf`). Simplest. Not selectable, not interactive, doesn't reflow.

## Decision rule for this site

- Interactive/responsive sheet music (e.g. exercises, playback cursor): MuseScore → MusicXML → OSMD at runtime.
- Static figure in a post: MuseScore → SVG at build time, embedded via the standard `figure.liquid` block (see `DESIGN.md`).

## Dev-mode annotation overlay + chord inspector

Two dev-only interactive features live on the Cogwork Dancers page. Both
activate when the site is served from `localhost` / `127.0.0.1` or the URL
carries `?dev`. Inspired by
[kunchenguid/lavish-axi](https://github.com/kunchenguid/lavish-axi), adapted
for a static Jekyll site by adding a tiny Node sidecar instead of a full CLI.

### Start the dev environment

```
bin/dev-serve.sh
```

Starts Jekyll on `:4000` and the annotator sidecar on `:4001`. Ctrl-C stops
both.

### Annotator

- **Shift-click** anywhere on the score to drop a pin. A red numbered
  marker lands at the click with a flash animation; the right-edge sidebar
  opens focused on that pin's textarea.
- Each pin captures semantic identity from OSMD's graphical model:
  `{ measureNumber, staffIndex, pitches[], clickedPitch }`, plus a
  PNG thumbnail cropped from the rendered SVG around the click, plus a
  CSS-selector fallback. The context label shown in the sidebar and
  export looks like `m12 · staff 1 · [C4 E4 G4]`.
- Persistence is dual: every change writes to `localStorage` (keyed by
  pathname) and to the sidecar via `POST /save`, which writes
  `.dev-annotations/<slug>.json` inside the repo (git-ignored). The
  sidebar shows live status: `sidecar online` / `local only`.
- On load, the annotator probes the sidecar health and hydrates from the
  on-disk JSON, unless local has more pins (last-write-wins favouring the
  richer set).
- Sidebar actions: **Copy Markdown** (clipboard), **Download JSON**, and
  **Clear all**. When you're working with me, you don't need any of these
  — I read the `.dev-annotations/<slug>.json` directly.

### Chord inspector

Click a note (without Shift) and a popover appears near the click showing:

- Detected chord name via `Tonal.Chord.detect`.
- Notes in the chord at that beat, with their pitch names.
- Semitones from the bass note.
- Interval list (e.g. `M3 + m3`).
- A Stradella bass recipe (`C bass + Major button`) if the chord matches
  one of the standard voicings in `_data/music/stradella_buttons.yml`.

### Sidecar API

Minimal Node HTTP server, no dependencies, Node 18+ built-ins only:

- `GET  /health` → `{ok, root}`
- `POST /save` body `{pathname, pins}` → writes `.dev-annotations/<slug>.json`
- `GET  /load?pathname=...` → returns `{pathname, updatedAt, pinCount, pins}`

CORS is allowed for `http://localhost:4000` and `http://127.0.0.1:4000`.

### File map

```
bin/
  dev-annotator-server.mjs   Node sidecar
  dev-serve.sh               starts Jekyll + sidecar
  mscz-to-musicxml.sh        one-shot conversion wrapper
assets/js/sheet-music/
  osmd-bridge.js             exposes window.__sheetMusic (OSMD helpers)
  dev-annotator.{js,css}     shift-click pins, sidebar, sidecar sync
  chord-inspector.js         click-note popover
.dev-annotations/            git-ignored; <slug>.json per page
```

## Shared sheet reader

All four sheet pages use `sheet-music.liquid` for score display, downloads,
and keyboard-accessible note inspection. `playback=true` adds the same
Señorita-style transport and practice settings. A read-only page does not load
a player. The page supplies source format, credits, default sound, key mode,
and optional recording assets and label; no shared include names a piece.

- `page.js` fetches MusicXML once, keeps the parsed document on the OSMD
  bridge, and owns zoom and focus mode. Mobile reading starts at 0.8 zoom.
- `practice-timeline.js` supplies a single written-tempo map, including
  mid-measure changes. `score.js` uses that map with OSMD’s ties,
  articulations, and optional Stradella chord-button interpretation.
- `practice-player.js` is the shared cancellable player. Score time stays
  separate from playback speed. Inclusive passage loops, sustained-note
  resume, gain, and transposition use the same scheduler on every piece.
- `transport.js` owns the common measure track, key stepper, sound picker,
  and expandable speed, loop, jump, and follow settings. Settings use
  `sheet-reader:<pathname>`, with a fallback read of old Cogwork settings.
- `playback.js` connects the player, transport, notation transposition, and
  `playhead.js`. The playhead caches notation positions once per render;
  it does not walk OSMD’s cursor on every measure or frame.
- Recordings are fetched as complete blobs for seeking without HTTP Range
  support. Changing source stays paused and preserves the measure.
  Transposing selects live sound; returning to a recording resets the key.
- `practice-inspector.js` is shared by playable and read-only scores.
  One note activation opens its accessible dialog. Written pitches stay
  distinct from Stradella interpretation and suggested registers. Inspection
  pauses playback; closing it stops auditions and restores focus.

Cogwork Dancers retains its strings recording, 79 measures, and tempo changes:
120 BPM initially, 160 at measure 20, and 100 at measure 69. Its score time
ends at 137.9 seconds. Señorita retains articulation, gain, and Stradella
chord-button playback. Reclaiming Entropy remains read-only.

Checks:

```sh
node _scripts/sheet-practice-test.js
node _scripts/sheet-playhead-test.js
node _scripts/sheet-transpose-test.js
# After a production Jekyll build:
node _scripts/music-build-test.js
# On each of the four pages, at desktop and mobile widths:
agent-browser eval --stdin < _scripts/sheet-reader-browser-check.js
# Additional Cogwork interactions and real recording/live audio:
agent-browser eval --stdin < _scripts/sheet-practice-browser-check.js
# Unlock audio with a real Play click first:
agent-browser eval --stdin < _scripts/sheet-practice-audio-check.js
# Señorita and Reconstructing More Science:
agent-browser eval --stdin < _scripts/sheet-playback-ties-check.js
agent-browser eval --stdin < _scripts/sheet-playback-articulation-check.js
# Señorita:
agent-browser eval --stdin < _scripts/sheet-playback-stradella-check.js
```

## References

- OSMD homepage: https://opensheetmusicdisplay.org/
- MuseScore MusicXML handbook: https://handbook.musescore.org/file-management/working-with-musicxml-files
- MuseScore export formats: https://handbook.musescore.org/file-management/file-export
