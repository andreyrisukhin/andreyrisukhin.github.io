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

`fractions.js` uses reduced integer numerator/denominator strings and BigInt arithmetic. Geometry alone converts to floating point.
Every measure remains contiguous with positive spans summing exactly to one. Only the two adjacent spans change when a divider moves.
The prototype caps a measure at 256 spans and a single split at 64 parts to bound DOM editing cost; these are not rhythmic denominator limits.

This is a temporary scratch canvas: no storage, playback, or workbench integration.
Reload starts blank. Existing workbench and sheet-reader changes are untouched.
Reduced-motion preferences disable the pulse and tile animations.

Validation: `node _scripts/chord-canvas-test.js`, plus real browser entry, editing,
pointer/touch dragging, panning, keyboard movement, undo/redo, and responsive checks.
