#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const T = require(path.join(__dirname, "../assets/js/sheet-music/transpose.js"));

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

const fMinor = { fifths: -4, mode: "minor" };
const cMajor = { fifths: 0, mode: "major" };
const names = (key, offsets) => offsets.map((n) => T.describe(key, n).name);

check("key mapping matches the vendored OSMD TransposeCalculator", () => {
  const bundle = fs.readFileSync(path.join(__dirname, "../assets/js/vendor/opensheetmusicdisplay.min.js"), "utf8");
  const match = bundle.match(/keyMapping=\[([-\d,]+)\]/);
  assert.ok(match, "keyMapping not found in bundle");
  assert.deepEqual(T.FIFTHS_BY_SEMITONE, match[1].split(",").map(Number));
});

check("F minor walks through every minor key with OSMD's spelling", () => {
  assert.deepEqual(names(fMinor, [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]), [
    "B minor",
    "C minor",
    "C♯ minor",
    "D minor",
    "D♯ minor",
    "E minor",
    "F minor",
    "F♯ minor",
    "G minor",
    "G♯ minor",
    "A minor",
    "B♭ minor",
    "B minor",
  ]);
});

check("C major names flat and sharp keys", () => {
  assert.deepEqual(names(cMajor, [1, 3, 6, -1]), ["D♭ major", "E♭ major", "F♯ major", "B major"]);
});

check("original key keeps its written signature", () => {
  assert.equal(T.describe({ fifths: -6, mode: "major" }, 0).name, "G♭ major");
  assert.equal(T.describe({ fifths: 7, mode: "major" }, 0).name, "C♯ major");
  assert.equal(T.describe({ fifths: 7, mode: "major" }, 1).name, "D major");
});

check("offsets clamp to one tritone each way and format with a minus sign", () => {
  assert.equal(T.clamp(9), 6);
  assert.equal(T.clamp(-7.4), -6);
  assert.equal(T.clamp("2"), 2);
  assert.equal(T.clamp(undefined), 0);
  assert.equal(T.describe(fMinor, -3).offset, "−3");
  assert.equal(T.describe(fMinor, 2).offset, "+2");
  assert.equal(T.describe(fMinor, 0).offset, "");
});

check("unknown key falls back to a semitone label", () => {
  assert.equal(T.describe(null, 0).name, "Original key");
  assert.equal(T.describe(null, -2).name, "−2 semitones");
});

const LETTERS = "CDEFGAB";
const ACC = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" };
const parse = (s) => {
  const m = s.match(/^([A-G])(bb|b|##|#)?(-?\d)$/);
  const alter = { bb: -2, b: -1, "#": 1, "##": 2 }[m[2]] || 0;
  return { step: LETTERS.indexOf(m[1]), alter, octave: Number(m[3]) };
};
const spell = (n) => `${LETTERS[n.step]}${ACC[n.alter]}${n.octave}`;
const move = (notes, fifths, semitones) => notes.map((s) => spell(T.transposeNote(parse(s), fifths, semitones)));

check("F minor up three spells G# minor with sharps and a double-sharp leading tone", () => {
  assert.deepEqual(move(["F4", "C5", "G4", "Ab4", "Bb4", "Db5", "Eb3", "E3"], -4, 3), ["G#4", "D#5", "A#4", "B4", "C#5", "E5", "F#3", "F##3"]);
});

check("F minor down keeps flats and walks octaves correctly", () => {
  assert.deepEqual(move(["F4", "C5", "Ab4", "E3"], -4, -2), ["D#4", "A#4", "F#4", "C##3"]);
  assert.deepEqual(move(["F4", "C5", "Ab4", "E3"], -4, -5), ["C4", "G4", "Eb4", "B2"]);
  assert.deepEqual(move(["C4", "B3"], 0, -1), ["B3", "A#3"]);
  assert.deepEqual(move(["B3", "C4"], 0, 1), ["C4", "Db4"]);
});

check("transposed notes sound the requested number of semitones away", () => {
  const midi = (n) => (n.octave + 1) * 12 + T.LETTER_HALFTONES[n.step] + n.alter;
  for (let fifths = -7; fifths <= 7; fifths++) {
    for (let semitones = -6; semitones <= 6; semitones++) {
      for (const s of ["C4", "F#4", "Bb3", "E#5", "Cb4", "G##2", "Abb4"]) {
        const n = parse(s);
        const out = T.transposeNote(n, fifths, semitones);
        assert.equal(midi(out), midi(n) + semitones, `${s} by ${semitones} from ${fifths} fifths`);
        assert.ok(Math.abs(out.alter) <= 2, `${s} by ${semitones} from ${fifths} fifths needs ${out.alter}`);
      }
    }
  }
});

check("page hint overrides OSMD's default major", () => {
  assert.equal(T.modeFromOsmd(0, "minor"), "minor");
  assert.equal(T.modeFromOsmd(0), "major");
  assert.equal(T.modeFromOsmd(1), "minor");
  assert.equal(T.modeFromOsmd(7), "minor");
  assert.equal(T.modeFromOsmd(3), "major");
});

if (failures) {
  console.error(`${failures} transpose check(s) failed`);
  process.exit(1);
}
console.log("sheet transpose checks passed");
