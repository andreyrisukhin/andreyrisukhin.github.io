# Progression-study layout prototype

Open `http://localhost:8877/_prototypes/progression-study/` with the repository-root preview server running. No build step.

This fixed sequence studies Am7 → D7 → Gmaj7 in G major. Select a chord directly or use previous/next. Left/right arrows, Home, and End also work when a step button has focus. Left-hand voicings can be changed independently for each step.

“Play all” plays both hands from the beginning, at 96 BPM with four beats per chord. Selecting a step stops playback. “Hear both hands” plays the current chord’s recipe and right-hand voicing. Auditioning a button interrupts the sequence. Stop, Escape, and page visibility changes cancel playback.

The transition section looks ahead to the next chord. At the last step, it shows the arrival from D7 to Gmaj7 instead of inventing a return to Am7. Common tones are pitch classes, not a promise that these ascending voicings hold the same octave.

## Boundaries

- Uses the approved button stylesheet and shared `PrototypeHandInspector`. Selected-chord notation and complete button inspection remain independent; the original chord screen keeps its existing layout and behavior.
- Ivory/charcoal key faces, selected-key crosshatching, clear note labels, and the root ring remain unchanged.
- The right-hand keyboard uses one fixed C4–A♭5 window across all steps. The left-hand map stays B/E/A/D/G/C from top to bottom, extending the original excerpt to include B minor. Both maps retain their coordinates through chord changes.
- Defaults: Am7 uses A bass + C major; D7 uses D bass + D seventh; Gmaj7 uses G bass + B minor. The D7 button intentionally omits A, its fifth. D bass + A diminished seventh remains an optional full-pitch alternative.
- Both-hand playback uses illustrative low-register left-hand voices and the exact displayed right-hand voices. Button inspection shows all tones with harmonic spelling, but its notation is only a pitch reference. Left-only audio does not mark the high reference notes as sounding.
- Progression-specific CSS remains confined to the strip, step controls, and transition section. Hand and inspection layouts come from `two-hands/style.css`.
- No chord editing, saving, importing, key changes, tempo controls, or looping in this review pass.
- No service worker, stored data, or changes to the production music pages.

Review the reading order and the distinction between selecting a chord and following the progression before integration.

## Visual passes and validation

The first pass buried transition details beneath the bass recipe. They now sit beside the chord strip on desktop and directly below it on mobile. The progression controls were tightened to leave more room for the inspector.

- Chromium on Linux: all three steps in both themes at 320, 390, 768, and 1440px. Correct functions, common tones, endpoint controls, and exact MIDI selection; no page overflow.
- Button coordinates relative to the keyboard remain identical across steps. Crosshatching and 48px targets are unchanged.
- Full playback followed Am7 → D7 → Gmaj7 and stopped on the final chord. Step selection, single-note/chord interruption, immediate play/stop, Home/End navigation, and page-hide cancellation passed.
- Axe reported no violations. It could not evaluate the arrow buttons and sharp glyph automatically; their computed contrast exceeded 13:1 in both themes.
- The original chord screen’s baseline and final screenshots were byte-identical. Eight chord inputs, invalid-input recovery, example buttons, and playback passed after extracting the shared inspector.
- Syntax and formatting checks and 33 shared model/renderer/player tests passed. The production Jekyll site was not rebuilt because this remains a standalone prototype.

These are implementation checks, not visual approval. No changes have been integrated into the production workbench.

## Two-hand checkpoint

- All three steps and all 36 left-hand buttons checked at 320, 390, 768, 850, and 1440px in both themes. Complete inspected notes, exact recipes, unchanged selection during inspection, fixed map coordinates, and no page overflow.
- Actual oscillator pitches matched all three both-hand chords and all 36 individual left-hand buttons. Playback followed steps 0 → 1 → 2, then stopped with no stale highlights.
- Step selection, left/right auditions, immediate Stop, Escape, page-hide cancellation, Home/End, and extended left-hand arrow navigation passed.
- Axe reported no violations in the tested desktop light/dark and mobile screens. Its incomplete arrow/accidental contrast checks were verified from computed colors, with contrast at least 5.8:1.
- The original chord-screen screenshot stayed byte-identical after extracting reusable notation rendering.

## Voicing-choice checkpoint

Chord-button combinations and bass/inversions have separate selectors. Choices survive step navigation and “Play all,” but reset on reload. Changing either selector stops playback; it never changes the chord symbol, right-hand notes, or keyboard geometry.

“Hear left hand” isolates the selected low-register combination. The readout lists its actual notes, distinguishes conventional fifth omissions from tones supplied by the right hand, and identifies counterbass use. See `two-hands/voicings.js` for this prototype-only policy.

- 20 prototype unit checks cover defaults in all 12 keys, fuller alternatives, bass inversions, counterbass, deduplicated stacked pitches, and unavailable combinations. The 33 shared model/renderer/player checks also pass.
- All 24 available combination/inversion choices across the three steps passed at 320, 390, 768, and 1440px in both themes. Maps and right-hand selection stayed fixed; inspection stayed independent.
- Actual oscillator pitches matched standard D7, the fuller D7 alternative, and a complete sequence with different choices and inversions at every step.
- Native keyboard selection retained focus. Changing a voicing stopped sequence playback. Axe reported no violations in tested desktop and mobile screens; arrow/accidental checks and a partially clipped scrollable label remained incomplete.
