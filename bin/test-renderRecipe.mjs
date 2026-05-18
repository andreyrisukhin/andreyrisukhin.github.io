#!/usr/bin/env node
/*
 * Regression test for StradellaData.renderRecipe.
 *
 * Why this exists:
 *   The "drop the redundant '/ root' suffix" rule was first
 *   implemented as `bassPC !== rootPC`, which silently broke every
 *   chord whose recipe presses a non-root button (Cmaj7's "Em / C",
 *   Cm7's "E♭M / C", C+'s "EM / C", every multi-part stack, ...).
 *   The breakage was inconsistent because m6's recipe deliberately
 *   uses a non-root bass (offset 9), so its slash survived. The user
 *   noticed Fmaj7 and m7 first because those are common; aug, +7,
 *   hdim7, etc. were equally broken but less reported.
 *
 *   This test fixes the class. It hard-codes the expected rendered
 *   string for every CHORDS entry in C key + F key and asserts each
 *   one. Adding a new chord to CHORDS without an entry in EXPECTED
 *   below fails the suite, so future changes can't introduce the same
 *   "fixed for some, broken for others" silent-regression pattern.
 *
 * Run:   node bin/test-renderRecipe.mjs
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

const ctx = vm.createContext({
  window: {},
  console,
});
ctx.window = ctx.window || {};
loadInto(ctx, "assets/js/music/common.js");
loadInto(ctx, "assets/js/music/chord-name.js");
// stradella-data.js reads window.StradellaButtons (loaded from YAML in
// the live page). Stub the same shape the page hands us.
ctx.window.StradellaButtons = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 10],
  d7: [0, 3, 9],
};
loadInto(ctx, "assets/js/music/stradella-data.js");

const { Music, StradellaData } = ctx.window;

// Expected rendered string in C key (key=0) with hasDim7=true, no
// bassOverride. Hand-curated from the chord-encoding rules in
// stradella-data.js. Every CHORDS entry MUST appear here; missing
// entries fail the coverage check below.
const EXPECTED_C = {
  // Basic Triads -- natural pairing, slash dropped
  maj: "CM",
  min: "Cm",
  // Major Family
  maj6: "Am / C",
  maj7: "Em / C",
  maj7inv: "CM / B",
  maj9: "CM + GM / C",
  add9: "CM + D (RH)",
  // Minor Family
  m6: "Cm / A",
  ms5: "A♭M / C",
  m7: "E♭M / C",
  m9: "Cm + Gm / C",
  mMaj9: "Cm + GM / C",
  // Dominant Family
  "7partial": "C7",
  7: "Gd7 / C",
  9: "Gm + CM / C",
  11: "GM + Dm + C7 / C",
  13: "GM + Dm + Em + C7 / C",
  // Diminished Family
  dim: "E♭d7 / C",
  dim7partial: "Cd7",
  dim7: "Cd7 / F♯",
  hdim7: "E♭m / C",
  // Augmented Family
  aug: "EM / C",
  aug7: "C7 / A♭",
  maj7s5: "EM + Em / C",
  // Suspended Family
  sus4: "G7 / C",
  sus2: "Gm / C",
  "7sus4": "\u2014",
  "7sus2": "Gm / C",
  maj7sus4: "G7 / C",
  "9sus4": "B♭M + Gm / C",
  // Altered Dominants
  "7b5": "F♯7 / C",
  "7b9": "CM + D♭d7 / C",
  "7s9": "E♭M + Gd7 / C",
  "7s11": "Gm + DM / C",
  "7b13": "C7 / A♭",
  // Misc
  b9no7: "\u2014",
  tritone: "C7 + F♯M / C",
  "9_11": "B♭M + CM / C",
};

// Expected outputs in F key (key=5). Includes the user's reported
// failing cases (maj7 -> "Am / F", m7 -> "A♭M / F", aug -> "AM / F").
const EXPECTED_F = {
  maj: "FM",
  min: "Fm",
  maj6: "Dm / F",
  maj7: "Am / F",
  maj7inv: "FM / E",
  maj9: "FM + CM / F",
  add9: "FM + G (RH)",
  m6: "Fm / D",
  ms5: "D♭M / F",
  m7: "A♭M / F",
  m9: "Fm + Cm / F",
  mMaj9: "Fm + CM / F",
  "7partial": "F7",
  7: "Cd7 / F",
  9: "Cm + FM / F",
  11: "CM + Gm + F7 / F",
  13: "CM + Gm + Am + F7 / F",
  dim: "A♭d7 / F",
  dim7partial: "Fd7",
  dim7: "Fd7 / B",
  hdim7: "A♭m / F",
  aug: "AM / F",
  aug7: "F7 / D♭",
  maj7s5: "AM + Am / F",
  sus4: "C7 / F",
  sus2: "Cm / F",
  "7sus4": "\u2014",
  "7sus2": "Cm / F",
  maj7sus4: "C7 / F",
  "9sus4": "E♭M + Cm / F",
  "7b5": "B7 / F",
  "7b9": "FM + F♯d7 / F",
  "7s9": "A♭M + Cd7 / F",
  "7s11": "Cm + GM / F",
  "7b13": "F7 / D♭",
  b9no7: "\u2014",
  tritone: "F7 + BM / F",
  "9_11": "E♭M + FM / F",
};

let passed = 0;
let failed = 0;

function check(c, key, keyName, expectedMap) {
  const expected = expectedMap[c.id];
  if (expected === undefined) {
    failed++;
    console.log(`  \u2717 [${keyName}] ${c.id} (suffix "${c.suffix}"): MISSING expected entry`);
    return;
  }
  const got = StradellaData.renderRecipe(c, key, true, null);
  if (got === expected) {
    passed++;
  } else {
    failed++;
    console.log(`  \u2717 [${keyName}] ${c.id} (suffix "${c.suffix}")`);
    console.log(`      expected: "${expected}"`);
    console.log(`      got:      "${got}"`);
  }
}

console.log(`Loaded ${StradellaData.CHORDS.length} chord entries.`);
console.log("");
console.log("--- key C ---");
StradellaData.CHORDS.forEach((c) => check(c, 0, "C", EXPECTED_C));
console.log("");
console.log("--- key F (user-reported failing key) ---");
StradellaData.CHORDS.forEach((c) => check(c, 5, "F", EXPECTED_F));

// Coverage: every chord must appear in BOTH expectation maps.
console.log("");
console.log("--- coverage ---");
const ids = StradellaData.CHORDS.map((c) => c.id);
const missingC = ids.filter((id) => !(id in EXPECTED_C));
const missingF = ids.filter((id) => !(id in EXPECTED_F));
const extraC = Object.keys(EXPECTED_C).filter((id) => !ids.includes(id));
const extraF = Object.keys(EXPECTED_F).filter((id) => !ids.includes(id));
function reportSet(label, arr) {
  if (arr.length === 0) {
    console.log(`  \u2713 ${label}: clean`);
    passed++;
  } else {
    console.log(`  \u2717 ${label}: [${arr.join(", ")}]`);
    failed++;
  }
}
reportSet("CHORDS entries missing from EXPECTED_C", missingC);
reportSet("CHORDS entries missing from EXPECTED_F", missingF);
reportSet("EXPECTED_C entries not in CHORDS (stale)", extraC);
reportSet("EXPECTED_F entries not in CHORDS (stale)", extraF);

// Targeted natural-pairing assertions: the "/ root" drop applies
// only to single-part-at-root recipes with root bass. Hand-pick a
// few representative chords so a future change to the rule (e.g.
// dropping the slash too aggressively) lights up loudly.
console.log("");
console.log("--- natural-pairing rule, hand-picked ---");
function expect(label, got, want) {
  if (got === want) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}`);
    console.log(`      expected: "${want}"`);
    console.log(`      got:      "${got}"`);
  }
}
const byId = {};
StradellaData.CHORDS.forEach((c) => (byId[c.id] = c));
expect("plain Cm drops slash (natural pairing)", StradellaData.renderRecipe(byId.min, 0, true, null), "Cm");
expect("Cmaj7 keeps slash (non-root chord button)", StradellaData.renderRecipe(byId.maj7, 0, true, null), "Em / C");
expect("Cm6 keeps slash (non-root bass)", StradellaData.renderRecipe(byId.m6, 0, true, null), "Cm / A");
expect("Cmaj9 keeps slash (multi-part stack)", StradellaData.renderRecipe(byId.maj9, 0, true, null), "CM + GM / C");
expect("Cmaj7 with bassOverride=G (G in score) becomes Em / G", StradellaData.renderRecipe(byId.maj7, 0, true, 7), "Em / G");
expect("Plain Cm with explicit bassOverride=C (root) still drops slash", StradellaData.renderRecipe(byId.min, 0, true, 0), "Cm");

// Fallback path: the dim/7 entries flip to a fallback recipe when
// hasDim7=false. Verify the renderer walks that path correctly.
console.log("");
console.log("--- fallback (hasDim7=false) ---");
expect('7 falls back to "Gm / C" when no d7 button', StradellaData.renderRecipe(byId["7"], 0, false, null), "Gm / C");
expect('dim falls back to "E♭m / C" when no d7 button', StradellaData.renderRecipe(byId.dim, 0, false, null), "E♭m / C");
expect("dim7partial fallback is null -> rendered as em-dash", StradellaData.renderRecipe(byId.dim7partial, 0, false, null), "\u2014");

// Note: StradellaData.verify() also runs structural checks (button
// quals, recipe-vs-semitones round trip, Tonal suffix recognition),
// but several of those depend on window.Tonal being loaded. In the
// browser they fire at page load and surface as console warnings.
// They're out of scope for this Node-side renderer test; keep this
// file focused on the renderRecipe output contract.

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
