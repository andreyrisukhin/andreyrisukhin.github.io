#!/usr/bin/env node
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const root = path.resolve(__dirname, ".."),
  sandbox = { TextEncoder, TextDecoder, atob, btoa };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const file of [
  "vendor/tonal.min.js",
  "music/common.js",
  "music/stradella-data.js",
  "workbench/model.js",
  "workbench/stradella.js",
  "bass-patterns/model.js",
  "bass-patterns/storage.js",
])
  vm.runInContext(fs.readFileSync(path.join(root, "assets/js", file), "utf8"), sandbox);
const M = sandbox.BassPatterns,
  S = sandbox.BassPatternStorage,
  json = (x) => JSON.parse(JSON.stringify(x));
let count = 0;
function test(name, run) {
  run();
  count++;
  console.log("PASS", name);
}
test("examples mix bass and chord steps in complete measures", () => {
  M.examples.forEach((p) => {
    assert.equal(M.score(p).incomplete, 0);
    assert.equal(M.score(p).segments.length, p.steps.length);
  });
  assert.deepEqual(json(M.examples[0].steps.map((s) => s.presses[0].kind)), ["bass", "M", "bass", "M"]);
});
test("copyable codes round-trip unicode titles, chords, rests, and fingers", () => {
  const p = M.clone(M.examples[0]);
  p.title = "Андрей ♭ 🎵";
  p.steps[0].presses.push({ root: 7, kind: "7", finger: 3 });
  p.steps[1].presses = [];
  p.steps[0].presses[0].finger = 4;
  const code = M.encode(p);
  assert.match(code, /^BP1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(json(M.decode(code)), json(p));
  assert.deepEqual(json(M.decode(" \n" + code + "\n")), json(p));
});
test("malformed and future codes reject without partial results", () => {
  for (const code of ["", "BP2.abc", "BP1.", "BP1.!!!", "BP1.bm90IGpzb24", "x".repeat(65537), "BP1." + btoa("[]")])
    assert.throws(() => M.decode(code));
});
test("validation rejects invalid durations, fingers, duplicate buttons, and unbounded input", () => {
  for (const change of [
    (p) => (p.meter = [0, 4]),
    (p) => (p.meter = [4, 3]),
    (p) => (p.title = "a".repeat(81)),
    (p) => (p.steps[0].ticks = 4),
    (p) => (p.steps[0].presses[0].root = 12),
    (p) => (p.steps[0].presses[0].kind = "evil"),
    (p) => (p.steps[0].presses[0].finger = 0),
    (p) => p.steps[0].presses.push(p.steps[0].presses[0]),
    (p) => (p.steps = Array(129).fill(p.steps[0])),
  ]) {
    const p = M.clone(M.examples[0]);
    change(p);
    assert.throws(() => M.validate(p));
  }
});
test("validation copies values and drops unknown markup", () => {
  const p = M.clone(M.examples[0]);
  p.inject = "<script>";
  p.steps[0].presses[0].fill = "evil";
  const restored = M.validate(p);
  p.steps[0].presses[0].finger = 5;
  assert.equal(restored.inject, undefined);
  assert.equal(restored.steps[0].presses[0].fill, undefined);
  assert.equal(restored.steps[0].presses[0].finger, null);
});
test("bass and counterbass resolve to correct sounding pitch classes", () => {
  assert.deepEqual(json(M.pitches({ presses: [{ root: 0, kind: "bass", finger: 4 }] })), [{ midi: 36, name: "C" }]);
  assert.deepEqual(json(M.pitches({ presses: [{ root: 0, kind: "counter", finger: 3 }] })), [{ midi: 40, name: "E" }]);
});
test("chord button notes match the existing instrument and combine without duplicates", () => {
  const pitches = M.pitches({
    presses: [
      { root: 0, kind: "7", finger: 3 },
      { root: 0, kind: "bass", finger: 4 },
    ],
  });
  assert.deepEqual(json(pitches.map((p) => p.midi)), [36, 48, 52, 58]);
  const overlap = M.pitches({
    presses: [
      { root: 0, kind: "M", finger: null },
      { root: 0, kind: "7", finger: null },
    ],
  });
  assert.equal(new Set(overlap.map((p) => p.midi)).size, overlap.length);
});
test("all 72 button spellings produce finite bass-clef notation", () => {
  for (let root = 0; root < 12; root++)
    for (const kind of M.kinds) {
      const score = M.score({ ...M.empty(), steps: [{ ticks: 12, presses: [{ root, kind, finger: null }] }] });
      assert.ok(score.abc.includes("K:C clef=bass"));
      assert.ok(!score.abc.includes("undefined"));
    }
});
test("cross-bar sustained notes split into exact tied segments", () => {
  const p = M.clone(M.examples[0]);
  p.meter = [3, 4];
  p.steps = [{ ticks: 48, presses: p.steps[0].presses }];
  const score = M.score(p);
  assert.deepEqual(json(score.segments.map((s) => s.ticks)), [36, 12]);
  assert.ok(score.abc.includes("12- |"));
  assert.equal(score.incomplete, 12);
  assert.ok(score.segments.every((s) => s.step === 0));
});
test("cross-bar rests split but do not acquire ties", () => {
  const p = { ...M.empty(), meter: [3, 4], steps: [{ ticks: 48, presses: [] }] },
    score = M.score(p);
  assert.ok(score.abc.includes("z12 | z4"));
  assert.ok(!score.abc.includes("-"));
});
test("arbitrary titles cannot inject ABC directives", () => {
  const p = M.clone(M.examples[0]);
  p.title = "\nK:D\n%%staffscale 999";
  assert.ok(!M.score(p).abc.includes("999"));
});
function memory() {
  let raw = null;
  return {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
}
function book() {
  return { version: 1, draft: M.clone(M.examples[0]), saved: [], active: null };
}
test("browser notebook persists draft and named patterns", () => {
  const data = book();
  data.saved.push({ id: "one", pattern: M.clone(M.examples[1]) });
  data.active = "one";
  const mem = memory(),
    s = S.create(() => mem);
  assert.equal(s.read(), null);
  assert.equal(s.write(data), true);
  assert.deepEqual(json(S.create(() => mem).read()), json(data));
});
test("corrupt browser data remains untouched until explicit replacement", () => {
  const mem = memory();
  mem.setItem(S.key, "broken");
  const s = S.create(() => mem);
  assert.equal(s.read(), null);
  assert.equal(s.write(book()), false);
  assert.equal(mem.getItem(S.key), "broken");
  assert.equal(s.write(book(), true), true);
});
test("cross-tab saves are detected before overwriting", () => {
  const mem = memory(),
    a = S.create(() => mem),
    b = S.create(() => mem);
  a.read();
  b.read();
  a.write(book());
  const changed = book();
  changed.draft.title = "other";
  assert.equal(b.write(changed), false);
  assert.match(b.error, /Another tab/);
  assert.equal(JSON.parse(mem.getItem(S.key)).draft.title, book().draft.title);
});
test("blocked and full storage leave pattern codes usable", () => {
  const s = S.create(() => {
    throw new Error("blocked");
  });
  s.read();
  assert.equal(s.write(book()), false);
  const q = S.create(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("full");
    },
  }));
  q.read();
  assert.equal(q.write(book()), false);
  assert.ok(M.decode(M.encode(book().draft)));
});
test("notebook validation bounds saved entries and unique IDs", () => {
  const b = book();
  b.saved = [
    { id: "same", pattern: b.draft },
    { id: "same", pattern: b.draft },
  ];
  assert.throws(() => S.validate(b));
  b.saved = [];
  b.active = "missing";
  assert.throws(() => S.validate(b));
});
if (process.argv.includes("--built")) {
  test("built public route and all local dependencies exist and are precached", () => {
    const site = path.join(root, "_site"),
      html = fs.readFileSync(path.join(site, "music/bass-patterns/index.html"), "utf8");
    assert.ok(!html.includes("_prototypes"));
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(fs.readFileSync(path.join(site, "music/index.html"), "utf8").includes("/music/bass-patterns/"));
    const sw = fs.readFileSync(path.join(site, "sw.js"), "utf8");
    assert.ok(sw.includes("'/music/bass-patterns/'"));
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = new URL(match[1], "https://example.test/music/bass-patterns/");
      if (url.origin !== "https://example.test" || !url.pathname.startsWith("/assets/")) continue;
      assert.ok(fs.existsSync(path.join(site, url.pathname)), url.pathname);
      if (url.pathname.includes("bass-patterns")) assert.ok(sw.includes("'" + url.pathname + "'"));
    }
  });
}
console.log(count + " bass pattern tests passed");
