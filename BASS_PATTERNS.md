# Bass patterns

`/music/bass-patterns/` is a left-hand pattern notebook. The editor stores physical
Stradella button choices rather than inferring them from a chord name.

- A step has a duration and up to six simultaneous button presses. No buttons means a rest.
- Each press records the root column, row (bass, counterbass, major, minor, seventh, diminished), and optional finger 1–5.
- Duration uses 48 ticks per whole note. The editor supports whole through sixteenth notes and dotted values.
- Staff notation uses the existing button pitch sets, including the seventh and diminished omissions.
  Bass and chord registers are illustrative, not a claim about an instrument’s reed octaves.
- Notes crossing a barline are tied. Rests split without ties. Incomplete last bars are reported rather than silently padded.

Save keeps a named pattern in this browser; edits also preserve a local draft.
Saved basslines and three labeled examples appear as separate staff cards with
Play/Stop, Edit, and Copy. Playback uses local synthesized tones at the chosen
quarter-note tempo. Only one pattern plays at a time; Stop cancels pending starts.
New and pattern loads are undoable. Copy produces a `BP1.` text code containing
the title, meter, all steps, button choices, and fingers. Load validates the entire
code before replacing the draft. No server, login, or public user-data storage is involved.
Codes are UTF-8 JSON encoded as URL-safe base64, not encryption.

The browser key is `bayan.bass-patterns.v1`. Corrupt data and competing-tab writes
are not silently overwritten. Copy works without browser storage; a selectable
code is shown if clipboard access is unavailable.

Run `node _scripts/bass-patterns-test.js`, or add `--built` after a production
Jekyll build and PurgeCSS. Browser checks cover notation rendering, editing,
named saves, copy/load, responsive layouts, and offline reload.
Forced browser-storage denial also exposes existing theme/search-script errors;
the notebook catches its own storage failures and still offers copyable codes.
