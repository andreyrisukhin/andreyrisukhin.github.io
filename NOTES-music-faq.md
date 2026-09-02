# Music FAQ

A growing set of explanations the chord inspector and sheet-music
overlays should be able to surface (eventually pulled into a real FAQ
panel on the site). Each entry is a self-contained Q&A — short
headline, short answer, optional deep-dive, source pointers.

---

## Stradella recipes

### Why does the inspector recommend "B♭d7 / E♭" for E♭7 instead of just the "7" button on E♭?

**Short answer.** The "7" button on E♭ alone only supplies 3 of E♭7's
4 notes. The "5d7" trick — d7 button rooted on the chord's 5th, over
the original bass — supplies all four.

**Long answer.**

Stradella accordion buttons are deliberately incomplete to fit on a
small chord side. From `assets/js/music/stradella-data.js`:

```
'7':  [0, 4, 10]   // root + M3 + ♭7  (no 5th)
'd7': [0, 3,  9]   // root + m3 + M6  (no ♭5)
```

For E♭7 (= E♭ G B♭ D♭):

| Voicing | Bass + button | Notes produced | Match for E♭7 |
|---|---|---|---|
| "7" on E♭ | E♭ bass + E♭-7 button | E♭ G D♭ | missing the B♭ |
| "5d7" on E♭ | E♭ bass + B♭-d7 button | E♭ + B♭ D♭ G | exact, all four |

The B♭-d7 button (B♭, D♭, G) lays out, relative to E♭, as **5–♭7–3**
— that's the explanatory line you see in the inspector
(`5d7 = 5–♭7–3; full 1–3–5–♭7`).

**The trick generalises.** For any plain dominant 7 chord with no
extensions: press the d7 button on the chord's 5th, over the original
bass. The voicing always lands on 5–♭7–3 of the original chord.

**Why doesn't the inspector also offer the simpler partial?** It's in
the data as a separate entry (`id: '7partial'`, suffix `'7 (no 5)'`).
`findBySuffix` is an exact-string match against Tonal's suffix, and
Tonal labels the chord as plain `'7'`, so only the canonical 4-note
voicing surfaces. A future change can teach `findBySuffix` (or the
`StradellaRecipe.render` wrapper) to also surface viable simpler
voicings tagged with their tradeoff.

**Fallback if your accordion has no d7 row.** Some 48-bass instruments
omit it. The data falls back to "5m" (B♭ minor button), which gives
B♭ D♭ F: nails the ♭7 but loses the major 3rd. The inspector flags
that approximation in orange.

Sources:
- `assets/js/music/stradella-data.js` lines 11–12 (button intervals),
  111–117 (the "7" entry with `5d7 = 5–♭7–3` note and the m fallback).
- `assets/js/music/stradella-recipe.js` (`render(chordName)`).
- `assets/js/sheet-music/chord-inspector.js` (deep-lookup display).

---

### Does the 5d7 voicing sound noticeably lower than just pressing the 7 button?

**Short answer.** No. Stradella chord buttons sound in a fixed
register regardless of which chord you press, so swapping the E♭-7
button for the B♭-d7 button doesn't move pitch down — it just trades
which three notes light up inside that fixed register. The 5d7 is
*fuller*, not lower.

**Long answer.**

A Stradella chord button has three reeds tuned in close position,
roughly the F3–E♭4 octave on most instruments. Every chord button on
every root sounds in that same register; the "name" tells you which
three pitches, not where. (Bass row is the part that's actually low
— typically E♭2 with octave coupling adding E♭3.)

For E♭7 with E♭ bass:

| Voicing | Bass press | Chord button sounds (approx) | Combined |
|---|---|---|---|
| Bare 7 | E♭2 + E♭3 | E♭3 + G3 + D♭4 | E♭2, E♭3 *doubled*, G3, D♭4 |
| 5d7 trick | E♭2 + E♭3 | B♭3 + D♭4 + G3 | E♭2, E♭3, G3, **B♭3**, D♭4 |

Same E♭ bass. Same G3, same D♭4. The 5d7 swap *removes* the
redundant E♭3 doubling that the bass already covers and *adds* the
missing 5th (B♭3). Strictly an upgrade in chord completeness, no
register change.

**What is worth testing on your specific instrument.**

- **Articulation at tempo.** LH finger travel from E♭ bass to B♭
  chord button (a 5th up the chord side) vs. staying under the E♭
  chord button. Faster passages may favor the bare 7 just for the
  reduced jump.
- **Reed balance.** Chord-button reeds on some accordions are reedier
  or quieter than bass reeds; the added B♭ might or might not poke
  through your instrument's voicing.
- **Genre fit.** Jazz / serious arrangement → 5d7 usually wins.
  Folk / oompah / fast comp → bare 7 is often acceptable, the missing
  5th is implied by context. For a syncopated piece like Cogwork
  Dancers, try both back-to-back at tempo.

Pitch-wise, no test needed: it will not drop.

Sources:
- Stradella reed layout convention (chord-button close-position
  voicing in a fixed octave, bass-row octave coupling): general
  accordion reference, e.g. Bartolomeo Bortolazzi or any 120-bass
  Stradella manual.
- `assets/js/music/stradella-data.js` (chord-button interval sets).
