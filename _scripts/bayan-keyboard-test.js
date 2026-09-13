#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../assets/js/music/bayan-keyboard.js"), "utf8"), scope);
const B = scope.window.BayanKeyboard;
let cases = 0;
function test(name, fn) {
  fn();
  cases++;
  console.log("PASS " + name);
}
test("a pitch never changes columns when the visible range changes", () => {
  for (let low = 48; low < 61; low++) {
    const cells = B.layout(low, 84);
    const c = cells.find((cell) => cell.midi === 72);
    assert.equal(c.column, 0);
    assert.equal(c.row, 24);
  }
});
test("column steps are three semitones and octaves retain their column", () => {
  for (let midi = 0; midi < 115; midi++) {
    assert.equal(B.position(midi).column, B.position(midi + 12).column);
    assert.equal(B.position(midi + 3).row - B.position(midi).row, 1);
  }
});
test("visual columns run from high pitches to low pitches", () => {
  const html = B.html({ low: 60, high: 72 });
  const column = html.split("bayan-keyboard-column")[1];
  assert.ok(column.indexOf('data-midi="72"') < column.indexOf('data-midi="60"'));
});
test("only exact MIDI voices are selected, not every octave", () => {
  const html = B.html({ low: 60, high: 84, selected: [60, 64, 67], root: 60 });
  assert.equal((html.match(/is-selected/g) || []).length, 3);
  assert.equal((html.match(/is-root/g) || []).length, 1);
});
test("out-of-range alignment cells are disabled", () => {
  const html = B.html({ low: 61, high: 70 });
  assert.ok(html.match(/data-midi="60"[^>]* disabled/));
  assert.ok(html.match(/data-midi="71"[^>]* disabled/));
});
test("labels and shortcuts cannot introduce markup", () => {
  const html = B.html({ low: 60, high: 60, labels: { 60: '"<img>' }, shortcuts: { 60: "<x>" }, toggle: true });
  assert.ok(!html.includes("<img>"));
  assert.ok(html.includes("&lt;x&gt;"));
  assert.ok(html.includes('aria-pressed="false"'));
});
test("invalid ranges fail rather than producing an unbounded keyboard", () => {
  [
    [-1, 60],
    [60, 128],
    [72, 60],
    [60.5, 72],
  ].forEach(([low, high]) => assert.throws(() => B.layout(low, high)));
});
console.log(cases + " bayan renderer tests passed");
