# Two-hand layout prototype

Preview: `http://localhost:8877/_prototypes/two-hands/`

One Am7 example: chord-tone notation above a Stradella schematic and B-system keyboard, with the written left-hand recipe below. The hands stack on smaller screens.

The diagrams share button appearance through `chord-study/buttons.css`, not musical geometry. Right-hand buttons retain piano key colors. Stradella buttons are neutral ivory, with rows identified by function; a major-chord button is not a piano key.

## Musical model

- Four neighboring columns in fifths: C, G, D, A. All six Stradella rows are shown, nearest the bellows first. Counterbass notes sit a major third above their column’s fundamental.
- The selected recipe comes from the existing model: A bass plus C major, producing A + C/E/G. The root ring marks A bass on the left and A4 on the right.
- Chord-button tones use `StradellaData.BUTTONS`, including the project’s three-note seventh/diminished conventions. Actual reed/register combinations vary.
- The left-hand audio uses illustrative bass/chord registers. The notation is a shared pitch-class reference in the right-hand octave, not a transcription of every sounding left-hand reed.

Hover or keyboard-focus a left-hand button to link its tones across the diagrams. Clicking or tapping also plays it. The detail panel lists every tone, including any outside Am7, so the diagram never silently drops an extra note.

Dashed outlines show related pitches in every visible right-hand octave; solid brass halos show playback. Selection crosshatching remains limited to the exact right-hand voicing and left-hand recipe. Root rings stay unchanged. “Hear both hands” plays the selected left-hand recipe and right-hand voicing together.

A tapped button’s explanation stays available after its tone ends. Escape stops playback and clears that inspection. Playing a right-hand note or both hands also clears stale left-hand links.

The Stradella panel is a schematic excerpt, not a full 120-bass instrument or a fingering recommendation. It scrolls within its panel on small screens. Arrow keys navigate adjacent buttons.

No editing, persistence, or integration into the production workbench.

## Visual passes and validation

The first pass put the button-tone explanation below both diagrams. It now sits directly above them; the notation was tightened and narrow screens gained an explicit horizontal-scroll hint. The panels align at their headings and edges on desktop.

- Seven new unit checks cover Stradella coordinates, counterbass spelling, shared chord-button voicings, the Am7 recipe, demonstration registers, unavailable recipes, and selected/root markup.
- Chromium on Linux: all 24 left-hand buttons linked the correct pitch classes at 320, 390, 850, and 1440px in both themes. No page overflow, unchanged 48px targets and selection, and label contrast of at least 10.59:1.
- Hover does not play audio. Keyboard focus overrides stale hover. Left-hand C major played C3/E3/G3 without claiming that the linked high notes were sounding; both-hand playback used the selected recipe and exact right-hand voicing.
- Right-hand playback, Escape, immediate play/stop, and clearing old links passed. Axe reported no violations or incomplete checks in the tested light/dark screens.
- The earlier chord and progression screenshots remained byte-identical after extracting shared button CSS.

Run the new checks with `node _scripts/two-hands-prototype-test.js`. The prototype still needs visual review; these checks do not establish a fingering recommendation or real-instrument audio fidelity.
