# Bayan notebook implementation

Branch: `design/bayan-notebook`. The source audit is in [MUSIC_DESIGN_AUDIT.md](MUSIC_DESIGN_AUDIT.md).

## What changed

- `/music/` opens the progression workspace, initially Am7 → D7 → Gmaj7, or recovers the last local draft. Music has a direct navigation item and a homepage entry.
- The shared music layout uses paper, ink, and lacquer colors. Dark mode uses a muted brass accent, not pink. Explore, Practice, Play, and Read link to existing material.
- Notes, staff notation, B-system buttons, Stradella recipes, and sound describe the same musical object. Focus and hover connect the representations.
- Progressions retain the selected chord during transposition. Playback supports chords, upward rolls, tempo, looping, mute, and stop. Sound starts only after an explicit action.
- Saved practice keeps its notes, inversions, key, and tempo in this browser. JSON backups append rather than replace the library. Shared links contain musical state, not saved names or the library.
- Progression offers In a key, Matrix, Type, Pick notes, Transitions, and Patterns. The approved two-hand diagrams sit with the sequence and function explanations. Chord / notes retains its earlier direct-entry inspector. Wide notation and reference tables scroll within the page.
- The existing service worker caches the workbench and page shell. The installable app uses the notebook name and colors.

## Compatibility and boundaries

### Two explicit study views

Chord / notes and Progression keep separate selections, keys, and playback settings. Switching views stops playback without discarding either document. Both documents recover after reload from `musicWorkbenchDraft`; named copies remain in the existing `musicWorkbenchSetlist` library. Invalid draft data is retained rather than overwritten. A sequence typed in Chord / notes offers an explicit action to open Progression.

In Progression, browsing prepares a candidate. Hear it alone or between its actual neighbors, then insert at a `+` gap or replace one selected step. Move/remove and undo/redo work down to an empty sequence. Undo history lasts for the current page session and survives switching to Chord / notes; reload restores the current document, not its history. Uncommitted candidates and picker drafts are not saved.

Typed `C F G` means three chords in the composer. Note collections belong in Pick notes. Its staff and ordered editor preserve bass, pitch order, and a bounded octave through insertion, saving, transposition, and playback. Each pitch class appears once.

Major/minor analysis is separate from transposition. Function explanations consider the current chord and its neighbors, not an inferred song structure. Wheel root and quality changes update comparisons immediately; comparison candidates never move the wheel anchor. Selecting a progression step resets that anchor.

The hand inspector retains the approved Stradella orientation, independent button inspection, practical voicing choices, and fixed-across-sequence right-hand range. Left-hand choices belong to individual chord steps and survive moves, history, saving, and sharing. Transposition resets left-hand choices for the new pitches. Chord sketches remain available when the visible left-hand excerpt cannot play a chord; both-hand progression playback is disabled rather than silently skipping it.

Saved entries and share links retain the view, selected step, insertion gap, analysis mode, tempo, loop, sound mode, and ordered notes. Older entries and links still load. A shared link imports once and removes its musical query parameters, so reloading after edits recovers the new draft rather than re-importing the original link. Playback never starts on load.

### Shared vertical B-system renderer

`assets/js/music/bayan-keyboard.js` and `_sass/_bayan-keyboard.scss` serve both the workbench and simulator. A MIDI pitch always has the same column and row, regardless of the displayed range. Higher notes appear at the top.

`layout()` and `html()` provide geometry and markup. `mount()` renders into a container, `update()` changes selection/root state, and `bind()` supplies arrow navigation and activation callbacks, returning an unbind function. Options supply the MIDI range, exact selected notes, root, labels, and optional shortcuts. The primitive owns no audio, chord recognition, or progression state.

Buttons are 48px. Only the actual voiced MIDI notes are outlined, rather than every octave of their pitch classes. A double ring identifies the root; sounding notes use a filled state.

### Existing tools

All earlier music routes remain available, including `/music/workbench/`. Existing Stradella song storage and share formats are unchanged. The workbench reads the earlier prototype’s saved single-chord entries.

Audio is synthesized with Web Audio, not sampled from an accordion. Recipes show whether their pitch set is exact, which tones are missing or extra, and when a stack is theoretical rather than ergonomic. Registers and omitted chord tones vary by instrument.

The notation draft renders ABC but does not infer harmony. Arbitrary song-link imports remain unsupported. No personal recordings, artwork, or current practice activity were invented.

The notebook palette is scoped to music pages. The rest of the site retains its theme; its deliberate changes are the direct Music entry and non-fixed footer.

## Validation

Run from the repository root:

```sh
node _scripts/workbench-classify-test.js
node _scripts/workbench-model-test.js
node _scripts/workbench-player-test.js
node _scripts/bayan-keyboard-test.js
node _scripts/workbench-session-test.js
node _scripts/progression-composer-test.js
node _scripts/two-hands-prototype-test.js --production
JEKYLL_ENV=production bundle exec jekyll build
node _scripts/music-build-test.js
node --check _site/sw.js
```

The local build used `.build-venv/bin` on `PATH` for its Python dependencies. Check the build log for YAML and Liquid exceptions as well as the exit status.

### Composer integration, September 16

Production code lives under `assets/js/workbench/` and `_includes/music-composer.liquid`, not under `_prototypes/`. Promoted styles are scoped to `.progression-composer`; the prototype pages remain available as design references.

- 159 music regressions passed, plus the same 20 hand-diagram/voicing cases against the promoted production modules.
- Production build passed with existing Sass and Rails deprecation warnings. Checks cover 14 music routes, 554 local links/assets, 19 cached workbench dependencies, and duplicate IDs.
- The 215-assertion composer browser check passed inside `/music/` at 320, 390, 768, and 1440px in both themes.
- The integration browser check passed 31 assertions across editing and reload: shared hand selection, exact picked notes, independent chord-view editing, history, draft recovery, named saves, and link contents.
- A shared-link import retained subsequent edits after reload. Invalid links preserved the recovered draft. Corrupt draft storage remained untouched and did not affect named saved practice.
- 26 real-oscillator checks covered picked-note timing, candidate/context pitches, saved tempo, both-hand inversion pitches, synchronized step inspection, all Stop controls, and unsupported-hand warnings.
- Axe reported no violations in Pick notes and Transitions, including the hand inspector, at 390 and 1440px in settled light/dark themes. Arrow glyphs and clipped content left contrast checks incomplete. Theme animations must finish before scanning.
- An actual network-blocked reload recovered the draft, drew all 36 left-hand buttons, updated wheel comparisons, and played synthesized sound. An uncached request failed as expected; browser errors remained empty.

For the integrated preview, serve `_site` on forwarded port 4173:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory _site
```

Open **http://localhost:4173/music/** with the Mac → Piglab SSH tunnel connected. Port 5173 can continue serving the standalone prototypes.

### Inline chord grid

Explore’s progression now uses a four-column grid. Click an empty cell and type
one chord symbol, then press Enter or Tab to commit it and continue typing.
Edit a tile in place, drag it to another cell, or move it with Shift + arrow
keys. Dropping onto another chord swaps the two. Escape or Cancel discards
unfinished typing; Delete removes a focused tile. Document edits remain undoable.

Each tile plays for four beats. Empty cells are editing space, not rests.
Half/quarter tiles and meter-dependent durations are not implemented yet.

`chord-grid.js` owns the inline editor. `ComposerHarmony` owns placement and
history. Validated `gridCell` metadata survives drafts, named saves, share
links, and transposition. Older progressions fill consecutive cells. Narrow
screens scroll within the grid, retaining the same four-column layout.

Check placement with `_scripts/progression-composer-test.js` and the real UI
with `_scripts/chord-grid-browser-check.js` in an isolated browser.

### Earlier workbench validation

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
