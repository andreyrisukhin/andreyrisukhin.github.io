# Tactus

Tactus is the music library behind the `/music/` tools: rendering, playing, and
editing music in the browser. It lives in `assets/js/tactus/` until it is ready
to move into its own repository, so it must not depend on site code.

Rules for code in `assets/js/tactus/`:

- Plain browser JavaScript, no build step. Each file registers itself on
  `window.Tactus` and also exports through `module.exports` for Node tests.
- No dependencies on site globals (`MusicTheory`, `WorkbenchPlayer`, page DOM).
  Optional third-party globals such as `Soundfont` are looked up at call time.
- Each module has a unit test in `_scripts/tactus-*-test.js`.

## Audio (`tactus/audio.js`)

One `AudioContext` per page, shared by every player:

```text
voice → output(family) → master → limiter → speakers
```

- `Tactus.audio.context()` creates or resumes the shared context. Call it
  synchronously in a click or key handler; Safari will not start audio that
  was first touched after an `await`.
- `Tactus.audio.resume()` resolves with the running context.
- `Tactus.audio.output(family)` returns the bus a voice connects to instead of
  `ctx.destination`. Families: `soundfont`, `synth` (oscillators), `piano`
  (the additive piano fallback), and `sample` (bayan recordings).
- `Tactus.audio.soundfont(name)` loads a MusyngKite instrument once per page,
  already wired to the `soundfont` bus. A failed load can be retried.
- `Tactus.audio.stop(instrument)` silences an instrument's scheduled notes.
  Players pause this way; they never close the shared context.
- `Tactus.audio.setVolume(0–1)` sets the master level.
- `Tactus.audio.meter()` reports gated RMS and peak before and after the
  limiter.

### Loudness calibration

Each page's normal playback should land near **−27 dBFS gated RMS** on the
master bus (±2 dB). Per-family trims live in `TRIMS_DB` in `audio.js`; note
levels inside each player set the balance within a family. The limiter
(threshold −6 dB, ratio 12) adds about +3 dB of makeup gain and only catches
stacked peaks.

After changing a voice or a note level, rebuild and run the in-page check on
each affected page, in a browser launched with
`--autoplay-policy=no-user-gesture-required`:

```sh
agent-browser --args "--autoplay-policy=no-user-gesture-required" open http://127.0.0.1:4000/music/bass-patterns/
agent-browser eval --stdin < _scripts/tactus-loudness-check.js
```

Use a fresh browser session after a rebuild; the service worker otherwise
serves the previous scripts.

Measured on 2026-09-26 (gated RMS before the limiter):

| Page                               | Voice                     | dBFS  |
| ---------------------------------- | ------------------------- | ----- |
| Sheet: Reconstructing More Science | soundfont (drawbar organ) | −27.1 |
| Sheet: Cogwork Dancers, live       | soundfont (accordion)     | −28.2 |
| Bass patterns (Prison Blues)       | synth                     | −27.9 |
| Workbench                          | synth                     | −28.9 |
| Blues                              | synth                     | −28.2 |
| Exercises                          | soundfont (piano)         | −28.4 |
| Stradella                          | soundfont (piano)         | −27.2 |
| Bayan simulator                    | sample                    | −27.1 |

The Cogwork Dancers recording plays through an `<audio>` element outside the
engine and measures −27.6 dBFS.

## Roadmap

1. Shared audio engine, voice buses, calibrated trims, limiter. (Done.)
2. One transport (clock, lookahead scheduler, loop, rate) shared by the sheet
   player, practice player, bass patterns, and workbench.
3. A voice registry (soundfont, triangle synth, additive piano, bayan samples,
   recordings) with per-instrument trims, replacing the copies in each page.
4. A score model with adapters (MusicXML/OSMD, bass-pattern JSON, workbench
   chords), with transposition as a score transform.
