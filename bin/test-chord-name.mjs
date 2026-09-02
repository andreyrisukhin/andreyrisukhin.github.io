#!/usr/bin/env node
/*
 * Tests for the ChordName parser.
 *
 * Locks in:
 *   - Classic notation still parses (Am7, Cmaj7, F#dim, Bb/D, etc.)
 *   - Jazz shorthand "-" after the root is treated as minor:
 *       "A-7/G" parses identically to "Am7/G"
 *       "F#-6"  parses identically to "F#m6"
 *   - Invalid shapes return null / false
 *   - parseForStradella keeps the M -> "" normalization (so
 *     "GM" still maps to Stradella's Basic Triad row)
 *   - pcToSemi handles unicode flat / sharp
 *
 * Run:   node bin/test-chord-name.mjs
 * Exit:  0 on pass, 1 on first failure.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadInto(ctx, rel) {
  const src = readFileSync(resolve(ROOT, rel), "utf8");
  vm.runInContext(src, ctx, { filename: rel });
}

const ctx = vm.createContext({ window: {}, console });
loadInto(ctx, "assets/js/music/chord-name.js");
const { ChordName } = ctx.window;

let passed = 0;
let failed = 0;

function expect(label, got, want) {
  const ok = got === want || (got && want && typeof got === "object" && JSON.stringify(got) === JSON.stringify(want));
  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(`  \u2717 ${label}`);
    console.log(`      expected: ${JSON.stringify(want)}`);
    console.log(`      got:      ${JSON.stringify(got)}`);
  }
}

console.log("--- looksValid: classic notation ---");
expect("Cm", ChordName.looksValid("Cm"), true);
expect("Cmaj7", ChordName.looksValid("Cmaj7"), true);
expect("F#dim", ChordName.looksValid("F#dim"), true);
expect("Bb/D", ChordName.looksValid("Bb/D"), true);
expect("Am7b5", ChordName.looksValid("Am7b5"), true);
expect("empty string", ChordName.looksValid(""), false);
expect('bogus "Hello"', ChordName.looksValid("Hello"), false);
expect("non-string null", ChordName.looksValid(null), false);

console.log("");
console.log("--- looksValid: jazz minus shorthand ---");
expect("A-7/G", ChordName.looksValid("A-7/G"), true);
expect("F#-6/A", ChordName.looksValid("F#-6/A"), true);
expect("F#-", ChordName.looksValid("F#-"), true);
expect("Bb-9", ChordName.looksValid("Bb-9"), true);
expect("C-", ChordName.looksValid("C-"), true);
expect("A-maj7 (rare, but should parse)", ChordName.looksValid("A-maj7"), true);
// Note: looksValid is intentionally permissive on suffix content
// (anything between root and /bass except a slash). Malformed
// suffixes like "Am-7" or "A--7" still pass looksValid because they
// are chord-shaped; downstream consumers (StradellaData.findBySuffix)
// reject them by returning no recipes. Previous strict behavior was
// silently rejecting common chord types like "Cm9", "Cm11", "Cdim7".

console.log("");
console.log("--- looksValid: shape gating, not suffix vocabulary ---");
expect("Cm9 is chord-shaped (no longer silently rejected)", ChordName.looksValid("Cm9"), true);
expect("Cmaj9", ChordName.looksValid("Cmaj9"), true);
expect("Cdim7", ChordName.looksValid("Cdim7"), true);
expect("Cm(Maj7) is chord-shaped", ChordName.looksValid("Cm(Maj7)"), true);
expect('"C/G/D" rejected -- bass cannot itself have a slash', ChordName.looksValid("C/G/D"), false);

console.log("");
console.log("--- parse: classic notation round-trip ---");
expect("parse Cm", ChordName.parse("Cm"), { root: "C", suffix: "m", bass: null });
expect("parse Cmaj7", ChordName.parse("Cmaj7"), {
  root: "C",
  suffix: "maj7",
  bass: null,
});
expect("parse F#dim", ChordName.parse("F#dim"), {
  root: "F#",
  suffix: "dim",
  bass: null,
});
expect("parse Bb/D", ChordName.parse("Bb/D"), { root: "Bb", suffix: "", bass: "D" });
expect("parse Am7b5", ChordName.parse("Am7b5"), {
  root: "A",
  suffix: "m7b5",
  bass: null,
});

console.log("");
console.log("--- parse: jazz minus shorthand canonicalizes to m ---");
expect("parse A-7/G == Am7/G", ChordName.parse("A-7/G"), {
  root: "A",
  suffix: "m7",
  bass: "G",
});
expect("parse F#-6/A == F#m6/A", ChordName.parse("F#-6/A"), {
  root: "F#",
  suffix: "m6",
  bass: "A",
});
expect("parse F#- == F#m", ChordName.parse("F#-"), {
  root: "F#",
  suffix: "m",
  bass: null,
});
expect("parse C- == Cm", ChordName.parse("C-"), { root: "C", suffix: "m", bass: null });
expect("parse Bb-9 == Bbm9", ChordName.parse("Bb-9"), {
  root: "Bb",
  suffix: "m9",
  bass: null,
});

console.log("");
console.log("--- parseForStradella: M-major normalization preserved ---");
expect('GM normalizes to suffix ""', ChordName.parseForStradella("GM"), {
  root: "G",
  suffix: "",
  bass: null,
});
expect('EbM normalizes to suffix ""', ChordName.parseForStradella("EbM"), {
  root: "Eb",
  suffix: "",
  bass: null,
});
expect("A-7 -> {A, m7, null}", ChordName.parseForStradella("A-7"), {
  root: "A",
  suffix: "m7",
  bass: null,
});
expect('Cmaj normalizes (lowercase maj == "")', ChordName.parseForStradella("Cmaj"), {
  root: "C",
  suffix: "maj",
  bass: null,
});

console.log("");
console.log("--- parse: invalid input returns null ---");
expect("parse undefined", ChordName.parse(undefined), null);
expect("parse number", ChordName.parse(42), null);
expect("parse empty string", ChordName.parse(""), null);

console.log("");
console.log("--- pcToSemi ---");
expect('pcToSemi("C")', ChordName.pcToSemi("C"), 0);
expect('pcToSemi("F#")', ChordName.pcToSemi("F#"), 6);
expect('pcToSemi("Gb")', ChordName.pcToSemi("Gb"), 6);
expect('pcToSemi("F\u266F") unicode sharp', ChordName.pcToSemi("F\u266F"), 6);
expect('pcToSemi("D\u266D") unicode flat', ChordName.pcToSemi("D\u266D"), 1);
expect('pcToSemi("H") invalid', ChordName.pcToSemi("H"), null);
expect("pcToSemi(null)", ChordName.pcToSemi(null), null);

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
