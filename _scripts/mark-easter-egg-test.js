#!/usr/bin/env node
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const M = require(path.join(root, "assets/js/mark-easter-egg.js"));
let count = 0;
function test(name, run) {
  run();
  count++;
}

test("rest state matches the dot mark markup", () => {
  const svg = fs.readFileSync(path.join(root, "_includes/dot-mark.liquid"), "utf8");
  const circles = [...svg.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="([\d.]+)" fill="(\w+)"/g)];
  assert.equal(circles.length, M.REST.length);
  circles.forEach(([, cx, cy, r, fill], i) => {
    assert.deepEqual([M.REST[i].x, M.REST[i].y, M.REST[i].r], [+cx, +cy, +r]);
    assert.equal(M.REST[i].f, fill === "none" ? 0 : 1);
  });
});

test("routes pick the themed variant for each section", () => {
  const cases = {
    "/": "atom",
    "/publications/": "atom",
    "/cv/": "atom",
    "/projects/": "atom",
    "/projects/lego/": "lego",
    "/lego/": "lego",
    "/music/": "bayan",
    "/music/sheet/senorita/": "bayan",
    "/chess/endgames/": "hex",
    "/kata/": "hex",
    "/ditherer/": "dither",
    "/color/outfit/": "dither",
    "/blog/": "orrery",
    "/fireplace/": "embers",
    "/terrarium/": "life",
    "/trails/zion-dry-river-walk/": "trail",
    "/books/": "pages",
    "/404.html": "lost",
  };
  for (const [p, name] of Object.entries(cases)) assert.equal(M.pickVariant(p), name, p);
  assert.equal(M.pickVariant("/music/", "orrery"), "orrery");
  assert.equal(M.pickVariant("/music/", "nonsense"), "bayan");
});

test("unthemed pages get a stable, varied pick", () => {
  const post = "/blog/2026/time-at-perceptron-ai/";
  assert.equal(M.pickVariant(post), M.pickVariant(post));
  const picks = new Set(Array.from({ length: 40 }, (_, i) => M.pickVariant(`/blog/2026/post-${i}/`)));
  assert.ok(picks.size >= 5, `only ${picks.size} variants across 40 posts`);
});

function fakeGroup() {
  const el = () => ({
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    appendChild() {},
    ownerDocument: doc,
  });
  const doc = { createElementNS: () => el() };
  return el();
}

test("every variant returns seven finite dots and stays in bounds", () => {
  for (const [name, v] of Object.entries(M.VARIANTS)) {
    const ctx = v.setup ? v.setup(fakeGroup()) : null;
    for (let t = 0; t <= 8000; t += 17) {
      const s = v.frame(t, ctx);
      assert.equal(s.length, 7, name);
      for (const d of s) {
        for (const k of ["x", "y", "r", "f", "sw"]) assert.ok(Number.isFinite(d[k]), `${name} ${k} at ${t}`);
        assert.ok(d.f >= 0 && d.f <= 1, `${name} fill at ${t}`);
        assert.ok(d.x - d.r >= -2 && d.x + d.r <= 34 && d.y - d.r >= -2 && d.y + d.r <= 34, `${name} bounds at ${t}`);
      }
    }
  }
});

test("geometric loops start and end on the mark", () => {
  const close = (s, name) =>
    s.forEach((d, i) => {
      assert.ok(Math.abs(d.x - M.REST[i].x) < 1e-6 && Math.abs(d.y - M.REST[i].y) < 1e-6, `${name} dot ${i}`);
    });
  close(M.VARIANTS.orrery.frame(0), "orrery start");
  close(M.VARIANTS.orrery.frame(3800), "orrery loop");
  close(M.VARIANTS.hex.frame(0), "hex start");
  close(M.VARIANTS.hex.frame(700 * 6), "hex full turn");
  close(M.VARIANTS.atom.frame(0, M.VARIANTS.atom.setup(fakeGroup())), "atom start");
});

test("hex Life keeps changing", () => {
  const gens = M.lifeGenerations(32);
  assert.deepEqual(
    gens[0],
    M.REST.map((d) => d.f)
  );
  assert.ok(new Set(gens.map((g) => g.join(""))).size >= 8);
  assert.ok(gens.every((g) => g.some(Boolean)));
});

console.log(`mark-easter-egg: ${count} tests passed`);
