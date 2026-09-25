# Chord canvas

An isolated interaction study, not part of the workbench or the Jekyll build.
Serve the repository root and open `/_prototypes/chord-canvas/`.

- Start with one slowly pulsing input in the center. Enter turns a valid chord into a colored tile.
- Click blank paper to type anywhere on an invisible grid. Typing with no editor open starts at the pointer.
- Each grid space is a measure with an ordered list of exact fractional spans.
- Drop onto a chord to halve only its span. Repeat for quarters, eighths, and mixed subdivisions. Drop on the left or right to choose order.
- Select a span and choose Split… for 2–64 equal parts or positive ratios such as `2:1` or `1/2:1/3`. The first part retains the chord; the others start empty.
- Moving or clearing a chord leaves an empty timed span. Dropping into an empty span fills its duration. Moving to unused canvas preserves duration and pads the new measure with an empty remainder.
- Drag a divider to resize only its two neighbors. Choose musical snapping or a fixed division in settings. Focus a divider and use arrows, Home, or End for keyboard resizing.
- Use time zoom (1×–64×), or Zoom to selected span, to edit small subdivisions. Narrow spans hide text, not content; Tab and arrows still select them for editing and splitting.
- Meter settings change duration labels while preserving fractions. Non-quarter meters show their note unit explicitly, rather than assuming a compound-meter beat.
- Drag blank paper, scroll, or hold Space and drag to pan. The center control returns to the selected tile.
- Double-click or press Enter on a tile to edit. Arrows navigate; Shift + arrows move. Delete clears the chord without retiming its neighbors.
- Remove empty measure explicitly removes an all-empty measure. Blank canvas is not a rest.
- Undo/redo cover entry, movement, splits, resizing, meter, and clearing. Escape cancels typing, hover previews, and divider drags without adding history.

Root pitch class sets the hue in circle-of-fifths order. Quality changes the shade.
Color is a visual aid, not a harmonic-function analysis.

Chord aliases remain valid input, but entry and loaded files use consistent
display names: plain major roots, `m`, `maj7`, `m7`, `7`, `sus4`, `7sus4`,
`aug`, `dim`, `dim7`, `m7b5`, and `mMaj7`. For example, `CM` becomes `C`,
`Bmin7` becomes `Bm7`, and `Cø` becomes `Cm7b5`. Roots, enharmonic spellings,
slash basses, and notes are preserved. Equal pitch sets with different roots,
such as `C6` and `Am7`, remain distinct.

`fractions.js` uses reduced integer numerator/denominator strings and BigInt arithmetic. Geometry alone converts to floating point.
Every measure remains contiguous with positive spans summing exactly to one. Only the two adjacent spans change when a divider moves.
The prototype caps a measure at 256 spans and a single split at 64 parts to bound DOM editing cost; these are not rhythmic denominator limits.

## Saving and loading

Committed edits autosave after 200 ms in this browser under `chord-canvas.autosave.v1`.
Reload restores chords, exact fractions, timed empty spans, coordinates, meter, zoom, pan, selection, and divider snapping.
Press Enter to commit typing; unfinished input and undo history are not saved across reloads.
The File control remains available on an empty canvas. Save (or Ctrl / ⌘ S) downloads a portable JSON backup;
Load validates the entire file before asking to replace the canvas. A load is one undo step.
Copy puts the same JSON on the clipboard, including any valid typed chord. If clipboard access is blocked, use Save.
The file panel shows only these three buttons by default, with brief feedback or recovery controls when needed.

This is one browser-local save, not cloud storage. A different hostname, port, browser, or device has a separate save.
Clearing browser data removes it. If storage is blocked/full, use JSON downloads.
Unreadable or newer-version saves are not overwritten. Changes from another tab pause autosave rather than silently replacing that copy;
File offers Load browser save or Use this canvas, with confirmation. Download both copies before choosing.

`document.js` defines version 1 of the `chord-canvas` JSON format.
The ordered `cells` array stores IDs, measure coordinates, chord names (`null` for an empty span), and reduced `{n,d}` duration strings.
Starts and colors are derived, never trusted from imported files. Meter is required; view is optional.
Files are limited to 2 MB, 4096 spans overall, 256 per measure, and 4096 digits per fraction component/cumulative denominator.
Unknown versions, invalid chords/IDs/views, nonpositive durations, and measures not summing exactly to one reject without changing the canvas.
`storage.js` handles browser-save failures and checks for competing writes before saving.

No playback or workbench integration. Existing workbench and sheet-reader changes are untouched.
Reduced-motion preferences disable the pulse and tile animations.

Validation: `node _scripts/chord-canvas-test.js`, plus real browser entry, editing,
pointer/touch dragging, panning, keyboard movement, undo/redo, and responsive checks.
Run `_scripts/chord-canvas-persistence-check.py` with a Playwright-enabled Python.
It accepts `--url` for the source server and `--chromium` for an installed executable.
It uses isolated browser contexts for reload, download/upload, clipboard copying, mobile layout, touch controls,
cross-tab conflicts, corrupt/newer saves, denied storage, and quota failures.
