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

## References

- OSMD homepage: https://opensheetmusicdisplay.org/
- MuseScore MusicXML handbook: https://handbook.musescore.org/file-management/working-with-musicxml-files
- MuseScore export formats: https://handbook.musescore.org/file-management/file-export
