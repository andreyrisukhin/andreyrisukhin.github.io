#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const sandbox = { TextEncoder };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
[
  "assets/js/vendor/tonal.min.js",
  "assets/js/music/common.js",
  "assets/js/workbench/model.js",
  "_prototypes/chord-canvas/fractions.js",
  "_prototypes/chord-canvas/document.js",
  "_prototypes/chord-canvas/storage.js",
  "_prototypes/chord-canvas/board.js",
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox));
const Board = sandbox.ChordCanvasBoard,
  F = sandbox.ChordFractions;
const json = (value) => JSON.parse(JSON.stringify(value));
const fractions = (b, x = 0, y = 0) =>
  b
    .all()
    .filter((c) => c.x === x && c.y === y)
    .map((c) => F.text(c.duration));
function invariant(b) {
  const ends = new Map();
  for (const cell of b.all()) {
    const key = `${cell.x},${cell.y}`;
    assert.equal(F.compare(cell.start, ends.get(key) || F.make(0, 1)), 0);
    assert.ok(F.compare(cell.duration, F.make(0, 1)) > 0);
    ends.set(key, F.add(cell.start, cell.duration));
  }
  for (const end of ends.values()) assert.equal(F.text(end), "1");
  assert.equal(new Set(b.all().map((c) => c.id)).size, b.all().length);
}
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
test("prototype assets use one cache revision", () => {
  const html = fs.readFileSync(path.join(root, "_prototypes/chord-canvas/index.html"), "utf8");
  const revision = html.match(/data-revision="([^"]+)"/)[1];
  ["style.css", "fractions.js", "document.js", "storage.js", "board.js", "canvas.js"].forEach((asset) =>
    assert.ok(html.includes('"' + asset + "?v=" + revision + '"'))
  );
});
test("file controls have simple Save, Load, and Copy titles", () => {
  const html = fs.readFileSync(path.join(root, "_prototypes/chord-canvas/index.html"), "utf8");
  assert.match(html, /<button id="download" type="button">Save<\/button>/);
  assert.match(html, /<button id="load" type="button">Load<\/button>/);
  assert.match(html, /<button id="copy"[^>]*>Copy<\/button>/);
  const panel = html.match(/<section id="files"[\s\S]*?<\/section>/)[0];
  assert.equal((panel.match(/<p/g) || []).length, 2, "Only dynamic feedback, no explanatory paragraphs");
});
test("fractions reduce and serialize exactly", () => {
  assert.deepEqual(json(F.make(4, 12)), { n: "1", d: "3" });
  assert.equal(F.text(F.add(F.make(1, 3), F.make(2, 3))), "1");
  assert.equal(F.text(F.sub(F.make(1, 2), F.make(1, 3))), "1/6");
  assert.equal(F.text(F.mul(F.make(2, 3), F.make(3, 5))), "2/5");
  assert.equal(F.text(F.div(F.make(2, 3), F.make(4, 5))), "5/6");
});
test("deep subdivisions retain exact arithmetic beyond floating point", () => {
  let span = F.make(1, 1);
  for (let i = 0; i < 100; i++) span = F.div(span, F.make(3, 1));
  assert.equal(span.d, String(3n ** 100n));
  assert.equal(F.text(F.mul(span, F.make(3n ** 100n, 1))), "1");
  assert.ok(Number.isFinite(F.number(F.make(10n ** 400n, 3n * 10n ** 400n))));
  assert.equal(F.number(F.make(1, 10n ** 400n)), 0);
});
test("arbitrary equal counts and rational ratios use the same weights", () => {
  assert.deepEqual(json(F.weights("3").map(F.text)), ["1/3", "1/3", "1/3"]);
  assert.deepEqual(json(F.weights("2:1").map(F.text)), ["2/3", "1/3"]);
  assert.deepEqual(json(F.weights("1/2:1/3").map(F.text)), ["3/5", "2/5"]);
  assert.equal(F.weights("64").length, 64);
  ["", "1", "65", "-3", "0:1", "1:0", "1/0:1", "2:", "2:bad", "2.5"].forEach((value) => assert.equal(F.weights(value), null));
});
test("musical snapping includes triplets and clamps positive lengths", () => {
  assert.equal(F.text(F.snap(0.334)), "1/3");
  assert.equal(F.text(F.snap(0.749)), "3/4");
  assert.equal(F.text(F.snap(0)), "1/64");
  assert.equal(F.text(F.snap(1)), "63/64");
});
test("new canvas is empty, with independent meter and history", () => {
  const b = Board.create();
  assert.equal(b.all().length, 0);
  assert.equal(b.canUndo, false);
  assert.deepEqual(json(b.meter), { numerator: 4, denominator: 4 });
});
test("entry accepts chords but invalid input changes nothing", () => {
  const b = Board.create();
  ["", "nonsense", "<img src=x>", "Am7/banana"].forEach((text) => assert.equal(b.put(0, 0, text), null));
  assert.equal(b.put(0.5, 0, "C"), null);
  assert.equal(b.canUndo, false);
  assert.equal(b.put(-1, -2, "a-7").name, "Am7");
  assert.equal(b.put(0, 0, "F#7/C#").name, "F#7/C#");
  invariant(b);
});
test("minor-seventh aliases share labels and colors without adding an edit", () => {
  const b = Board.create(),
    first = b.put(0, 0, "Bmin7");
  assert.equal(first.name, "Bm7");
  const edited = b.put(0, 0, "Bmi7", first.id);
  assert.deepEqual(json(edited), json(first));
  assert.equal(first.fill, Board.color(sandbox.WorkbenchModel.fromName("Bm7")));
  b.undo();
  assert.equal(b.all().length, 0, "Equivalent spelling does not add an undo step");
  const a = b.put(0, 0, "Amin7"),
    other = b.put(1, 0, "Bmin7");
  assert.equal(a.name, "Am7");
  assert.equal(other.name, "Bm7");
  assert.notEqual(a.fill, other.fill);
  invariant(b);
});
const aliasPairs = [
  ["CM", "C"],
  ["Cmin", "Cm"],
  ["CM7", "Cmaj7"],
  ["Cmin7", "Cm7"],
  ["Cdom", "C7"],
  ["Csus", "Csus4"],
  ["C7sus", "C7sus4"],
  ["C+", "Caug"],
  ["C°", "Cdim"],
  ["C°7", "Cdim7"],
  ["Cø", "Cm7b5"],
  ["CmM7", "CmMaj7"],
];
test("all agreed aliases share canonical tiles without adding redundant history", () => {
  for (const [alias, canonical] of aliasPairs) {
    const b = Board.create(),
      cell = b.put(0, 0, alias);
    assert.equal(cell.name, canonical);
    assert.equal(cell.fill, Board.color(sandbox.WorkbenchModel.fromName(canonical)));
    assert.deepEqual(json(b.put(0, 0, canonical, cell.id)), json(cell));
    assert.deepEqual(json(b.put(0, 0, alias, cell.id)), json(cell));
    b.undo();
    assert.equal(b.all().length, 0, alias + " does not add redundant edits");
  }
});
test("squeeze creates two halves and leaves a source rest", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am7"),
    c = b.put(1, 0, "Cmaj7");
  b.move(c.id, 0, 0, a.id, 1);
  assert.deepEqual(json(fractions(b)), ["1/2", "1/2"]);
  assert.equal(b.at(1, 0).name, null);
  assert.equal(b.get(c.id).x, 0);
  invariant(b);
});
test("repeated squeezing divides only the target span", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am7"),
    c = b.put(1, 0, "C"),
    d = b.put(2, 0, "D");
  b.move(c.id, 0, 0, a.id, 1);
  const unaffected = json(b.get(a.id));
  b.move(d.id, 0, 0, c.id, 1);
  assert.deepEqual(json(fractions(b)), ["1/2", "1/4", "1/4"]);
  assert.deepEqual(json(b.get(a.id)), unaffected);
  invariant(b);
});
test("equal fifths and nested ratios preserve neighboring starts", () => {
  const b = Board.create(),
    a = b.put(0, 0, "Am7");
  b.split(a.id, "5");
  const neighbors = json(b.all().slice(1));
  b.split(a.id, "2:1");
  assert.deepEqual(json(fractions(b)), ["2/15", "1/15", "1/5", "1/5", "1/5", "1/5"]);
  assert.deepEqual(json(b.all().slice(2)), neighbors);
  invariant(b);
});
test("new split spans are empty, not duplicated chords", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  assert.deepEqual(json(b.all().map((c) => c.name)), ["C", null, null]);
  const empty = b.all()[1];
  b.put(0, 0, "D7", empty.id);
  assert.equal(F.text(b.get(empty.id).duration), "1/3");
  invariant(b);
});
test("drop into a rest fills its exact span without splitting it", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C"),
    d = b.put(1, 0, "D7");
  b.split(a.id, "3");
  const empty = b.all().find((c) => c.x === 0 && c.name === null);
  b.move(d.id, 0, 0, empty.id, 0);
  assert.deepEqual(json(fractions(b)), ["1/3", "1/3", "1/3"]);
  assert.equal(F.text(b.get(d.id).start), "1/3");
  invariant(b);
});
test("moving a partial chord to empty canvas keeps its duration", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  b.move(a.id, 2, -1);
  assert.equal(F.text(b.get(a.id).duration), "1/3");
  assert.deepEqual(json(fractions(b, 2, -1)), ["1/3", "2/3"]);
  assert.equal(b.at(0, 0).name, null);
  invariant(b);
});
test("within-measure moves preserve other chord starts and identity", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  const d = b.all()[1],
    e = b.all()[2];
  b.put(0, 0, "D", d.id);
  b.put(0, 0, "E", e.id);
  const before = json(b.get(e.id));
  b.move(a.id, 0, 0, d.id, 0);
  assert.equal(b.at(0, 0).name, null);
  assert.deepEqual(json(b.get(e.id)), before);
  invariant(b);
});
test("drop preview and no-op drop do not mutate history", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C"),
    d = b.put(1, 0, "D");
  const before = json(b.all());
  assert.equal(b.destination(d.id, 0, 0, a.id, 1).kind, "squeeze");
  assert.equal(b.move(d.id, 1, 0, d.id, 1), false);
  assert.deepEqual(json(b.all()), before);
  b.undo();
  assert.equal(b.all().length, 1);
});
test("editing targets an exact span and rejects ambiguous coordinates", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  assert.equal(b.put(0, 0, "G"), null);
  assert.equal(b.put(1, 0, "G", a.id), null);
  b.put(0, 0, "F#maj7/C#", a.id);
  assert.equal(F.text(b.get(a.id).duration), "1/3");
  invariant(b);
});
test("clearing a chord leaves its timed span unchanged", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  const before = json(b.all().slice(1));
  b.remove(a.id);
  assert.equal(b.get(a.id).name, null);
  assert.deepEqual(json(b.all().slice(1)), before);
  invariant(b);
  assert.equal(b.clearMeasure(0, 0), true);
  assert.equal(b.all().length, 0);
  b.undo();
  invariant(b);
  assert.equal(b.all().length, 3);
});
test("nonempty measures cannot be discarded by empty-measure cleanup", () => {
  const b = Board.create();
  b.put(0, 0, "C");
  assert.equal(b.clearMeasure(0, 0), false);
});
test("divider resizing affects only adjacent spans and preserves their total", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "4");
  const cells = b.all(),
    last = json(cells.slice(2));
  b.resize(cells[0].id, cells[1].id, F.make(2, 3));
  assert.deepEqual(json(fractions(b)), ["1/3", "1/6", "1/4", "1/4"]);
  assert.deepEqual(json(b.all().slice(2)), last);
  invariant(b);
  assert.equal(b.resize(cells[0].id, cells[2].id, F.make(1, 2)), false);
  assert.equal(b.resize(cells[0].id, cells[1].id, F.make(0, 1)), false);
});
test("resize preview is read-only and cancelling needs no history change", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  const before = json(b.all()),
    second = b.all()[1];
  const plan = b.resizePlan(a.id, second.id, F.make(1, 4));
  assert.equal(F.text(plan.left), "1/6");
  assert.deepEqual(json(b.all()), before);
  b.undo();
  assert.deepEqual(json(fractions(b)), ["1"]);
});
test("meter changes labels without changing durations or positions", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "3");
  const before = json(b.all());
  assert.equal(b.setMeter(6, 8), true);
  assert.deepEqual(json(b.all()), before);
  b.undo();
  assert.deepEqual(json(b.meter), { numerator: 4, denominator: 4 });
  assert.equal(b.setMeter(0, 4), false);
  assert.equal(b.setMeter(7, 3), false);
});
test("undo and redo restore complete fractional arrangements", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C"),
    d = b.put(1, 0, "D");
  b.split(a.id, "2:1");
  b.move(d.id, 0, 0, a.id, 0);
  const before = json(b.all());
  b.undo();
  b.redo();
  assert.deepEqual(json(b.all()), before);
  invariant(b);
  b.undo();
  b.split(a.id, "3");
  assert.equal(b.canRedo, false);
  invariant(b);
});
test("returned values cannot mutate durations or meter", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  a.duration.n = "9";
  b.get(a.id).duration.n = "9";
  b.all()[0].start.n = "9";
  b.meter.numerator = 9;
  assert.equal(F.text(b.get(a.id).duration), "1");
  assert.equal(b.meter.numerator, 4);
});
test("operational limits reject atomically rather than corrupting measures", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  b.split(a.id, "64");
  for (const cell of b.all().slice(0, 3)) b.split(cell.id, "64");
  const before = json(b.all());
  assert.equal(b.split(a.id, "64"), false);
  assert.deepEqual(json(b.all()), before);
  invariant(b);
});
test("mixed editing stress retains positive spans summing exactly to one", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  for (let i = 0; i < 40; i++) {
    b.split(a.id, i % 2 ? "3" : "2:1");
    const cells = b.all().filter((c) => c.x === 0);
    b.resize(cells[0].id, cells[1].id, F.make(2, 5));
    invariant(b);
  }
});
test("chord colors remain enharmonically consistent", () => {
  const parse = sandbox.WorkbenchModel.fromName;
  assert.equal(Board.color(parse("C#7")), Board.color(parse("Db7")));
  assert.notEqual(Board.color(parse("C")), Board.color(parse("Cm")));
});
const Doc = sandbox.ChordCanvasDocument,
  Storage = sandbox.ChordCanvasStorage;
function example() {
  const b = Board.create(),
    a = b.put(-3, 2, "F#7/C#");
  b.split(a.id, "1/2:1/3");
  b.setMeter(6, 8);
  return Object.assign(b.document(), { view: { zoom: 8, pan: { x: 130, y: -240 }, selected: a.id, snap: "3" } });
}
test("loading and saving canonicalizes minor-seventh aliases without changing canvas layout", () => {
  const value = example();
  value.cells[0].name = "Bmin7/A";
  const expected = json(value);
  expected.cells[0].name = "Bm7/A";
  assert.deepEqual(json(Doc.parse(JSON.stringify(value))), expected);
  assert.deepEqual(JSON.parse(Doc.stringify(value)), expected);
  const restored = Board.create();
  assert.deepEqual(json(restored.load(value, true)), expected.view);
  const { view, ...document } = expected;
  assert.deepEqual(json(restored.document()), document);
  assert.equal(value.cells[0].name, "Bmin7/A", "Loading does not mutate the source document");
  invariant(restored);
});
test("all agreed aliases normalize on import and export without changing saved layout", () => {
  for (const [alias, canonical] of aliasPairs) {
    const value = example();
    value.cells[0].name = alias + "/G";
    const expected = json(value);
    expected.cells[0].name = canonical + "/G";
    assert.deepEqual(json(Doc.parse(JSON.stringify(value))), expected);
    assert.deepEqual(JSON.parse(Doc.stringify(value)), expected);
    const restored = Board.create();
    assert.deepEqual(json(restored.load(value, true)), expected.view);
    const { view, ...document } = expected;
    assert.deepEqual(json(restored.document()), document);
    assert.equal(value.cells[0].name, alias + "/G", "The source document remains unchanged");
    invariant(restored);
  }
});
test("files round-trip exact spans, rests, coordinates, meter, and view", () => {
  const value = example(),
    restored = Board.create();
  assert.deepEqual(json(Doc.parse(Doc.stringify(value))), json(value));
  assert.deepEqual(json(restored.load(value, true)), value.view);
  const { view, ...document } = value;
  assert.deepEqual(json(restored.document()), json(document));
  invariant(restored);
  assert.equal(restored.canUndo, false);
  assert.equal(restored.canRedo, false);
});
test("file loading is one undo step and discards stale redo", () => {
  const b = Board.create();
  b.put(0, 0, "C");
  const before = json(b.document());
  b.load(example());
  const after = json(b.document());
  b.undo();
  assert.deepEqual(json(b.document()), before);
  b.redo();
  assert.deepEqual(json(b.document()), after);
  b.undo();
  b.load(example());
  assert.equal(b.canRedo, false);
  invariant(b);
});
test("loaded IDs cannot collide with subsequent edits or undo", () => {
  const b = Board.create(),
    value = example();
  value.cells[0].id = 300;
  value.view.selected = 300;
  b.load(value);
  const a = b.put(3, 3, "C");
  assert.ok(a.id > 300);
  b.undo();
  b.undo();
  b.put(3, 3, "D");
  assert.ok(b.all()[0].id > a.id);
});
test("loading ignores computed and unknown fields without trusting fill or start", () => {
  const value = example();
  value.cells[0].fill = "url(https://example.invalid/)";
  value.cells[0].start = { n: "9", d: "1" };
  const b = Board.create();
  b.load(value);
  assert.ok(b.all()[0].fill.startsWith("hsl("));
  assert.equal(F.text(b.all()[0].start), "0");
  value.cells[0].duration.n = "999";
  assert.equal(F.text(b.all()[0].duration), "3/5");
});
test("invalid files never mutate the board or history", () => {
  const changes = [
    (v) => {
      v.version = 2;
    },
    (v) => {
      v.format = "other";
    },
    (v) => {
      v.cells = null;
    },
    (v) => {
      v.cells[0].id = v.cells[1].id;
    },
    (v) => {
      v.cells[0].id = Number.MAX_SAFE_INTEGER;
    },
    (v) => {
      v.cells[0].x = 0.2;
    },
    (v) => {
      v.cells[0].y = Infinity;
    },
    (v) => {
      v.meter.numerator = 0;
    },
    (v) => {
      v.meter.denominator = 3;
    },
    (v) => {
      v.cells[0].name = "<img onerror=alert(1)>";
    },
    (v) => {
      v.cells[0].name = {};
    },
    (v) => {
      v.cells[0].duration.d = "0";
    },
    (v) => {
      v.cells[0].duration.n = "-1";
    },
    (v) => {
      v.cells[0].duration.n = 1;
    },
    (v) => {
      v.cells[0].duration = { n: "1", d: "3" };
    },
    (v) => {
      v.cells[0].duration = { n: "1", d: "1" };
    },
    (v) => {
      v.cells[0].duration.d = "1".repeat(4097);
    },
    (v) => {
      v.view.pan.x = NaN;
    },
    (v) => {
      v.view.zoom = 3;
    },
    (v) => {
      v.view.selected = 123;
    },
    (v) => {
      v.view.snap = "evil";
    },
  ];
  const b = Board.create();
  b.put(0, 0, "C");
  const before = json(b.document());
  for (const change of changes) {
    const value = example();
    change(value);
    assert.throws(() => b.load(value));
    assert.deepEqual(json(b.document()), before);
  }
  b.undo();
  assert.equal(b.all().length, 0, "Failed loads add no history");
});
test("empty files and missing optional views load", () => {
  const b = Board.create(),
    value = b.document();
  b.put(0, 0, "C");
  assert.equal(b.load(value), null);
  assert.equal(b.all().length, 0);
  b.undo();
  assert.equal(b.all().length, 1);
});
test("deep exact fractions survive JSON without float conversion", () => {
  const b = Board.create(),
    a = b.put(0, 0, "C");
  for (let i = 0; i < 80; i++) b.split(a.id, "3");
  const restored = Board.create();
  restored.load(Doc.parse(Doc.stringify(b.document())));
  assert.deepEqual(json(restored.document()), json(b.document()));
  invariant(restored);
});
test("malformed and oversized files reject before loading", () => {
  assert.throws(() => Doc.parse("{broken"));
  assert.throws(() => Doc.parse("null"));
  assert.throws(() => Doc.parse(" ".repeat(Doc.maxBytes + 1)));
  const value = example();
  value.cells = Array(4097).fill(value.cells[0]);
  assert.throws(() => Doc.validate(value));
  value.cells = Array.from({ length: 257 }, (_, i) => ({ id: i + 1, x: 0, y: 0, name: null, duration: { n: "1", d: "257" } }));
  value.view = null;
  assert.throws(() => Doc.validate(value));
});
function memoryStorage() {
  let raw = null,
    writes = 0;
  return {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
      writes++;
    },
    get writes() {
      return writes;
    },
  };
}
test("autosave restores a document and skips identical writes", () => {
  const memory = memoryStorage(),
    store = Storage.create(() => memory),
    value = example();
  assert.equal(store.read(), null);
  assert.equal(store.save(value), true);
  assert.equal(store.save(value), true);
  assert.equal(memory.writes, 1);
  assert.deepEqual(json(Storage.create(() => memory).read()), json(value));
});
test("corrupt and newer browser saves remain untouched", () => {
  for (const raw of ["{broken", JSON.stringify({ ...example(), version: 2 })]) {
    const memory = memoryStorage();
    memory.setItem(Storage.key, raw);
    const store = Storage.create(() => memory);
    assert.equal(store.read(), null);
    assert.equal(store.status, "invalid");
    assert.equal(store.save(example()), false);
    assert.equal(memory.getItem(Storage.key), raw);
    assert.equal(store.save(example(), true), true);
  }
});
test("other tabs cannot silently overwrite a changed browser save", () => {
  const memory = memoryStorage(),
    a = Storage.create(() => memory),
    b = Storage.create(() => memory);
  a.read();
  b.read();
  a.save(example());
  assert.equal(b.save(Board.create().document()), false);
  assert.equal(b.status, "conflict");
  assert.equal(Doc.parse(memory.getItem(Storage.key)).cells.length, 2);
  assert.deepEqual(json(b.read()), json(example()));
  assert.equal(b.save(Board.create().document()), true);
});
test("storage events pause autosave until explicit recovery", () => {
  const memory = memoryStorage(),
    store = Storage.create(() => memory);
  store.read();
  store.save(example());
  store.changed(null);
  assert.equal(store.blocked, true);
  assert.equal(store.save(example()), false);
  assert.equal(store.save(example(), true), true);
  assert.equal(store.blocked, false);
});
test("denied storage and quota failures do not prevent JSON export", () => {
  const denied = Storage.create(() => {
    throw new Error("denied");
  });
  assert.equal(denied.read(), null);
  assert.equal(denied.save(example()), false);
  assert.equal(denied.status, "unavailable");
  const quota = Storage.create(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  }));
  quota.read();
  assert.equal(quota.save(example()), false);
  assert.equal(quota.status, "unavailable");
  assert.equal(Doc.parse(Doc.stringify(example())).cells.length, 2);
});
console.log(count + " chord canvas tests passed");
