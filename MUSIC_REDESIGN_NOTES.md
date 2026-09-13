# Bayan notebook implementation

Branch: `design/bayan-notebook`. The source audit is in [MUSIC_DESIGN_AUDIT.md](MUSIC_DESIGN_AUDIT.md).

## What changed

- `/music/` now opens a playable Am7, not a directory of tools. Music has a direct navigation item and a homepage entry.
- The shared music layout uses paper, ink, and lacquer colors. Dark mode uses a muted brass accent, not pink. Explore, Practice, Play, and Read link to existing material.
- Notes, staff notation, B-system buttons, Stradella recipes, and sound describe the same musical object. Focus and hover connect the representations.
- Progressions retain the selected chord during transposition. Playback supports chords, upward rolls, tempo, looping, mute, and stop. Sound starts only after an explicit action.
- Saved practice keeps its notes, inversions, key, and tempo in this browser. JSON backups append rather than replace the library. Shared links contain musical state, not saved names or the library.
- Type, Chord menu, and Pick notes sit together in the selection area, above a shared Left hand, Right hand, and Theory inspector. Wide notation and reference tables scroll within the page. The footer and update notice no longer cover content.
- The existing service worker caches the workbench and page shell. The installable app uses the notebook name and colors.

## Compatibility and boundaries

### Two explicit study views

Chord / notes and Progression keep separate selections, keys, drafts, and playback settings while the page is open. Switching views stops playback without discarding either document. A sequence typed in Chord / notes offers an explicit action to open Progression; the parser never changes the view on its own.

In Progression, typing or picking material prepares a candidate. Add appends it; Replace changes only the selected step. Steps can be moved or removed. The view remains Progression with one chord or no chords. Selecting a step opens the shared inspector, with key-relative chord labels, root movement, and common tones from the preceding step. These are observations about pitches, not inferred song sections or durations. Playback still uses four beats per chord.

Saved entries and share links retain the view and selected step. Older entries and links still load, using their chord count only for migration.

### Shared vertical B-system renderer

`assets/js/music/bayan-keyboard.js` and `_sass/_bayan-keyboard.scss` serve both the workbench and simulator. A MIDI pitch always has the same column and row, regardless of the displayed range. Higher notes appear at the top.

`layout()` and `html()` provide geometry and markup. `mount()` renders into a container, `update()` changes selection/root state, and `bind()` supplies arrow navigation and activation callbacks, returning an unbind function. Options supply the MIDI range, exact selected notes, root, labels, and optional shortcuts. The primitive owns no audio, chord recognition, or progression state.

Buttons are 48px. Only the actual voiced MIDI notes are outlined, rather than every octave of their pitch classes. A double ring identifies the root; sounding notes use a filled state.

### Existing tools

All earlier music routes remain available, including `/music/workbench/`. Existing Stradella song storage and share formats are unchanged. The workbench reads the earlier prototype’s saved single-chord entries.

Audio is synthesized with Web Audio, not sampled from an accordion. Recipes show whether their pitch set is exact, which tones are missing or extra, and when a stack is theoretical rather than ergonomic. Registers and omitted chord tones vary by instrument.

The notation draft renders ABC but does not infer harmony. URL imports are explicitly unsupported. No personal recordings, artwork, or current practice activity were invented.

The notebook palette is scoped to music pages. The rest of the site retains its theme; its deliberate changes are the direct Music entry and non-fixed footer.

## Validation

Run from the repository root:

```sh
node _scripts/workbench-classify-test.js
node _scripts/workbench-model-test.js
node _scripts/workbench-player-test.js
node _scripts/bayan-keyboard-test.js
node _scripts/workbench-session-test.js
JEKYLL_ENV=production bundle exec jekyll build
node _scripts/music-build-test.js
node --check _site/sw.js
```

The local build used `.build-venv/bin` on `PATH` for its Python dependencies. Check the build log for YAML and Liquid exceptions as well as the exit status.

Results:

- 82 checks passed: 38 classifier, 19 model/diagram/persistence, 7 player lifecycle, 7 shared renderer, and 11 view-state cases.
- The production build passed. Its existing Sass and Rails deprecation warnings remain.
- Built-output checks passed for 14 music routes, 536 local links/assets, and 13 workbench dependencies in the offline cache. Shell precache entries, manifest syntax, table rendering, and development-control exclusion also passed.
- Scoped Prettier checks and `git diff --check` passed.

### Browser checks

Tested in isolated Chromium on Linux at 1440 × 1000 and 390 × 844, following the earlier 1440 × 900 pass. All six view/selection-method combinations also passed at 320 × 740.

| Area              | Result                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Default input     | Am7 renders without autoplay                                                                                                  |
| Notes and recipes | Slash bass, missing-tone warnings, connected highlighting, playable staff and buttons                                         |
| Transposition     | Preserves inversion and selected progression step; existing exercise loads and transposes                                     |
| Playback          | Explicit start, stop, roll completion, progression advance, loop, mute, Escape                                                |
| Persistence       | Save/load view, step, key and tempo; escaped labels; legacy and new imports; rejected malformed import; downloaded export     |
| Sharing           | Reload restores chords/view/key/step/tempo without autoplay, including single-step progressions; older links remain supported |
| Keyboard          | Enter activates notes; focus survives catalog changes and returns after closing the notation draft                            |
| Mobile            | No document overflow; dense staff targets remain 44px; reference tables and both legacy catalog grids scroll locally          |
| Theme             | Light and dark workbench scans report zero axe 4.12.1 violations                                                              |
| Contrast          | Light/dark accessibility scans cover neutral and selected keyboard labels with the revised brass palette                      |
| Reduced motion    | Transitions remain off, including while switching themes                                                                      |
| Offline           | Fresh cached launch renders the workbench and page shell; chord changes and playback work with zero page errors               |
| Legacy pages      | Homepage and all music routes render, have one H1 and a static footer; basic legacy interactions pass                         |

The first mobile sweep found overflowing scales/chords tables and Stradella/Build grid views. All four passed after adding scroll regions. Offline testing exposed uncached shell scripts and hash-query cache misses; a fresh-browser retest passed after fixing both.

The explicit-view revision also passed browser checks for independent document restoration, candidate-versus-sequence boundaries, append/replace/reorder/remove, empty and single-step progressions, root movement/common-tone text, arrow-key note navigation, sounding states, loop playback, and stopping sound when switching views. Both renderer consumers passed; a fresh offline launch loaded the new renderer and view-state module and played a progression without page errors.

### Not verified

No subjective listening assessment, real-instrument fingering assessment, physical-device Safari/Firefox testing, or full screen-reader session was performed. The accessibility scan is not a substitute for those checks. External references, soundfont availability, and song synchronization were not re-audited. Nothing was pushed or deployed.
