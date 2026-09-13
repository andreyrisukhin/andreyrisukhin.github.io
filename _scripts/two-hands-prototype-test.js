#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const context = {
  document: {
    createElement: () => ({
      set textContent(value) {
        this.innerHTML = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      },
    }),
  },
};
context.window = context;
context.self = context;
vm.createContext(context);
[
  "assets/js/vendor/tonal.min.js",
  "assets/js/music/common.js",
  "assets/js/music/chord-name.js",
  "assets/js/music/stradella-data.js",
  "assets/js/workbench/model.js",
  "_prototypes/two-hands/stradella.js",
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context));
const Left = context.PrototypeStradella;
const Model = context.WorkbenchModel;
const json = (value) => JSON.parse(JSON.stringify(value));
const cells = json(Left.layout());
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
test("six function columns and four fifth-related rows have unique coordinates", () => {
  assert.equal(cells.length, 24);
  assert.equal(new Set(cells.map((cell) => cell.id)).size, 24);
  assert.equal(new Set(cells.map((cell) => cell.row + ":" + cell.column)).size, 24);
  const roots = json(Left.roots);
  roots.slice(1).forEach((pc, i) => assert.equal((pc - roots[i] + 12) % 12, 7));
  assert.deepEqual(
    json(Left.columns).map((column) => column.id),
    ["d7", "7", "m", "M", "bass", "counter"]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.column),
    [5, 5, 5, 5]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "bass").map((cell) => cell.column),
    [4, 4, 4, 4]
  );
});
test("counterbass is a correctly spelled major third above the bass", () => {
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.notes[0]),
    [4, 11, 6, 1]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.label),
    ["E", "B", "F♯", "C♯"]
  );
});
test("all chord columns use shared Stradella button voicings", () => {
  cells
    .filter((cell) => cell.kind !== "bass" && cell.kind !== "counter")
    .forEach((cell) => {
      const quality = cell.kind;
      assert.deepEqual(
        cell.notes,
        json(context.StradellaData.BUTTONS[quality]).map((pc) => (pc + cell.root) % 12)
      );
    });
});
test("arrow navigation follows the rotated visual coordinates", () => {
  const listeners = {};
  let focused = null;
  const container = {
    addEventListener: (event, fn) => {
      listeners[event] = fn;
    },
    contains: () => true,
    querySelector: (selector) => ({
      focus: () => {
        focused = selector.match(/data-left-id="([^"]+)"/)[1];
      },
    }),
  };
  Left.bind(container, { onActivate: () => {} });
  function move(id, key) {
    focused = null;
    listeners.keydown({
      key,
      target: { closest: () => ({ dataset: { leftId: id } }) },
      preventDefault: () => {},
    });
    return focused;
  }
  assert.equal(move("bass-7", "ArrowRight"), "counter-7");
  assert.equal(move("bass-7", "ArrowLeft"), "M-7");
  assert.equal(move("bass-7", "ArrowUp"), "bass-0");
  assert.equal(move("bass-7", "ArrowDown"), "bass-2");
  assert.equal(move("counter-7", "ArrowRight"), null);
  assert.equal(move("d7-7", "ArrowLeft"), null);
  assert.equal(move("bass-0", "ArrowUp"), null);
  assert.equal(move("bass-9", "ArrowDown"), null);
});
test("Am7 selects A bass and C major with no extra or missing tones", () => {
  const selected = json(Left.selected(Model.fromName("Am7")));
  assert.deepEqual(selected, ["bass-9", "M-0"]);
  assert.deepEqual(
    [...new Set(cells.filter((cell) => selected.includes(cell.id)).flatMap((cell) => cell.notes))].sort((a, b) => a - b),
    [0, 4, 7, 9]
  );
});
test("demonstration audio retains every button pitch class", () => {
  cells.forEach((cell) => {
    assert.deepEqual(
      cell.midis.map((midi) => midi % 12).sort((a, b) => a - b),
      [...cell.notes].sort((a, b) => a - b)
    );
    assert.ok(cell.midis.every((midi) => midi >= 36 && midi < 60));
  });
});
test("recipes outside the schematic are not silently partially selected", () => {
  assert.deepEqual(json(Left.selected(Model.fromName("Bbm7"))), []);
});
test("markup distinguishes selected recipe buttons and the root bass", () => {
  const container = {};
  Left.mount(container, Model.fromName("Am7"));
  assert.equal((container.innerHTML.match(/class="hand-key/g) || []).length, 24);
  assert.equal((container.innerHTML.match(/ is-selected/g) || []).length, 2);
  assert.equal((container.innerHTML.match(/ is-root/g) || []).length, 1);
  assert.match(container.innerHTML, /aria-label="Hear A bass" aria-description="Chord root\./);
});
console.log(count + " two-hand prototype tests passed");
