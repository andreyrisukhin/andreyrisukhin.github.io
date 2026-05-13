// Shared chord-name parsing utilities.
//
// Single source of truth for "is this string shaped like a chord name"
// and for splitting a chord name into root / suffix / bass. Replaces
// the 5+ ad-hoc regexes that used to live in stradella-recipe.js,
// stradella-overlay.js, dev-annotator.js, and the page template, each
// of which agreed on the basic shape but disagreed on edge cases:
//
//   - capital M (Tonal's short form for major triads): only some had it
//   - unicode flat/sharp (♭ ♯): only some had them
//   - d7 / °7 / ø7 (diminished / half-diminished): only some had them
//   - the M -> "" normalization for the StradellaData lookup: lived
//     only in StradellaRecipe.render
//
// That divergence is what hid the "GM has no Stradella overlay" bug
// for plain major triads. From here on, every consumer should call
// `ChordName.looksValid()` for filter checks and `ChordName.parseForStradella()`
// when looking up recipes.

window.ChordName = (function () {
  'use strict';

  // Components, in pieces, so the spec is readable.
  var ROOT = '[A-G][#b\u266F\u266D]?';

  // Suffix alternation. Includes:
  //   - "" (basic major triad)
  //   - "M" (Tonal's short form for major)
  //   - lowercase "m" / "maj" / "min" / "dim" / "aug" / "sus" / "add"
  //   - "m6" / "m7" / "maj7" (specific common shapes some regex
  //     callers expect to allow without the loose \d* shortcut)
  //   - bare extensions "7" / "9" / "11" / "13"
  //   - special chords "d7" / "°" / "ø"
  //   - alterations "b5" / "b9" / "#5" / "#9" / "#11" / "b13" stacked
  //     after a base suffix
  var SUFFIX = '(?:M|m|maj|min|dim|aug|sus|add|m6|m7|maj7|7|9|11|13|d7|\u00b0|\u00f8)?';
  var ALT = '(?:[b\u266D#\u266F](?:5|9|11|13))*';
  var BASS = '(?:\\/' + ROOT + ')?';

  // Anchored: the entire string is a chord name.
  var FULL_RE = new RegExp('^' + ROOT + SUFFIX + ALT + BASS + '$');
  // Root-only matcher: peels root off the front, returns the tail.
  var ROOT_RE = new RegExp('^(' + ROOT + ')(.*)$');

  function looksValid(name) {
    return typeof name === 'string' && FULL_RE.test(name);
  }

  function parse(name) {
    if (typeof name !== 'string') return null;
    var bass = null;
    var head = name;
    var slash = name.indexOf('/');
    if (slash >= 0) {
      bass = name.slice(slash + 1);
      head = name.slice(0, slash);
    }
    var m = head.match(ROOT_RE);
    if (!m) return null;
    return { root: m[1], suffix: m[2] || '', bass: bass };
  }

  // Tonal returns "CM" / "GM" / "EbM" for plain major triads, but
  // StradellaData records them as suffix "" (Basic Triad). Normalize
  // here so the rest of the code never has to re-learn this trick.
  // Add new mappings as we discover them; one place to look.
  var SUFFIX_NORMALIZE = {
    M: '',
    Maj: '',
    major: '',
  };

  function normalizeSuffix(suffix) {
    if (suffix == null) return '';
    if (Object.prototype.hasOwnProperty.call(SUFFIX_NORMALIZE, suffix)) {
      return SUFFIX_NORMALIZE[suffix];
    }
    return suffix;
  }

  function parseForStradella(name) {
    var p = parse(name);
    if (!p) return null;
    return {
      root: p.root,
      suffix: normalizeSuffix(p.suffix),
      bass: p.bass,
    };
  }

  // Pitch-class to semitone (0-11). Accepts "C", "Db", "D#", with
  // unicode flat/sharp tolerated. Returns null if it doesn't parse.
  var BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pcToSemi(pc) {
    if (typeof pc !== 'string') return null;
    var m = pc.match(/^([A-G])([#b\u266F\u266D]{0,2})$/);
    if (!m) return null;
    var s = BASE[m[1]];
    var acc = m[2];
    for (var i = 0; i < acc.length; i++) {
      var ch = acc.charAt(i);
      if (ch === '#' || ch === '\u266F') s += 1;
      else if (ch === 'b' || ch === '\u266D') s -= 1;
    }
    return ((s % 12) + 12) % 12;
  }

  function samePitchClass(a, b) {
    var sa = pcToSemi(a);
    var sb = pcToSemi(b);
    return sa != null && sa === sb;
  }

  return {
    RE: FULL_RE,
    looksValid: looksValid,
    parse: parse,
    normalizeSuffix: normalizeSuffix,
    parseForStradella: parseForStradella,
    pcToSemi: pcToSemi,
    samePitchClass: samePitchClass,
  };
})();
