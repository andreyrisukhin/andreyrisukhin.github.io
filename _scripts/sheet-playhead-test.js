#!/usr/bin/env node
const assert = require("node:assert/strict");
const path = require("node:path");

const { collectSteps, retime, locate } = require(path.join(__dirname, "../assets/js/sheet-music/playhead.js"));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures++;
    console.error(`not ok - ${name}\n  ${err.message}`);
  }
}

// Two lines: measure 0 has four onsets on line y=100, measure 1 has two
// onsets on line y=300. Measures last 2s each.
function fixture() {
  const steps = [
    { measure: 0, frac: 0, x: 100, y: 100, w: 20, h: 80, endX: 500 },
    { measure: 0, frac: 0.25, x: 200, y: 100, w: 20, h: 80, endX: 500 },
    { measure: 0, frac: 0.5, x: 300, y: 100, w: 20, h: 80, endX: 500 },
    { measure: 0, frac: 0.75, x: 400, y: 100, w: 20, h: 80, endX: 500 },
    { measure: 1, frac: 0, x: 100, y: 300, w: 20, h: 90, endX: 500 },
    { measure: 1, frac: 0.5, x: 300, y: 300, w: 20, h: 90, endX: 500 },
  ];
  return retime(steps, [0, 2], 4);
}

check("retime maps measure fractions to seconds", () => {
  const steps = fixture();
  assert.deepEqual(
    steps.map((s) => s.sec),
    [0, 0.5, 1, 1.5, 2, 3]
  );
  assert.deepEqual(
    steps.map((s) => s.untilSec),
    [0.5, 1, 1.5, 2, 3, 4]
  );
});

check("retime follows uneven measure lengths", () => {
  const steps = retime(
    [
      { measure: 0, frac: 0.5 },
      { measure: 1, frac: 0.5 },
    ],
    [0, 1],
    4
  );
  assert.deepEqual(
    steps.map((s) => s.sec),
    [0.5, 2.5]
  );
});

check("playhead sits on the onset at its start time", () => {
  const spot = locate(fixture(), 0.5, true);
  assert.equal(spot.index, 1);
  assert.equal(spot.x, 210);
  assert.equal(spot.y, 100);
});

check("playhead glides between onsets on the same line", () => {
  const spot = locate(fixture(), 0.75, true);
  assert.equal(spot.index, 1);
  assert.equal(spot.x, 260);
});

check("playhead glides to the barline before a line break", () => {
  const spot = locate(fixture(), 1.75, true);
  assert.equal(spot.index, 3);
  assert.equal(spot.x, 455);
  assert.equal(spot.y, 100);
});

check("playhead jumps to the next line at its first onset", () => {
  const spot = locate(fixture(), 2, true);
  assert.equal(spot.x, 110);
  assert.equal(spot.y, 300);
  assert.equal(spot.h, 90);
});

check("reduced motion snaps to the current onset", () => {
  assert.equal(locate(fixture(), 0.75, false).x, 210);
  assert.equal(locate(fixture(), 1.9, false).x, 410);
});

check("positions clamp before the start and after the end", () => {
  assert.equal(locate(fixture(), -1, true).index, 0);
  assert.equal(locate(fixture(), -1, true).x, 110);
  const last = locate(fixture(), 99, true);
  assert.equal(last.index, 5);
  assert.equal(last.x, 500);
});

check("empty scores have no playhead", () => {
  assert.equal(locate([], 1, true), null);
});

check("collectSteps records each onset once and restores the cursor", () => {
  // Minimal fake of OSMD's cursor: a repeat revisits measure 0.
  const order = [
    [0, 0],
    [0, 0.5],
    [1, 1],
    [0, 0],
    [0, 0.5],
    [1, 1.5],
  ];
  let i = 0;
  const calls = [];
  const el = { style: { left: "0px", top: "10px" }, width: 12, height: 40 };
  const iterator = {
    get EndReached() {
      return i >= order.length;
    },
    get CurrentMeasureIndex() {
      return order[i][0];
    },
    get CurrentMeasure() {
      const m = order[i][0];
      return { AbsoluteTimestamp: { RealValue: m }, Duration: { RealValue: 1 } };
    },
    get currentTimeStamp() {
      return { RealValue: order[i][1] };
    },
  };
  const place = () => {
    if (i < order.length) el.style.left = `${order[i][0] * 400 + order[i][1] * 100}px`;
  };
  const cursor = {
    iterator,
    cursorElement: el,
    show: () => calls.push("show"),
    hide: () => calls.push("hide"),
    reset: () => {
      calls.push("reset");
      i = 0;
      place();
    },
    next: () => {
      i++;
      place();
    },
  };
  const steps = collectSteps({ cursor, zoom: 1 });
  assert.deepEqual(
    steps.map((s) => [s.measure, s.frac]),
    [
      [0, 0],
      [0, 0.5],
      [1, 0],
      [1, 0.5],
    ]
  );
  assert.equal(steps[1].x, 50);
  assert.equal(steps[0].h, 40);
  assert.deepEqual(calls.slice(-2), ["reset", "hide"]);
});

if (failures) {
  console.error(`${failures} sheet playhead check(s) failed`);
  process.exit(1);
}
console.log("All sheet playhead checks passed");
