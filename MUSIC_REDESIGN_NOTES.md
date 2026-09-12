# Bayan notebook implementation

Branch: `design/bayan-notebook`. The source audit is in [MUSIC_DESIGN_AUDIT.md](MUSIC_DESIGN_AUDIT.md).

## What changed

- `/music/` now opens a playable Am7, not a directory of tools. Music has a direct navigation item and a homepage entry.
- The shared music layout uses paper, ink, and lacquer colors, with a dark counterpart. Explore, Practice, Play, and Read link to existing material.
- Notes, staff notation, B-system buttons, Stradella recipes, and sound describe the same musical object. Focus and hover connect the representations.
- Progressions retain the selected chord during transposition. Playback supports chords, upward rolls, tempo, looping, mute, and stop. Sound starts only after an explicit action.
- Saved practice keeps its notes, inversions, key, and tempo in this browser. JSON backups append rather than replace the library. Shared links contain musical state, not saved names or the library.
- Secondary controls sit below the chord. Wide notation and reference tables scroll within the page. The footer and update notice no longer cover content.
- The existing service worker caches the workbench and page shell. The installable app uses the notebook name and colors.

## Compatibility and boundaries

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
JEKYLL_ENV=production bundle exec jekyll build
node _scripts/music-build-test.js
node --check _site/sw.js
```

The local build used `.build-venv/bin` on `PATH` for its Python dependencies. Check the build log for YAML and Liquid exceptions as well as the exit status.

Results:

- 38 classifier cases, 19 model/diagram/persistence cases, and 7 player lifecycle checks passed.
- The production build passed. Its existing Sass and Rails deprecation warnings remain.
- Built-output checks passed for 14 music routes, 531 local links/assets, and 11 workbench dependencies in the offline cache. Shell precache entries, manifest syntax, table rendering, and development-control exclusion also passed.
- Scoped Prettier checks and `git diff --check` passed.

### Browser checks

Tested in isolated Chromium on Linux at 1440 × 900 and 390 × 844. The workbench also passed a 320px layout check.

| Area              | Result                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default input     | Am7 renders without autoplay                                                                                         |
| Notes and recipes | Slash bass, missing-tone warnings, connected highlighting, playable staff and buttons                                |
| Transposition     | Preserves inversion and selected progression step; existing exercise loads and transposes                            |
| Playback          | Explicit start, stop, roll completion, progression advance, loop, mute, Escape                                       |
| Persistence       | Save/load key and tempo, escaped labels, valid import, rejected malformed import, downloaded export                  |
| Sharing           | Reload restores chords/key/step/tempo without autoplay; malformed links show a clear fallback                        |
| Keyboard          | Enter activates notes; focus survives catalog changes and returns after closing the notation draft                   |
| Mobile            | No document overflow; dense staff targets remain 44px; reference tables and both legacy catalog grids scroll locally |
| Theme             | Light and dark workbench scans report zero axe 4.12.1 violations                                                     |
| Contrast          | Short button labels checked separately: active/inactive ratios 7.58/5.21 in light, 8.66/8.09 in dark                 |
| Reduced motion    | Transitions remain off, including while switching themes                                                             |
| Offline           | Fresh cached launch renders the workbench and page shell; chord changes and playback work with zero page errors      |
| Legacy pages      | Homepage and all music routes render, have one H1 and a static footer; basic legacy interactions pass                |

The first mobile sweep found overflowing scales/chords tables and Stradella/Build grid views. All four passed after adding scroll regions. Offline testing exposed uncached shell scripts and hash-query cache misses; a fresh-browser retest passed after fixing both.

### Not verified

No subjective listening assessment, real-instrument fingering assessment, physical-device Safari/Firefox testing, or full screen-reader session was performed. The accessibility scan is not a substitute for those checks. External references, soundfont availability, and song synchronization were not re-audited. Nothing was pushed or deployed.
