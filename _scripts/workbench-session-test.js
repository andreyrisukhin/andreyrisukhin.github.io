#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const scope = { window: null, console };
scope.window = scope;
scope.self = scope;
vm.createContext(scope);
for (const file of ["vendor/tonal.min.js", "music/common.js", "workbench/model.js", "workbench/session.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../assets/js", file), "utf8"), scope);
}
const M = scope.WorkbenchModel;
const json = (v) => JSON.parse(JSON.stringify(v));
let cases = 0;
function test(name, fn) {
  fn();
  cases++;
  console.log("PASS " + name);
}
test("views have independent starting documents", () => {
  const s = scope.WorkbenchSession.create();
  assert.equal(s.state.mode, "chord");
  assert.equal(s.state.items[0].name, "Am7");
  s.switchView("progression");
  assert.deepEqual(json(s.state.items.map((m) => m.name)), ["Am7", "D7", "Gmaj7"]);
});
test("single-chord sequences remain in progression view", () => {
  const s = scope.WorkbenchSession.create();
  s.set([M.fromName("C")], { mode: "progression" });
  assert.equal(s.state.mode, "progression");
  assert.equal(s.state.items.length, 1);
});
test("chord view refuses a sequence instead of changing modes", () => {
  const s = scope.WorkbenchSession.create();
  assert.throws(() => s.set([M.fromName("C"), M.fromName("G7")]));
  assert.equal(s.state.mode, "chord");
  assert.equal(s.state.items[0].name, "Am7");
});
test("switching back restores key, selected step, tempo, loop and draft", () => {
  const s = scope.WorkbenchSession.create();
  s.switchView("progression");
  Object.assign(s.state, { index: 2, key: 9, bpm: 132, loop: true, input: "pending chord" });
  s.switchView("chord");
  s.set([M.fromName("F#m7")]);
  s.switchView("progression");
  assert.equal(s.state.index, 2);
  assert.equal(s.state.key, 9);
  assert.equal(s.state.bpm, 132);
  assert.equal(s.state.loop, true);
  assert.equal(s.state.input, "pending chord");
  s.switchView("chord");
  assert.equal(s.state.items[0].name, "F#m7");
});
test("append and replace affect only the progression", () => {
  const s = scope.WorkbenchSession.create();
  s.switchView("progression");
  s.insert([M.fromName("C7")], false);
  assert.equal(s.state.index, 3);
  assert.equal(s.state.items.length, 4);
  s.insert([M.fromName("C/E")], true);
  assert.equal(s.state.items.length, 4);
  assert.equal(s.state.items[3].name, "C/E");
  s.switchView("chord");
  assert.equal(s.state.items[0].name, "Am7");
});
test("move and remove retain a valid selected index", () => {
  const s = scope.WorkbenchSession.create();
  s.switchView("progression");
  s.move(1);
  assert.equal(s.state.index, 1);
  assert.equal(s.state.items[1].name, "Am7");
  s.remove();
  assert.equal(s.state.items[1].name, "Gmaj7");
  s.remove();
  s.remove();
  assert.equal(s.state.index, 0);
  assert.equal(s.state.items.length, 0);
  assert.equal(s.state.mode, "progression");
});
test("replacement requires a single chord", () => {
  const s = scope.WorkbenchSession.create();
  s.switchView("progression");
  assert.equal(s.insert([M.fromName("C"), M.fromName("G")], true), false);
  assert.equal(s.state.items.length, 3);
});
test("saved mode distinguishes a single-step progression from a chord", () => {
  const saved = M.savedItems(JSON.stringify([{ name: "One bar", chords: [M.entry(M.fromName("Am7"))], mode: "progression", index: 99 }]))[0];
  assert.equal(saved.mode, "progression");
  assert.equal(saved.index, 0);
});
test("legacy saved arrays select the appropriate view", () => {
  const single = M.savedItems(JSON.stringify([{ name: "C", notes: [0, 4, 7] }]))[0];
  assert.equal(single.mode, "chord");
  const sequence = M.savedItems(JSON.stringify([{ name: "Two", chords: [M.entry(M.fromName("C")), M.entry(M.fromName("G7"))] }]))[0];
  assert.equal(sequence.mode, "progression");
});
test("function labels are relative to the selected major key", () => {
  assert.equal(M.functionInKey(M.fromName("Am7"), 7), "ii7");
  assert.equal(M.functionInKey(M.fromName("D7"), 7), "V7");
  assert.equal(M.functionInKey(M.fromName("Eb"), 0), "♭III");
});
test("adding degrees from another key recomputes their function in this progression", () => {
  const s = scope.WorkbenchSession.create();
  s.switchView("progression");
  s.insert([M.fromDegree("2", 0)], false);
  assert.equal(s.state.key, 7);
  assert.equal(s.state.items[3].name, "Dm7");
  assert.equal(M.functionInKey(s.state.items[3], 7), "v7");
});
test("browser drafts round-trip both documents, minor analysis and picked order", () => {
  const s = scope.WorkbenchSession.create();
  const chord = M.fromName("C/E");
  chord.notes = [4, 0, 7];
  chord.voicing = "bass-octave";
  chord.handChoice = { voicing: "standard", bass: 4 };
  s.set([chord], { mode: "progression", key: 9, keyMode: "minor", gap: 0 });
  s.state.bpm = 132;
  s.state.loop = true;
  s.switchView("chord");
  s.set([M.fromName("F#m7")]);
  const saved = s.snapshot();
  const restored = scope.WorkbenchSession.create();
  restored.restore(saved);
  assert.equal(restored.state.items[0].name, "F#m7");
  restored.switchView("progression");
  assert.equal(restored.state.keyMode, "minor");
  assert.equal(restored.state.keyTonic, "A");
  assert.equal(restored.state.gap, 0);
  assert.equal(restored.state.bpm, 132);
  assert.equal(restored.state.loop, true);
  assert.deepEqual(json(restored.state.items[0].notes), [4, 0, 7]);
  assert.deepEqual(json(M.voices(restored.state.items[0]).map((v) => v.midi)), [64, 72, 67]);
  assert.deepEqual(json(restored.state.items[0].handChoice), chord.handChoice);
  saved.documents.progression.items[0].notes[0] = 9;
  assert.equal(restored.state.items[0].notes[0], 4);
});
test("empty progressions survive draft recovery without changing views", () => {
  const s = scope.WorkbenchSession.create();
  s.set([], { mode: "progression", key: 7, keyMode: "minor" });
  const restored = scope.WorkbenchSession.create();
  restored.restore(s.snapshot());
  assert.equal(restored.state.mode, "progression");
  assert.equal(restored.state.items.length, 0);
  assert.equal(restored.state.index, 0);
  assert.equal(restored.state.gap, 0);
});
test("corrupt drafts are rejected atomically rather than overwriting valid state", () => {
  const s = scope.WorkbenchSession.create();
  const before = s.snapshot();
  for (const corrupt of [null, {}, { ...before, version: 99 }, { ...before, mode: "other" }]) {
    assert.throws(() => s.restore(corrupt));
    assert.deepEqual(json(s.snapshot()), json(before));
  }
  const corrupt = json(before);
  corrupt.documents.progression.items[0].notes = [99];
  assert.throws(() => s.restore(corrupt));
  assert.deepEqual(json(s.snapshot()), json(before));
});
test("saved practice retains minor mode, loop, tonic spelling and insertion gap", () => {
  const item = M.savedItems(
    JSON.stringify([{ name: "Minor practice", chords: [M.entry(M.fromName("Dbm"))], key: 1, keyTonic: "Db", keyMode: "minor", loop: true, gap: 0 }])
  )[0];
  assert.equal(item.keyMode, "minor");
  assert.equal(item.keyTonic, "Db");
  assert.equal(item.loop, true);
  assert.equal(item.gap, 0);
});
console.log(cases + " view-state tests passed");
