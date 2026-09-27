// In-page check that Señorita's left-hand staff plays Stradella basses as
// single notes and chord-button notes as full chords named by the chord
// cues above the staff (am, c, f, em, g). Evaluate on the built page:
//
//   agent-browser open http://127.0.0.1:4000/music/sheet/senorita/
//   agent-browser eval --stdin < _scripts/sheet-playback-stradella-check.js
(async () => {
  for (let i = 0; i < 100 && !(window.__playback && window.__playback.events.length); i++) await new Promise((r) => setTimeout(r, 100));
  const engine = window.__playback;
  if (!engine) throw new Error("Playback engine did not start");
  if (!engine.stradellaBass) return { pass: false, problems: ["page does not enable data-playback-stradella"] };
  const quarter = 60 / engine.bpm;
  const measures = engine.osmd.Sheet.SourceMeasures;
  // Root pitch class -> chord intervals from the score's cues.
  const EXPECTED = { 9: [0, 3, 7], 0: [0, 4, 7], 5: [0, 4, 7], 4: [0, 3, 7], 7: [0, 4, 7] };
  const near = (a, b) => Math.abs(a - b) < 0.001;
  let basses = 0;
  let chords = 0;
  const problems = [];
  measures.forEach((measure, m) => {
    for (const container of measure.VerticalSourceStaffEntryContainers) {
      const startSec = engine.measureStarts[m] + container.Timestamp.RealValue * 4 * quarter;
      const entry = container.StaffEntries[1];
      if (!entry) continue;
      for (const voice of entry.VoiceEntries) {
        for (const note of voice.Notes) {
          if (note.isRest() || !note.Pitch) continue;
          const tie = note.NoteTie;
          if (tie && tie.Notes.length > 1 && tie.Notes[0] !== note) continue;
          const midi = note.Pitch.getHalfTone() + 12;
          const here = engine.events.filter((e) => near(e.startSec, startSec) && e.role);
          const where = "measure " + (m + 1) + " beat " + (container.Timestamp.RealValue * 4 + 1);
          if (midi < 50) {
            basses++;
            const bass = here.filter((e) => e.role === "bass");
            if (bass.length !== 1 || bass[0].midi !== midi) problems.push(where + ": bass " + midi + " should sound alone as written");
          } else {
            chords++;
            const got = here
              .filter((e) => e.role === "chord")
              .map((e) => e.midi - midi)
              .sort((a, b) => a - b);
            const want = EXPECTED[midi % 12];
            if (!want) problems.push(where + ": unexpected chord root " + midi);
            else if (got.join() !== want.join())
              problems.push(where + ": chord on " + midi + " sounds " + got.join("/") + ", want " + want.join("/"));
          }
        }
      }
    }
  });
  if (!basses || !chords) problems.push("expected both basses and chords, got " + basses + " basses and " + chords + " chords");
  return { page: location.pathname, basses, chords, pass: problems.length === 0, problems };
})();
