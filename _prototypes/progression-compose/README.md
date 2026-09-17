# Standalone progression composer

Open **http://localhost:5173/\_prototypes/progression-compose/** with the repository-root preview server running:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Port 5173 is included in the existing Mac → Piglab SSH forwards. Keep `ssh piglab` or `ssh piglab-lan` connected. Check that the port is free before starting another server.

This page remains a standalone design reference without hand diagrams. The chooser is now integrated with hand inspection, draft recovery, and saved practice at `/music/`. See [integration notes](../../MUSIC_REDESIGN_NOTES.md) for the production preview and validation.

## Selection flow

Choose a progression step to study its role. Choose a `+` gap to control insertion. All six sources prepare material on the scratchpad without editing the progression:

- **In a key:** major/minor triads or sevenths. Minor includes natural, harmonic, and ascending melodic collections. Borrowed colors and possible applied dominants are separate from the main palette.
- **Matrix:** compare qualities and extensions on one root. Common types are the default; the full catalog includes all 106 types in the bundled Tonal library, independently of Stradella recipes.
- **Type:** chord names, slash chords, whole phrases, or degrees. `C F G` means three major chords. `ii7 V7 Imaj7 in G major`, `iiø7 V7 i in A minor`, and `V7/V` work.
- **Pick notes:** see selected notes on a staff, replace them with the row selectors, or move/remove them. The first note is the bass. Hear the chord together or in order, then choose an interpretation. An unnamed note set remains usable and audible.
- **Transitions:** wheel root and quality changes immediately update fourth-up targets, common tones, stepwise bass changes, and same-root colors. Choosing a comparison candidate does not move this anchor. Selecting a progression step resets comparisons to that chord; changing gaps or source tabs preserves the wheel choice. The circle does not transpose or edit the sequence.
- **Patterns:** cadences, deceptive resolutions, plagal motion, turnarounds, a root cycle, and 12-bar blues.

Hear the candidate alone or between its actual neighbors. Insert at the selected gap, or replace one selected chord. A multi-chord phrase inserts rather than replacing one step. Move/remove and undo/redo work down to an empty progression. The limit is 128 chords and 100 undo checkpoints.

The mobile review link jumps to the candidate without inserting it. All three Stop controls cancel the same player. Tab arrows/Home/End navigate sources; sequence arrows move focus through chords and gaps. Enter/Space activates a focused control. Activating a picked staff note focuses its row selector. Note edits stop playback and clear the old interpretation. Escape stops audio. Ctrl/Cmd-Z and Shift-Z control history outside text/select inputs.

## Teaching boundaries

Degree labels and tonal functions are separate. Function explanations consider the chord, analysis key, and immediate neighbors, not a complete score or inferred song structure. They show possible tonal readings, not universally correct classifications.

The initial D7 offers tonic and deceptive-resolution comparisons plus an isolated F♯ → G / C → B demonstration. Am7 before D7 offers comparison with C major as another preparation. Major-key leading tones are not labeled as chromatically raised; minor-key V is distinguished from natural-minor v.

Roman roots are measured against the parallel major scale, so natural-minor roots use ♭III, ♭VI, and ♭VII. Bare Roman numerals specify triads; lowercase implies minor quality unless an explicit diminished/half-diminished suffix overrides it. Bare numbers 1–7 choose natural-collection sevenths, so `5` in A minor is Em7, while `V7` is E7.

An explicit key in typed input determines that candidate’s pitches. It does not silently change the progression’s analysis key. **Analyze in** changes explanations without moving notes; **Transpose notes** moves the progression while leaving the scratchpad unchanged.

Shared pitch classes are not proof of smooth voice leading. A circle-of-fifths neighbor is not automatically a better next chord. A non-chord slash bass is not an inversion. Blues and modal music may not fit the displayed major/minor functional reading.

Audio uses the existing synthesized player and ascending close chord sketches, not an optimized voice-leading arrangement or bayan registers. The isolated tendency-tone example is an explicit two-voice demonstration, not the voicing used by whole-chord playback.

Picked notes use a bounded voicing: the first pitch starts in octave four, and the remaining pitches stay within the octave above it, displayed in the chosen order. Staff, chord audition, ordered audition, and inserted progression playback use those same pitches. Interpretations, transposition, and undo/redo preserve that order. Each pitch class appears once; editable octaves, repeated pitches, and rhythm are outside this pass.

No persistence, URL import, song import, user-library integration, modal-key menu, rhythmic editing, or instrument playability filtering in this review pass. Reload restores the initial example.

## Validation

From the repository root:

```sh
node _scripts/progression-composer-test.js
node _scripts/workbench-model-test.js
node _scripts/workbench-player-test.js
```

The browser regression script runs against a freshly loaded page:

```sh
agent-browser --session YOUR_ISOLATED_SESSION open http://127.0.0.1:5173/_prototypes/progression-compose/
agent-browser --session YOUR_ISOLATED_SESSION eval --stdin < _scripts/progression-composer-browser-check.js
```

Validated in Chromium:

- 32 composer theory/document tests, plus 119 existing music tests.
- 215 real-UI assertions per run at 320, 390, 768, and 1440px in light and dark themes. Includes all catalog candidates, every source, note editing, all twelve wheel roots, insertion/replacement, history, key changes, empty recovery, and no page overflow.
- Actual oscillator pitches matched the tendency-tone demonstration, D7 → Em7 → Gmaj7 candidate context, and the unchanged Am7 → D7 → Gmaj7 progression.
- 21 additional real-audio assertions checked picked E4–C5–G4 pitches, simultaneous versus ordered scheduling, staff highlights, candidate/context/inserted playback, and cancellation through edits, all Stop controls, source changes, and Escape.
- Axe reported no violations for updated Pick notes and Transitions at 390 and 1440px in both themes. Arrow-only controls needed a manual contrast check: both themes exceeded 13:1, with 44px targets. At 390px, a partially clipped sequence label remained incomplete.
- Pointer and keyboard staff editing worked at 320px. The existing chord and two-hand study pages rendered their original Am7 notation without browser errors.
- Mobile review navigation focused the candidate, with its commit control visible.
- Syntax, Prettier, and diff whitespace checks passed.

No Jekyll rebuild was needed for these standalone files. Safari, Firefox, physical devices, and a full screen-reader session were not tested.
