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
