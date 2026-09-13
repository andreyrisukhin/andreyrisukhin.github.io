# Chord-study layout prototype

One screen for visual review, separate from the current music pages. This folder is not included in the Jekyll site.

Serve the repository root locally, then open `/_prototypes/chord-study/`:

```sh
python3 -m http.server 8877 --bind 127.0.0.1 --directory /home/risuka/repos/andreyrisukhin.github.io
```

There is no build step, service worker, theme framework, or stored user data. Edit `style.css` and refresh. Shared music modules supply real chord data, notation, keyboard geometry, and synthesized audio. The prototype does not load the workbench controller.

## Review scope

- One input row, followed by one chord heading.
- A 960px frame, two desktop columns, and one mobile column.
- Shared left edges and section-heading baselines; 8px spacing increments.
- Neutral paper/graphite surfaces. Solid inverse fills identify selected notes; brass is reserved for hover, focus, and playback.
- Small ivory and charcoal dots retain piano key colors in either theme. Pitch class determines the dot, not enharmonic spelling. A contrasting inner ring distinguishes the root; playback adds an outer halo without changing the selection fill or orientation dot.
- Notes and the bass recipe remain separate from the right-hand keyboard.

Try the example chords, a longer chord name, playback, and dark mode. Judge alignment, reading order, spacing, and keyboard readability before adding progression controls or integrating this layout into the site.

This is intentionally not a feature-complete replacement. No progression editor, chord menu, note picker, saved library, or sharing controls.

## Visual iteration

The first screenshot pass exposed an oversized clef and too much space above the chord. The second exposed note labels distributed independently of the staff. Labels now use the notation’s actual horizontal positions. At narrow widths, long chord names keep their own line and playback moves below them.

Inspected the final desktop light/dark screens at 1440px, mobile at 390px, and a dense chord at 320px. The mobile keyboard follows the notes and bass recipe rather than squeezing beside them. That reading order remains a design decision for review.

Full ivory/charcoal faces helped orientation but competed with selected notes. The current version reduces that cue to 6px dots and uses solid inverse fills for selection. The root has an inner ring, keyboard focus a dashed outline, and playback a solid brass halo.

## Validation

- Chromium on Linux: seven chords at each of 320, 390, 720, 768, and 1440px. No page overflow or overlapping chord/playback headings; exact voiced-note selection and aligned notation labels.
- Desktop section-heading baselines and input-column edges agree within one pixel.
- Invalid input preserves the last valid result; examples restore the input and inspector together.
- Chord playback, stop, single-note playback, and keyboard arrow navigation checked.
- Axe reported no violations for the desktop dark and mobile light screens.
- JavaScript syntax, formatting, and 33 shared model/renderer/player tests passed.
- Current selection version: eight chords, including C♭ and B♯ roots, at 320/390/1440px in both themes. All 12 pitch classes retained their dot colors through selection and playback. Label contrast and selected/unselected face contrast were at least 11.15:1. Renderer/player tests passed again (14 checks).
- Live selected and unselected note playback preserves selection fills, dots, and root rings. Arrow navigation, dashed focus, the playback halo, and stop were checked together.
- Light/dark screenshots include natural and accidental roots. Axe found no violations; it could not evaluate the staff’s sharp glyph automatically, so its computed contrast was checked separately.

Visual approval is separate from these checks. Existing music pages, styles, and controllers are unchanged; integration and progression screens are outside this pass. The production site was not rebuilt for this standalone prototype.
