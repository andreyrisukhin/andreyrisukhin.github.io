# Dev annotator iteration notes

A running record of how the sheet-music dev-annotator at
`/music/sheet/cogwork-dancers/` came together: what we borrowed from
`kunchenguid/lavish-axi`, what we adapted, what we replaced, what we
introduced, and the order in which feedback drove each change.

This file lives next to `NOTES-sheet-music-rendering.md` (which
covers OSMD rendering choices) and is the right place to look before
extending the annotator or wiring it into another page.

## What lavish-axi gave us

Lavish-axi (kunchenguid) is a generic page-annotation script: shift+click a
DOM element, attach a note, persist to localStorage, render a sidebar.
We started from its interaction model and went in a music-aware direction
from there.

### Kept (in spirit, not in code)

- **Shift-click as the pin modifier.** Plain clicks stay free for other
  interactions on the page (the chord inspector reuses them).
- **Sidebar of pins with attached notes.** Each pin has an id, a small
  context label, a textarea for free-form notes, and persists across
  reloads.
- **Pin "identity" as a snapshot.** Each pin captures enough about the
  thing it points at — selector, surrounding metadata, a thumbnail — that
  the script can re-anchor it on the next render.
- **Hover preview should exist before you commit a click.** Lavish has a
  preview, we have one. Different implementations.

### Adapted (took the idea, rewrote for music)

- **Identity capture.** Lavish stores a CSS selector and bounding box for
  generic DOM. Our `captureIdentity` (`assets/js/sheet-music/dev-annotator.js`)
  records musical identity instead: `kind` (`notehead` | `chord-symbol` |
  `region`), `pitches`, `clickedPitch`, `chordName`, `chordSymbol`,
  `measureNumber`, `staffIndex`, `isRest`, `isTied`, plus the selector and
  thumbnail as a fallback.
- **Sidebar.** Same idea, different layout. Each entry shows the context
  label and an autosaving textarea. CSS in `dev-annotator.css`.
- **Hover preview.** Lavish renders a translucent halo on whatever you'd
  click. Ours does the same in three colors keyed to pin kind: yellow
  notehead, blue chord symbol, grey-dashed region. The label format is
  music-aware: `Cm⟨C4⟩` for a chord stack, `G3` for a single note,
  `⁀ G3` for tied. Padding, glow, and z-index were tuned (3px border,
  28% fill, drop-shadow, `z-index: 2147483646`) until the highlight was
  legible against a 12-px notehead.

### Replaced (deliberately diverged)

- **Persistence.** Lavish writes to localStorage and stops there. We
  ALSO write to a Node sidecar at `localhost:4001`
  (`bin/dev-annotator-server.mjs`) which mirrors pins to JSON files in
  `.dev-annotations/`. This means feedback survives clearing browser
  storage, can be diffed in git, and can be `curl`'d from the terminal
  during iteration. `bin/dev-serve.sh` boots Jekyll + the sidecar in one
  command.
- **Hit testing.** Lavish trusts `event.target` because every DOM node
  is a fair annotation target. OSMD renders a few thousand SVG paths per
  page; treating each `<path>` as a target produces phantom pins. We
  classify before we pin: detect a chord-symbol via text content,
  resolve a notehead via DOM-anchored OSMD lookup (see below), and only
  fall back to a generic "region" pin when neither matches.

### Introduced (no lavish counterpart)

- **OSMD bridge** (`assets/js/sheet-music/osmd-bridge.js`). A thin
  facade over the OpenSheetMusicDisplay instance. Exposes `register()`,
  `resolveNoteAt(pageX, pageY, maxPxDistance, element)`, `svgToPage()`,
  and `snapshotAround()`.
- **DOM-anchored note resolution.** OSMD's `GetNearestNote` is a radial
  hit-test in OSMD's coordinate space — it snaps to whichever
  `GraphicalNote` is closest to the cursor, including rests in adjacent
  voices. The bridge now walks `graphic.MusicPages → MusicSystems →
  StaffLines → Measures → staffEntries → graphicalVoiceEntries → notes`
  and returns the GraphicalNote whose `vfnote.attrs.id` matches the
  clicked `.vf-stavenote` id (after stripping VexFlow's `vf-` prefix).
  For chord stacks, it disambiguates by matching the clicked
  `.vf-notehead` index against `gn.vfnoteIndex`. The radial search
  remains as a fallback for callers that hit-test by coordinate only.
- **Chord-symbol detection** (`detectChordSymbol` in `dev-annotator.js`).
  Walks the DOM upward from the click target looking for a `<text>` whose
  trimmed content matches the standard chord-symbol regex
  (`^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|m6|m7|maj7|7|9|11|13|°|ø)?(?:\/[A-G][#b]?)?$`).
  Hits become `kind: 'chord-symbol'` pins.
- **Tonal chord-name detection in the preview.** The bridge calls
  `Tonal.Chord.detect(pitches)` (the same vendored library that powers
  the chord-recognizer page) and returns the shortest match as
  `chordName`. The hover label becomes `GM⟨G3⟩`, the saved context becomes
  `m2 · staff 2 · GM · ⟨G3⟩ in [G3 B3 D4]`.
- **Three pin kinds with distinct visuals.** `notehead`, `chord-symbol`,
  `region` — colored yellow, blue, grey-dashed respectively, sharing one
  CSS module.
- **`?highlight=1` debug overlay.** A URL flag that paints every
  notehead and chord symbol on load (922 noteheads + 22 chord symbols on
  Cogwork Dancers). Used to validate classifier coverage by eye without
  having to hover each one.
- **Smoothness e2e harness** (`bin/test-smoothness.mjs`). Drives a real
  Chromium via the `agent-browser` skill and asserts:
  - latency budgets (click → pin DOM < 300 ms; click → sidebar < 300 ms;
    keystroke → sidecar save < 250 ms)
  - kind classification (3 known clicks → 3 expected pins)
  - thumbnail rasterization (each pin's PNG > 1 kB)
  - reload persistence (3 pins survive `agent-browser reload`)
  - chord disambiguation (clicking each notehead in a triad yields three
    pins with distinct `clickedPitch`)
  - graceful skip on rests when the score has none, and on `.vf-stavetie`
    pairs when none of them are actual ties (Cogwork Dancers'
    16 stave-ties are all slurs)
  - source-of-truth agreement (sample 60+ stavenotes; for each, the
    bridge's `isRest` must equal `sourceNote.isRestFlag`)
  Latest count: 45 passed, 0 failed.

## How we got here

A compressed log of what each commit added, in the order they shipped.
Numbers in parentheses are commit shorthashes from `git log`.

1. **`d64ba65`** — initial Cogwork Dancers page. OSMD renders the score
   from `cogwork-dancers.musicxml`. No annotation surface yet.
2. **`1c420c4`** — first dev annotator. Shift+click → pin → sidebar.
   Inspired by lavish; identity is just CSS selector + bbox.
3. **`95c3f0d`** — fix: pins now actually render, sidebar replaces a
   confused prompt.
4. **`2b3d7d4`** — semantic pins (three kinds), sidecar persistence at
   `:4001`, chord inspector popover for non-shift clicks.
5. **`badbd2a`** — thumbnails draw a red bbox + blue crosshair so the
   reader can confirm what was identified as the click target.
6. **`3739424`** — pitch-name bug: OSMD's `Pitch.ToString()` returns
   `"Key: Eb, Note: 4, octave: 2"`. Replaced with a direct read of the
   `FundamentalNote` enum, returns `"Eb4"`.
7. **`614f44c`** — three pin kinds shipped, e2e smoothness harness
   added (18 assertions).
8. **`419b9b6`** — first hover preview. Shift+hover paints an outline
   in the kind's color with a label.
9. **`5e6bf15`** — preview was invisible at default styling. Thickened
   border to 3 px, added drop-shadow glow, raised z-index. Also
   added `?highlight=1` debug overlay.
10. **`0d92f0f`** — DOM-first notehead detection. Hovering on a stem
    used to fail because OSMD's centroid radius (~36 px) didn't reach
    the stem end. The classifier now treats `closest('.vf-stavenote')`
    as authoritative and consults OSMD only for labels (with a wider 80-
    unit radius). Same change applied to `captureIdentity` so click and
    preview agree.
11. **`33e9c67`** — chord disambiguation, rest detection, tied flag.
    `pitches[0]` was always the lowest note in a chord; replaced with
    `clickedPitch` which OSMD already disambiguated by Y. Added
    `isRest` (from `sn.isRestFlag`) and `isTied` (from `sn.NoteTie`)
    to the bridge output. Tests F/G/H added (chord, rest, tie); F
    passes, G/H skip on this score because it has 0 rests and all
    `.vf-stavetie` are slurs.
12. **`f37bac7`** — feedback round 1: two pins flagged real notes as
    "rest" because OSMD's coordinate-based `GetNearestNote` snapped to
    a rest in an adjacent voice. Replaced with the DOM-anchored
    `graphicalNoteFromElement` walker. Scenario I added: sample 60+
    stavenotes against `sourceNote.isRestFlag` ground truth.
13. **`293d4b2`** — feedback round 2: chord stacks should be labeled
    by their detected chord name. Wired Tonal into the bridge as
    `detectChordName(pitches)`. Hover label became `GM · G3`, saved
    context became `GM · ⟨G3⟩ in [G3 B3 D4]`.
14. **`9377abf`** — preview label refactor. Drop the trailing
    `· mN` measure tag (the saved pin context still records it) and
    switch chord-stack labels to `Chord⟨Note⟩` syntax (`Cm⟨C4⟩`) so
    the chord identity and the cursor's specific tone are visually
    distinct without crowding. NOTES-dev-annotator.md added.
15. **`2c83a5d`** — pin #7. Scenario H rewritten to walk OSMD's
    graphic tree for `sourceNote.NoteTie` instead of the
    `.vf-stavetie` SVG class (which lumps ties + slurs and was
    skipping every run). Asserts `isTied=true` and a non-null
    `clickedPitch` on 8 actual ties from m54-77. m20 chord
    recognition (`Cm`) was already shipped in `293d4b2`.
16. **`717c33d`** — pin #6 part 1. Hide static chord-symbol text in
    the score: OSMD's `RenderChordSymbols=false` kills 20 of 22
    symbols, a small MutationObserver tags and hides the 2 remaining
    `g.vf-text > text` direction labels matching the chord-symbol
    regex. Scenario B injects its own `g.vf-text` with
    `data-test-injected` so the hider skips it.
17. **(this commit)** — pin #6 part 2. Lifted
    `renderStradellaInfo` out of `chord-recognizer/main.js` into a
    shared `assets/js/music/stradella-recipe.js` (`StradellaRecipe.render(name)`).
    Chord recognizer now wraps it and rewrites class hooks for its
    existing CSS. Sheet-music page loads it alongside `Music`/`StradellaData`.
    `chord-inspector.js` now: (a) calls
    `bridge.resolveNoteAt(..., element)` so it gets the same
    DOM-anchored pitch resolution + Tonal `chordName` as the hover
    preview; (b) renders the deeper Stradella section via the shared
    helper instead of the old hard-coded 4-voicing `suggestStradella`;
    (c) toggles by class instead of `hidden` attribute, with a 160 ms
    opacity + transform transition (the fade requested in pin #6).
    Same-chord re-click hides; Escape, scroll, resize all hide and
    reset the toggle key. Scenario J asserts visibility, opacity,
    Stradella section presence, and the toggle behavior.

## Pending (not in `main` yet)

- **Lavish gaps still deferred.** Shadow-DOM isolation for the sidebar,
  draft/cancel card flow, text-range annotations, opt-out sentinels for
  the zoom controls. None of these are blocking; the current annotator
  is good enough for solo iteration on Cogwork Dancers.

## Running locally

```sh
bin/dev-serve.sh         # Jekyll on :4000 + sidecar on :4001
node bin/test-smoothness.mjs   # 36 e2e assertions
```

The sidecar is the source of truth for feedback in
`.dev-annotations/`. `curl localhost:4001/load?pathname=/music/sheet/cogwork-dancers/`
returns the current pin set as JSON; useful when fetching feedback for
a code change without touching the browser.
