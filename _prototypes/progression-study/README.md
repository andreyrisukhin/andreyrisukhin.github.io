# Progression-study layout prototype

Open `http://localhost:8877/_prototypes/progression-study/` with the repository-root preview server running. No build step.

This read-only screen studies Am7 → D7 → Gmaj7 in G major. Select a chord directly or use previous/next. Left/right arrows, Home, and End also work when a step button has focus.

“Play all” starts at the beginning, at 96 BPM with four beats per chord. Selecting a step stops playback. “Hear chord” or a note button interrupts the sequence and plays only that selection. Stop and page visibility changes cancel playback.

The transition section looks ahead to the next chord. At the last step, it shows the arrival from D7 to Gmaj7 instead of inventing a return to Am7. Common tones are pitch classes, not a promise that these ascending voicings hold the same octave.

## Boundaries

- Uses the approved chord stylesheet and a shared `PrototypeChordInspector`; the chord screen keeps its existing layout and behavior.
- Ivory/charcoal key faces, selected-key crosshatching, clear note labels, and the root ring remain unchanged.
- The keyboard uses one fixed C4–A♭5 window across all steps, so the instrument does not shift during playback. This wider range is intentional; the single-chord screen keeps its smaller window.
- Progression-specific CSS is confined to the strip, step controls, and transition section.
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
