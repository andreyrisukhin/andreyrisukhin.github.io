// Workbench input classifier — pure logic, usable in browser and node (for tests)
// classify(input, deps) -> { type: 'empty'|'url'|'note'|'notes'|'recipe'|'chords'|'unknown', ... }
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.WorkbenchClassify = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NOTE_RE = /^[A-Ga-g](?:b|#|\u266D|\u266F)?$/;
  var CHORD_SHAPE_RE = /^[A-Ga-g](?:b|#|\u266D|\u266F)?[^\s/]*(?:\/[A-Ga-g](?:b|#|\u266D|\u266F)?)?$/;
  // Scale degree: arabic 1-7 or roman i-vii, optional quality suffix (V7, viiø, 2m7)
  var DEGREE_RE = /^(vii|vi|v|iv|iii|ii|i|[1-7])(\u00B0|\u00F8|dim7?|maj7|m7b5|m7|m|7)?$/i;
  // ABC melody token: optional accidental (^ _ =), note letter or z rest,
  // octave marks (, '), duration (2, /2, 3/2)
  var ABC_NOTE_RE = /^[_^=]?[A-Ga-gz][,']*\d*\/?\d*$/;

  // deps.isChord(token) -> bool: does this token name a real chord?
  // deps.parseRecipe(str) -> [semitones]|null: Stradella recipe parser
  function classify(input, deps) {
    deps = deps || {};
    var isChord =
      deps.isChord ||
      function () {
        return false;
      };
    var parseRecipe =
      deps.parseRecipe ||
      function () {
        return null;
      };

    var str = (input || "").trim();
    if (!str) return { type: "empty" };

    if (/^https?:\/\/\S+$/i.test(str)) return { type: "url", url: str };

    var tokens = str.split(/\s+/);

    // Sheet draft: ABC-ish melody — bar lines with notes, or notes carrying durations
    if (str.indexOf("|") !== -1) {
      var barTokens = str.split(/[|\s]+/).filter(function (t) {
        return t;
      });
      if (
        barTokens.length > 0 &&
        barTokens.every(function (t) {
          return ABC_NOTE_RE.test(t);
        })
      ) {
        return { type: "sheet", text: str };
      }
    }
    if (
      tokens.length >= 2 &&
      tokens.every(function (t) {
        return ABC_NOTE_RE.test(t);
      }) &&
      tokens.some(function (t) {
        return /\d/.test(t);
      })
    ) {
      return { type: "sheet", text: str };
    }

    // Degree progression, e.g. "2 5 1", "ii V7 I", optionally "... in G"
    var degreeTokens = tokens;
    var key = null;
    if (tokens.length >= 3 && tokens[tokens.length - 2].toLowerCase() === "in" && NOTE_RE.test(tokens[tokens.length - 1])) {
      degreeTokens = tokens.slice(0, -2);
      key = tokens[tokens.length - 1];
    }
    if (
      degreeTokens.length >= 2 &&
      degreeTokens.every(function (t) {
        return DEGREE_RE.test(t);
      })
    ) {
      return { type: "degrees", degrees: degreeTokens, key: key };
    }

    var allNotes = tokens.every(function (t) {
      return NOTE_RE.test(t);
    });

    if (allNotes) {
      if (tokens.length === 1) return { type: "note", token: tokens[0] };
      return { type: "notes", tokens: tokens };
    }

    // Stradella recipe, e.g. "Fd7/C" or "CM + Gm/D"
    if (str.indexOf("/") !== -1) {
      var recipeNotes = parseRecipe(str);
      if (recipeNotes && recipeNotes.length >= 2) {
        return { type: "recipe", notes: recipeNotes };
      }
    }

    // Chord name(s), e.g. "Am7" or "Am7 D7 Gmaj7" or "C/E"
    var allChords = tokens.every(function (t) {
      return CHORD_SHAPE_RE.test(t) && isChord(t);
    });
    if (allChords) return { type: "chords", names: tokens };

    return { type: "unknown", tokens: tokens };
  }

  return { classify: classify, NOTE_RE: NOTE_RE, CHORD_SHAPE_RE: CHORD_SHAPE_RE, ABC_NOTE_RE: ABC_NOTE_RE };
});
