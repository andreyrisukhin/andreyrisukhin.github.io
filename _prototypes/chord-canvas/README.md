# Chord canvas

An isolated interaction study, not part of the workbench or the Jekyll build.
Serve the repository root and open `/_prototypes/chord-canvas/`.

- Start with one slowly pulsing input in the center. Enter turns a valid chord into a colored tile.
- Click blank paper to type anywhere on an invisible grid. Typing with no editor open starts at the pointer.
- Drop a chord onto another to squeeze them into two half-width tiles in one grid space, 2 beats each instead of 4.
- Drop on the left or right to choose their order. Hover previews the squeeze; Escape cancels it.
- Drag either half out to separate them into full 4-beat cells again. Delete one half and the other expands.
- Each space holds two chords at most. A third chord bounces back without changing anything.
- Drag blank paper, scroll, or hold Space and drag to pan. The center control returns to the selected tile.
- Double-click or press Enter on a tile to edit. Arrows navigate; Shift + arrows move. Delete removes.
- Undo/redo cover completed edits and moves. Escape cancels typing or a drag.

Root pitch class sets the hue in circle-of-fifths order. Quality changes the shade.
Color is a visual aid, not a harmonic-function analysis.

This is a temporary scratch canvas: no storage, playback, quarter subdivisions, meter controls, or workbench integration.
Reload starts blank. Existing workbench and sheet-reader changes are untouched.
Reduced-motion preferences disable the pulse and tile animations.

Validation: `node _scripts/chord-canvas-test.js`, plus real browser entry, editing,
pointer/touch dragging, panning, keyboard movement, undo/redo, and responsive checks.
