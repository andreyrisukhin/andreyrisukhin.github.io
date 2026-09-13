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
console.log(cases + " view-state tests passed");
