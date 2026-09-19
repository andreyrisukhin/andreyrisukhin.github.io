#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
["assets/js/vendor/tonal.min.js", "assets/js/music/common.js", "assets/js/workbench/model.js", "_prototypes/chord-canvas/board.js"].forEach((file) =>
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox)
);
const Board = sandbox.ChordCanvasBoard;
const json = (value) => JSON.parse(JSON.stringify(value));
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
test("the prototype versions its drag logic and styles together", () => {
  const html = fs.readFileSync(path.join(root, "_prototypes/chord-canvas/index.html"), "utf8");
  const revision = html.match(/data-revision="([^"]+)"/)[1];
  ["style.css", "board.js", "canvas.js"].forEach((asset) => assert.ok(html.includes('"' + asset + "?v=" + revision + '"')));
});
test("a new canvas has no chords or history", () => {
  const b = Board.create();
  assert.deepEqual(json(b.all()), []);
  assert.equal(b.canUndo, false);
  assert.equal(b.canRedo, false);
});
test("typing accepts shorthand, alterations, and slash chords", () => {
  const b = Board.create();
  ["a-7", "F#7/C#", "Bbmaj7", "C7#9", "Ddim7", "Esus4"].forEach((text, x) => assert.ok(b.put(x, 0, text)));
  assert.equal(b.at(0, 0).name, "Am7");
  assert.equal(b.at(1, 0).name, "F#7/C#");
});
test("invalid input and coordinates leave history untouched", () => {
  const b = Board.create();
  ["", "nonsense", "<img src=x onerror=alert(1)>", "Am7/banana"].forEach((text) => assert.equal(b.put(0, 0, text), null));
  assert.equal(b.put(Infinity, 0, "C"), null);
  assert.equal(b.put(0.5, 0, "C"), null);
  assert.equal(b.canUndo, false);
});
test("cells can be placed anywhere, including negative coordinates", () => {
  const b = Board.create();
  b.put(4, 8, "C");
  b.put(-3, -9, "D");
  b.put(-8, 8, "E");
  assert.deepEqual(json(b.all().map((c) => [c.x, c.y])), [
    [-3, -9],
    [-8, 8],
    [4, 8],
  ]);
});
test("editing retains cell identity and is undoable", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am7"),
    c = b.put(0, 0, "C/E");
  assert.equal(c.id, a.id);
  assert.equal(b.all().length, 1);
  b.undo();
  assert.equal(b.at(0, 0).name, "Am7");
  b.redo();
  assert.equal(b.at(0, 0).name, "C/E");
});
test("occupied drops squeeze two identities into one four-beat space", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C");
  b.move(a.id, 1, 0, 1);
  assert.equal(b.at(1, 0, 1).id, a.id);
  assert.equal(b.at(1, 0, 0).id, c.id);
  assert.equal(b.at(0, 0), null);
  assert.deepEqual(json(b.all().map((cell) => cell.slot)), [0, 1]);
  b.undo();
  assert.equal(b.at(0, 0).id, a.id);
  assert.equal(b.at(1, 0).id, c.id);
  assert.equal(b.at(0, 0).slot, null);
  b.redo();
  assert.equal(b.at(1, 0, 1).id, a.id);
});
test("the drop side sets left-to-right order, including identical chords", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am7"),
    c = b.put(1, 0, "Am7");
  b.move(a.id, 1, 0, 0);
  assert.deepEqual(json(b.all().map((cell) => cell.id)), [a.id, c.id]);
  assert.equal(b.all().length, 2);
  b.move(a.id, 1, 0, 1);
  assert.deepEqual(json(b.all().map((cell) => cell.id)), [c.id, a.id]);
  b.undo();
  assert.equal(b.at(1, 0, 0).id, a.id);
});
test("a third chord cannot overwrite a half or add a history checkpoint", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C"),
    d = b.put(2, 0, "D");
  b.move(a.id, 1, 0, 0);
  const before = json(b.all());
  assert.equal(b.destination(d.id, 1, 0, 1).kind, "blocked");
  assert.equal(b.move(d.id, 1, 0, 1), false);
  assert.deepEqual(json(b.all()), before);
  b.undo();
  assert.equal(b.at(0, 0).id, a.id);
  assert.equal(b.at(1, 0).id, c.id);
});
test("editing a half preserves its neighbor, position, and duration", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C");
  b.move(a.id, 1, 0, 1);
  assert.equal(b.put(1, 0, "G"), null, "An ambiguous edit cannot overwrite a pair");
  assert.equal(b.put(1, 0, "F#7/C#", a.id).slot, 1);
  assert.equal(b.at(1, 0, 0).name, "C");
  assert.equal(b.at(1, 0, 0).id, c.id);
  b.undo();
  assert.equal(b.at(1, 0, 1).name, "Am");
  assert.equal(b.at(1, 0, 1).slot, 1);
});
test("pulling a half out expands both cells and undo restores the pair", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C");
  b.move(a.id, 1, 0, 1);
  const pair = json(b.all());
  b.move(a.id, -1, 2);
  assert.equal(b.at(-1, 2).slot, null);
  assert.equal(b.at(1, 0).slot, null);
  assert.equal(b.at(1, 0).id, c.id);
  b.undo();
  assert.deepEqual(json(b.all()), pair);
});
test("moving a half into a full cell makes a new pair without losing the old neighbor", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C"),
    d = b.put(2, 0, "D");
  b.move(a.id, 1, 0, 1);
  b.move(a.id, 2, 0, 0);
  assert.equal(b.at(1, 0).id, c.id);
  assert.equal(b.at(1, 0).slot, null);
  assert.equal(b.at(2, 0, 0).id, a.id);
  assert.equal(b.at(2, 0, 1).id, d.id);
});
test("deleting one half expands its partner and undo restores both halves", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C");
  b.move(a.id, 1, 0, 0);
  b.remove(a.id);
  assert.equal(b.at(1, 0).id, c.id);
  assert.equal(b.at(1, 0).slot, null);
  b.undo();
  assert.deepEqual(json(b.all().map((cell) => cell.slot)), [0, 1]);
});
test("hover planning is read-only and cannot corrupt undo or duration", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am");
  b.put(1, 0, "C");
  const before = json(b.all());
  assert.equal(b.destination(a.id, 1, 0, 0).kind, "merge");
  assert.deepEqual(json(b.all()), before);
  b.undo();
  assert.equal(b.all().length, 1);
  assert.equal(b.at(0, 0).slot, null);
});
test("empty drops preserve all other positions", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am"),
    c = b.put(1, 0, "C");
  b.move(a.id, -5, 4);
  assert.equal(b.at(0, 0), null);
  assert.deepEqual(json(b.at(1, 0)), json(c));
  assert.equal(b.at(-5, 4).id, a.id);
});
test("deletion, undo, and redo restore the exact arrangement", () => {
  const b = Board.create(),
    a = b.put(-1, 2, "Am");
  b.remove(a.id);
  assert.equal(b.all().length, 0);
  b.undo();
  assert.deepEqual(json(b.all()), [json(a)]);
  b.redo();
  assert.equal(b.all().length, 0);
});
test("new edits discard redo but no-op edits do not", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.put(1, 0, "D");
  b.undo();
  b.put(0, 0, "C");
  b.move(a.id, 0, 0);
  assert.equal(b.canRedo, true);
  b.put(0, 1, "E");
  assert.equal(b.canRedo, false);
});
test("callers cannot mutate the board through returned cells", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  a.x = 5;
  b.at(0, 0).name = "broken";
  b.all()[0].fill = "broken";
  assert.equal(b.at(0, 0).name, "C");
  assert.notEqual(b.at(0, 0).fill, "broken");
});
test("enharmonic roots share colors while quality changes their shade", () => {
  const parse = sandbox.WorkbenchModel.fromName;
  assert.equal(Board.color(parse("C#7")), Board.color(parse("Db7")));
  assert.equal(Board.color(parse("C/E")), Board.color(parse("C")));
  assert.notEqual(Board.color(parse("C")), Board.color(parse("Cm")));
  assert.notEqual(Board.color(parse("C")), Board.color(parse("C7")));
  assert.notEqual(Board.color(parse("C")), Board.color(parse("G")));
});
console.log(count + " chord canvas tests passed");
