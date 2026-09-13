# Two-hand layout prototype

Preview: `http://localhost:8877/_prototypes/two-hands/`

One Am7 example: selected-chord notation, independent button inspection, and a left-hand voicing chooser above the Stradella and B-system maps. The hands stack on smaller screens.

The diagrams share button appearance through `chord-study/buttons.css`, not musical geometry. Right-hand buttons retain piano key colors. Stradella buttons are neutral ivory, with columns identified by function; a major-chord button is not a piano key.

## Musical model

- Six columns, from right to left: counterbass (nearest the hand), bass, major, minor, seventh, diminished seventh. The four fundamental rows are A, D, G, C from top to bottom, so fifths run upward. Each row slants upward from right to left. Counterbass notes sit a major third above their row’s fundamental.
- The default recipe is A bass plus C major, producing A + C/E/G. Alternatives can add the A minor button or change the bass to another chord tone. The root ring marks the chord root, not an inversion’s bass.
- Chord-button tones use `StradellaData.BUTTONS`, including the project’s three-note seventh/diminished conventions. Actual reed/register combinations vary.
- The left-hand audio uses illustrative bass/chord registers. Selected-chord notation shows the right-hand voicing. Button-inspection notation is a separate, read-only pitch reference, not a transcription of every sounding left-hand reed.

Hover or keyboard-focus a left-hand button to link its tones across the diagrams. Clicking or tapping also plays it. The inspection panel draws every button tone, including those outside Am7, without changing the selected chord or recipe.

Spellings follow the button’s harmony: A7 uses C♯, and C diminished seventh uses B♭♭. Non-selected right-hand keys adopt the inspected spelling; selected keys retain the selected chord’s spelling. Pitch classes and audio are unchanged.

Dashed outlines show related pitches in every visible right-hand octave; solid brass halos show playback. Selection crosshatching remains limited to the exact right-hand voicing and left-hand recipe. Root rings stay unchanged. “Hear both hands” plays the selected left-hand recipe and right-hand voicing together.

A tapped button’s explanation stays available after its tone ends. Clear resets inspection without changing the selected chord. Escape also stops playback. Playing a right-hand note or both hands clears stale left-hand links.

The Stradella panel is a schematic excerpt, not a full 120-bass instrument or a fingering recommendation. On small screens it initially shows the right edge, with bass and counterbass visible, and scrolls within its panel. Arrow keys follow the displayed direction: left/right changes function, up/down moves through fifths.

No chord editing, persistence, or integration into the production workbench.

## Visual passes and validation

The first pass put the button-tone explanation below both diagrams. It now sits directly above them; the notation was tightened and narrow screens gained an explicit horizontal-scroll hint. The panels align at their headings and edges on desktop.

The left-hand diagram was rotated and then reflected vertically into the requested player-facing orientation. Counterbass remains on the right, the slant rises toward the left, and C sits below G below D below A. Button IDs, pitches, crosshatching, root rings, and linked-note behavior remain unchanged.

- Eight unit checks cover the reflected Stradella coordinates and arrow navigation, counterbass spelling, shared chord-button voicings, the Am7 recipe, demonstration registers, unavailable recipes, and selected/root markup.
- Chromium on Linux: all 24 left-hand buttons linked the correct pitch classes at 320, 390, 850, and 1440px in both themes. No page overflow, unchanged 48px targets and selection, and label contrast of at least 10.59:1.
- After reflection, screen coordinates confirmed A/D/G/C top to bottom and the upward right-to-left slant at all four widths in both themes. Arrow navigation, left-only playback, both-hand playback, and Escape passed again; the desktop dark-mode Axe scan had no violations or incomplete checks.
- Hover does not play audio. Keyboard focus overrides stale hover. Left-hand C major played C3/E3/G3 without claiming that the linked high notes were sounding; both-hand playback used the selected recipe and exact right-hand voicing.
- Right-hand playback, Escape, immediate play/stop, and clearing old links passed. After rotation, arrow navigation and both-hand playback were rechecked. Axe reported no violations; the narrow-screen scan had an incomplete contrast check for a partially clipped, horizontally scrollable column label.
- The earlier chord and progression screenshots remained byte-identical after extracting shared button CSS.

Run the new checks with `node _scripts/two-hands-prototype-test.js`. The prototype still needs visual review; these checks do not establish a fingering recommendation or real-instrument audio fidelity.

## Shared inspection checkpoint

`inspector.js` shares hand rendering, complete button notation, related-pitch links, and performance pitch lists with the progression prototype. Page controllers still own selection and playback. `chord-study/inspector.js` supplies the common notation renderer; the original chord screen remains visually unchanged.

- The 13 unit checks now also cover contextual seventh/diminished spellings, complete inspection voices, and all three exact progression recipes.
- The single-chord excerpt remains A/D/G/C, with the approved 10px column stagger. The progression supplies its larger fixed range separately.
- Inspection space is reserved so hovering a button does not move the instruments. Its notation has no play targets: tapping a displayed high reference note must not pretend to audition a low left-hand reed.
- The new notation API uses a versioned script URL in its consumers to avoid mixing cached old exports with the new inspector.

## Voicing choices

The chooser separates chord buttons from bass/inversion. `voicings.js` prefers ordinary major, minor, dominant-seventh, and diminished-seventh buttons where available. It treats conventional omitted fifths as intentional, not failed harmony matches. The legacy production catalog is unchanged.

- D7 uses D bass + D seventh by default. The A diminished-seventh alternative supplies the fifth when used with D bass.
- Am7 and Gmaj7 offer their usual catalog combination and a stacked-button alternative. Shared pitches sound once in the illustrative chord register.
- Bass choices use chord tones, preferring an available fundamental bass button and otherwise a counterbass button. Choices outside the fixed excerpt are disabled, not silently substituted.
- The readout lists actual left-hand tones and explains omissions or tones supplied by the unchanged right hand. Inversions change the low bass, not the selected chord or right-hand voicing.
- “Hear left hand” auditions the chosen combination alone. The main Stop button and Escape stop audio. Changing a choice stops any current playback and clears inspection.
- Prototype choices last until reload. The progression keeps a separate choice for each step.
