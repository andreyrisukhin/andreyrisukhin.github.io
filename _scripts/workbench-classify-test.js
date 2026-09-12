#!/usr/bin/env node
// Tests for the workbench input classifier
// Usage: node _scripts/workbench-classify-test.js

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");

function loadIntoWindow(win, file) {
  var code = fs.readFileSync(path.join(root, file), "utf8");
  new Function("window", "document", "self", code)(
    win,
    {
      createElement: function () {
        return {};
      },
    },
    undefined
  );
}

// Build a browser-like environment with the real deps
var win = {};
var tonalCode = fs.readFileSync(path.join(root, "assets/js/vendor/tonal.min.js"), "utf8");
win.Tonal = new Function(tonalCode + "; return Tonal;")();
loadIntoWindow(win, "assets/js/music/common.js");
loadIntoWindow(win, "assets/js/music/stradella-data.js");

var Classify = require(path.join(root, "assets/js/workbench/classify.js"));
var M = win.Music;
var Tonal = win.Tonal;

// Same deps the workbench page wires up
function isChord(tok) {
  var parts = tok.split("/");
  if (parts.length > 2) return false;
  var name = M.toAscii(parts[0]);
  name = name.charAt(0).toUpperCase() + name.slice(1);
  var chord = Tonal.Chord.get(name);
  if (chord.empty || !chord.notes || chord.notes.length === 0) return false;
  if (parts.length === 2 && M.parseNote(parts[1]) === -1) return false;
  return true;
}

function parseRecipe(str) {
  return M.parseRecipeInput(str);
}

var deps = { isChord: isChord, parseRecipe: parseRecipe };

var failures = 0;
var count = 0;

function expectType(input, type, extra) {
  count++;
  var r = Classify.classify(input, deps);
  var ok = r.type === type;
  if (ok && extra) ok = extra(r);
  if (!ok) {
    failures++;
    console.log("FAIL: classify(" + JSON.stringify(input) + ") -> " + JSON.stringify(r) + ", expected type " + type);
  }
}

// Empty
expectType("", "empty");
expectType("   ", "empty");

// URLs
expectType("https://musescore.com/user/1/scores/2", "url");
expectType("http://tabs.ultimate-guitar.com/tab/x/y", "url");

// Single note (ambiguous with chord, resolved as note)
expectType("C", "note");
expectType("eb", "note");
expectType("F#", "note");

// Note sequences
expectType("C E G", "notes", function (r) {
  return r.tokens.length === 3;
});
expectType("c e g", "notes");
expectType("Eb G Bb", "notes");
expectType("E\u266D G B\u266D", "notes");
expectType("B D# F# A#", "notes");

// Chord names
expectType("Am7", "chords", function (r) {
  return r.names[0] === "Am7";
});
expectType("Cmaj7", "chords");
expectType("F#dim7", "chords");
expectType("Bbm", "chords");
expectType("C/E", "chords");
expectType("Am7 D7 Gmaj7", "chords", function (r) {
  return r.names.length === 3;
});

// Stradella recipes
expectType("Fd7/C", "recipe", function (r) {
  return r.notes.length >= 2;
});
expectType("CM + Gm/D", "recipe");
// Bass note must come first even when it is not the lowest semitone
expectType("GM / B", "recipe", function (r) {
  return r.notes[0] === 11;
});
expectType("CM + Gm/D", "recipe", function (r) {
  return r.notes[0] === 2;
});

// Sheet drafts (ABC-ish melodies)
expectType("C E G | c e g", "sheet");
expectType("C2 E2 G4", "sheet");
expectType("C2 E G c | d2 B2 | c4", "sheet");
expectType("^F G A | z2 B2", "sheet");
// No durations, no bars -> still plain notes
expectType("C E G", "notes");
// Bars require ABC tokens throughout
expectType("C E hello | G", "unknown");

// Degree progressions
expectType("2 5 1", "degrees", function (r) {
  return r.degrees.length === 3 && r.key === null;
});
expectType("ii V I", "degrees");
expectType("ii V7 Imaj7", "degrees");
expectType("2 5 1 in G", "degrees", function (r) {
  return r.key === "G" && r.degrees.length === 3;
});
expectType("1 4 5 in Bb", "degrees", function (r) {
  return r.key === "Bb";
});
expectType("vi ii V I", "degrees");
// Single degree stays unrecognized (too ambiguous)
expectType("5", "unknown");

// Garbage
expectType("hello world", "unknown");
expectType("C X G", "unknown");
expectType("Zm7", "unknown");

console.log(count - failures + "/" + count + " passed");
process.exit(failures > 0 ? 1 : 0);
