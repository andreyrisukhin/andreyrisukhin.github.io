# Bass patterns

`/music/bass-patterns/` is a left-hand pattern notebook with a direct staff editor.
Click a pale rest to enter a note at that pitch. Drag a note vertically to change
its pitch. Use Chord (or Shift-click) to add simultaneous tones, and Rest to place
silence. Duration and accidental controls also edit the selected note.
Pale entry slots are not saved or played. The staff scrolls horizontally on small
screens; its pitch spacing does not shrink to fit the viewport.

Arrow keys select steps and move pitches. A–G enters a pitch, Enter fills an empty
slot, Delete removes the selected chord tone or step, and Space plays/stops.
Undo/Redo also work with Ctrl/Cmd-Z and Ctrl/Cmd-Shift-Z while the staff has focus.
Button assignments and step ordering remain in an optional disclosure.

- A step has a duration and either up to six simultaneous button presses or up to
  twelve written pitches (MIDI 24–84, with natural, sharp, or flat spelling).
  An empty note/button list means a rest.
- Each press records the root column, row (bass, counterbass, major, minor, seventh, diminished), and optional finger 1–5.
- Duration uses 48 ticks per whole note. The editor supports whole through sixteenth notes and dotted values.
- Existing button patterns use the instrument pitch sets, including the seventh and diminished omissions.
  Bass and chord registers are illustrative, not a claim about an instrument’s reed octaves.
- Direct staff edits preserve exact written pitches and playback octaves. Changing
  a button-based step’s notes clears that step’s button assignments with a notice;
  Undo restores them. Untouched steps and saved patterns retain their fingers.
  Assigning buttons explicitly replaces that step’s written notes.
- Notes crossing a barline are tied. Rests split without ties. Incomplete last bars are reported rather than silently padded.

Save keeps a named pattern in this browser; edits also preserve a local draft.
Saved basslines and three labeled examples appear as separate staff cards with
Play/Stop, Edit, and Copy. Playback uses local synthesized tones at the chosen
quarter-note tempo. Only one pattern plays at a time; Stop cancels pending starts.
New and pattern loads are undoable. Copy produces a `BP1.` code for legacy button
patterns or `BP2.` for staff-edited patterns. Both retain the title, meter, all
steps, notes or button choices, and fingers. Existing BP1 codes still load unchanged.
Load validates the entire code before replacing the draft.
No server, login, or public user-data storage is involved.
Codes are UTF-8 JSON encoded as URL-safe base64, not encryption.

The browser key is `bayan.bass-patterns.v1`. Corrupt data and competing-tab writes
are not silently overwritten. Copy works without browser storage; a selectable
code is shown if clipboard access is unavailable.

The supplied `prison blues bassline.mxl` is represented by
`_data/bass_patterns/prison_blues.json`: staff 2, voice 5, four complete 6/8 bars,
three flats, exact source octaves, Cm and E♭ labels, and an end repeat. The hidden
treble staff contains only full-bar rests and is omitted. Play performs the repeat
once (two passes). The file has no tempo marking; the page tempo controls playback.
No physical buttons or finger numbers are inferred from the imported pitches.

Run `node _scripts/bass-patterns-test.js`, or add `--built` after a production
Jekyll build and PurgeCSS. Browser checks cover notation rendering, editing,
named saves, copy/load, responsive layouts, and offline reload.
`python3 _scripts/bass-patterns-mxl-check.py` compares the imported data directly
against the supplied MusicXML. `_scripts/bass-patterns-staff-check.py` covers
pointer/touch/keyboard entry and every pitch/onset in the imported playback.
Forced browser-storage denial also exposes existing theme/search-script errors;
the notebook catches its own storage failures and still offers copyable codes.
