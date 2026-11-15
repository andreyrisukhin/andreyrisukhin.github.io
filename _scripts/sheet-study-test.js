#!/usr/bin/env node
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../assets/js/sheet-music/study-model.js");
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/js/sheet-music/practice-timeline.js"), "utf8"), { window });
const T = window.SheetPracticeTimeline;
let count = 0;
function check(name, fn) {
  fn();
  count++;
  console.log("ok " + name);
}
const note = (midi, pitch, beat = 0, endBeat = 4, staff = 1, part = 0) => ({ midi, pitch, beat, endBeat, staff, part });
check("Octave doubling does not change the inferred chord", () => {
  const chord = [note(60, "C4"), note(64, "E4"), note(67, "G4")];
  assert.equal(M.infer(chord, 0, 4).name, "C");
  assert.equal(M.infer([...chord, note(72, "C5")], 0, 4).name, "C");
});
check("Missing thirds and fifths are not invented", () => {
  assert.equal(M.infer([note(38, "D2"), note(65, "F4")], 0, 4).inferred, false);
});
check("Minor and dominant seventh tones are recognized", () => {
  assert.equal(M.infer([note(58, "Bb3"), note(61, "Db4"), note(65, "F4")], 0, 4).name, "Bbm");
  assert.equal(M.infer([note(53, "F3"), note(57, "A3"), note(60, "C4"), note(63, "Eb4")], 0, 4).name, "F7");
});
check("Ambiguous complete harmonies keep alternatives", () => {
  const reading = M.infer([note(60, "C4"), note(64, "E4"), note(67, "G4"), note(69, "A4")], 0, 4);
  assert.ok(reading.alternatives.length > 0 || reading.name === "Am7");
});
check("Only actual overlapping same-staff octave intervals qualify", () => {
  assert.equal(M.octavePairs([note(34, "Bb1"), note(46, "Bb2")]).length, 1);
  assert.equal(M.octavePairs([note(34, "Bb1", 0, 1), note(46, "Bb2", 1, 2)]).length, 0);
  assert.equal(M.octavePairs([note(34, "Bb1"), note(58, "Bb3")]).length, 0);
  assert.equal(M.octavePairs([note(34, "Bb1"), note(46, "Bb2", 0, 4, 2)]).length, 0);
  assert.equal(M.octavePairs([note(34, "Bb1"), note(46, "Bb2", 0, 4, 1, 1)]).length, 0);
  assert.equal(M.octavePairs([note(34, "Bb1"), note(34, "Bb1")]).length, 0);
});
check("A complete off-beat chord creates a submeasure change", () => {
  const events = [
    note(60, "C4", 0, 1.5),
    note(64, "E4", 0, 1.5),
    note(67, "G4", 0, 1.5),
    note(62, "D4", 1.5, 4),
    note(65, "F4", 1.5, 4),
    note(69, "A4", 1.5, 4),
  ];
  const [measure] = M.analyze({ beatStarts: [0], beatEnds: [4], events });
  assert.equal(measure.segments[0].name, "C");
  assert.ok(measure.segments.some((segment) => segment.beat === 1.5 && segment.name === "Dm"));
});
check("Arpeggios can retain measure context without inventing pitches", () => {
  const events = [note(60, "C4", 0, 1), note(64, "E4", 1, 2), note(67, "G4", 2, 4)];
  const [measure] = M.analyze({ beatStarts: [0], beatEnds: [4], events });
  assert.equal(measure.segments.length, 1);
  assert.equal(measure.segments[0].name, "C");
});
check("Silent bars do not inherit the previous harmony", () => {
  const measures = M.analyze({ beatStarts: [0, 4], beatEnds: [4, 8], events: [note(60, "C4")] });
  assert.equal(measures[1].segments[0].name, "Rest");
});
check("Analysis preserves tied notes across barlines and source identity", () => {
  const timeline = T.fromMeasures([
    { beats: 4, notes: [{ midi: 34, pitch: "Bb1", beat: 0, duration: 4, staff: 2, part: 1, voice: 2, tieStart: true }] },
    { beats: 4, notes: [{ midi: 34, pitch: "Bb1", beat: 0, duration: 4, staff: 2, part: 1, voice: 2, tieStop: true }] },
  ]);
  assert.equal(timeline.events.length, 1);
  assert.equal(timeline.events[0].part, 1);
  assert.equal(timeline.events[0].pitch, "Bb1");
  const before = JSON.stringify(timeline.events);
  assert.equal(M.analyze(timeline)[1].bass[0], "Bb1");
  assert.equal(JSON.stringify(timeline.events), before);
});
console.log(`${count} sheet study model checks passed`);
