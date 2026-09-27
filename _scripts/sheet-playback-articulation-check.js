// In-page check that sheet playback follows the score's articulations:
// staccato notes are shortened, staccato+tenuto (portato) less so, tenuto
// held full length, and accented notes (including accented notes tied
// into the next bar) start louder. Evaluate on a built sheet page that
// uses playback.js (Señorita, Reconstructing More Science):
//
//   agent-browser open http://127.0.0.1:4000/music/sheet/senorita/
//   agent-browser eval --stdin < _scripts/sheet-playback-articulation-check.js
(async () => {
  for (let i = 0; i < 100 && !(window.__playback && window.__playback.events.length); i++) await new Promise((r) => setTimeout(r, 100));
  const engine = window.__playback;
  if (!engine) throw new Error("Playback engine did not start");
  const names = window.opensheetmusicdisplay.ArticulationEnum;
  const quarter = 60 / engine.bpm;
  const near = (a, b) => Math.abs(a - b) < 0.001;
  const counts = { staccato: 0, portato: 0, tenuto: 0, accent: 0, plain: 0 };
  const problems = [];
  engine.osmd.Sheet.SourceMeasures.forEach((measure, m) => {
    for (const container of measure.VerticalSourceStaffEntryContainers) {
      const startSec = engine.measureStarts[m] + container.Timestamp.RealValue * 4 * quarter;
      for (const entry of container.StaffEntries) {
        if (!entry) continue;
        for (const voice of entry.VoiceEntries) {
          const marks = new Set(voice.Articulations.map((a) => names[a.articulationEnum]));
          for (const note of voice.Notes) {
            if (note.isRest() || !note.Pitch) continue;
            const tie = note.NoteTie;
            if (tie && tie.Notes.length > 1 && tie.Notes[0] !== note) continue;
            const midi = note.Pitch.getHalfTone() + 12;
            // Stradella chord notes sound as chord tones built on the root.
            const event = engine.events.find((e) => near(e.startSec, startSec) && e.midi === midi);
            const where = "measure " + (m + 1) + " beat " + (container.Timestamp.RealValue * 4 + 1);
            if (!event) {
              problems.push(where + ": no event for midi " + midi);
              continue;
            }
            const gate = event.gate || 0.95;
            let want = 0.95;
            let kind = "plain";
            if (marks.has("staccato") && marks.has("tenuto")) (want = 0.75), (kind = "portato");
            else if (marks.has("staccato")) (want = 0.5), (kind = "staccato");
            else if (marks.has("tenuto")) (want = 1), (kind = "tenuto");
            counts[kind]++;
            if (!near(gate, want)) problems.push(where + ": " + kind + " gate " + gate + ", want " + want);
            if (marks.has("accent")) {
              counts.accent++;
              if (!event.accent || !(event.accent.peak > 1)) problems.push(where + ": accent is not emphasized");
              else if (!near(event.accent.peak * event.accent.sustain, 0.9)) problems.push(where + ": accent should settle to the normal level");
            } else if (event.accent) problems.push(where + ": unmarked note is accented");
          }
        }
      }
    }
  });
  return { page: location.pathname, counts, pass: problems.length === 0, problems };
})();
