// In-page check that sheet playback sounds each tie chain once, for its
// full length, including ties across bar lines. Evaluate on a built sheet
// page that uses playback.js (Señorita, Reconstructing More Science):
//
//   agent-browser open http://127.0.0.1:4000/music/sheet/senorita/
//   agent-browser eval --stdin < _scripts/sheet-playback-ties-check.js
(async () => {
  for (let i = 0; i < 100 && !(window.__playback && window.__playback.events.length); i++) await new Promise((r) => setTimeout(r, 100));
  const engine = window.__playback;
  if (!engine) throw new Error("Playback engine did not start");
  const quarter = 60 / engine.bpm;
  const measures = engine.osmd.Sheet.SourceMeasures;
  let sounding = 0;
  let continuations = 0;
  let crossings = 0;
  const problems = [];
  measures.forEach((measure, m) => {
    for (const container of measure.VerticalSourceStaffEntryContainers) {
      const startSec = engine.measureStarts[m] + container.Timestamp.RealValue * 4 * quarter;
      for (const entry of container.StaffEntries) {
        if (!entry) continue;
        for (const voice of entry.VoiceEntries) {
          for (const note of voice.Notes) {
            if (note.isRest() || !note.Pitch) continue;
            const tie = note.NoteTie;
            const chain = tie && tie.Notes.length > 1 ? tie.Notes : null;
            // Continuation notes must not be scheduled; the count check
            // below catches any that are.
            if (chain && chain[0] !== note) {
              continuations++;
              continue;
            }
            sounding++;
            if (chain) {
              const want = tie.Duration.RealValue * 4 * quarter;
              const last = chain[chain.length - 1];
              if (last.SourceMeasure !== measure) crossings++;
              const midi = engine.events.find((e) => Math.abs(e.startSec - startSec) < 0.001 && Math.abs(e.durationSec - want) < 0.001);
              if (!midi) problems.push("tie at measure " + (m + 1) + " is not held for " + want.toFixed(2) + "s");
            }
          }
        }
      }
    }
  });
  if (engine.events.length !== sounding) problems.push("expected " + sounding + " sounding notes, scheduled " + engine.events.length);
  return { page: location.pathname, events: engine.events.length, continuations, crossings, pass: problems.length === 0, problems };
})();
