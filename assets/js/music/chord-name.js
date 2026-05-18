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

  // Suffix: permissive — anything between the root and an optional
  // /bass. Validating "is this a known chord type" is the consumer's
  // job (e.g. StradellaData.findBySuffix returns no matches for a
  // garbage suffix). Locking down the suffix alternation here used to
  // silently reject common chord types the alternation didn't
  // enumerate ("Cm9", "Cm11", "Cdim7", "Cmaj9", "Cm(Maj7)", ...) even
  // though the parser's downstream code handled them fine. The right
  // contract for looksValid is "the string is chord-shaped (valid
  // root, possibly-empty suffix, optional /bass)", not "every
  // suffix is enumerated here". A suffix may not contain a slash --
  // the first slash separates the chord body from the bass.
  var SUFFIX = '[^/]*';
  var BASS = '(?:\\/' + ROOT + ')?';

  // Anchored: the entire string is a chord name.
  var FULL_RE = new RegExp('^' + ROOT + SUFFIX + BASS + '$');
  // Root-only matcher: peels root off the front, returns the tail.
  var ROOT_RE = new RegExp('^(' + ROOT + ')(.*)$');

  // Jazz shorthand normalization: in lead-sheet / chord-chart writing,
  // a "-" immediately after the root note means minor. So "A-7/G" is
  // the same chord as "Am7/G", and "F#-6" is the same as "F#m6".
  // Normalize before regex matching so the SUFFIX alternation above
  // doesn't have to learn a second spelling of every minor variant.
  // Strips "-" only when it sits between the root and a suffix; an
  // accidental dash anywhere else in the string still fails to parse.
  var SHORTHAND_RE = /^([A-G][#b\u266F\u266D]?)-/;
  function normalizeShorthand(name) {
    return typeof name === 'string' ? name.replace(SHORTHAND_RE, '$1m') : name;
  }

  function looksValid(name) {
    return typeof name === 'string' && FULL_RE.test(normalizeShorthand(name));
  }

  function parse(name) {
    if (typeof name !== 'string') return null;
    var n = normalizeShorthand(name);
    var bass = null;
    var head = n;
    var slash = n.indexOf('/');
    if (slash >= 0) {
      bass = n.slice(slash + 1);
      head = n.slice(0, slash);
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
