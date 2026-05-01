// Stradella chord data — shared between set list and chord recognizer
window.StradellaData = (function () {
  'use strict';

  var M = window.Music;

  // Button voicings: loaded from YAML via Jekyll, fallback to defaults
  var BUTTONS = window.StradellaButtons || {
    M:  [0, 4, 7],
    m:  [0, 3, 7],
    '7': [0, 4, 10],
    d7: [0, 3, 9]
  };

  // qual display labels for Stradella buttons
  var QUAL = { M: 'M', m: 'm', '7': '7', d7: 'd7' };

  // ── Chord data (semitone offsets from root) ──
  var CHORDS = [
    // Basic Triads
    { id: 'maj', suffix: '', family: 'Basic Triads',
      intervals: '1–3–5', semitones: '0–4–3',
      recipe: { parts: [{note:0, qual:'M'}], bass: 0 },
      notes: '' },
    { id: 'min', suffix: 'm', family: 'Basic Triads',
      intervals: '1–♭3–5', semitones: '0–3–4',
      recipe: { parts: [{note:0, qual:'m'}], bass: 0 },
      notes: '' },

    // Major Family
    { id: 'maj6', suffix: 'maj6', family: 'Major Family',
      intervals: '1–3–5–6', semitones: '0–4–3–2',
      recipe: { parts: [{note:9, qual:'m'}], bass: 0 },
      notes: '6m = 6–1–3 over root',
      approx: true, approxNote: 'Missing 5th' },
    { id: 'maj7', suffix: 'maj7', family: 'Major Family',
      intervals: '1–3–5–7', semitones: '0–4–3–4',
      recipe: { parts: [{note:4, qual:'m'}], bass: 0 },
      notes: '3–5–7 of root' },
    { id: 'maj7inv', suffix: 'maj7 (inv)', family: 'Major Family',
      intervals: '1–3–5–7', semitones: '0–4–3–4',
      recipe: { parts: [{note:0, qual:'M'}], bass: 11 },
      notes: '3rd inversion' },
    { id: 'maj9', suffix: 'maj9', family: 'Major Family',
      intervals: '1–3–5–7–9', semitones: '0–4–3–4–3',
      recipe: { parts: [{note:0, qual:'M'},{note:7, qual:'M'}], bass: 0 },
      notes: 'Root gives 1–3–5; 5th gives 5–7–9' },
    { id: 'add9', suffix: 'add9', family: 'Major Family',
      intervals: '1–3–5–9', semitones: '0–4–3–7',
      recipe: { parts: [{note:0, qual:'M'}], bass: 0, rh: 2 },
      notes: 'Exact 1–3–5–9, no 7th',
      uncertain: true, uncertainNote: 'Better way?' },

    // Minor Family
    { id: 'm6', suffix: 'm6', family: 'Minor Family',
      intervals: '1–♭3–5–6', semitones: '0–3–4–2',
      recipe: { parts: [{note:0, qual:'m'}], bass: 9 },
      notes: 'Rm / 6 bass = ♭3–5–1 + 6' },
    { id: 'ms5', suffix: 'm♯5', family: 'Minor Family',
      intervals: '1–♭3–♯5', semitones: '0–3–5',
      recipe: { parts: [{note:8, qual:'M'}], bass: 0 },
      notes: '♯5M = ♯5–1–♭3' },
    { id: 'm7', suffix: 'm7', family: 'Minor Family',
      intervals: '1–♭3–5–♭7', semitones: '0–3–4–3',
      recipe: { parts: [{note:3, qual:'M'}], bass: 0 },
      notes: '♭3 major = ♭3–5–♭7 of root' },
    { id: 'm9', suffix: 'm9', family: 'Minor Family',
      intervals: '1–♭3–5–♭7–9', semitones: '0–3–4–3–4',
      recipe: { parts: [{note:0, qual:'m'},{note:7, qual:'m'}], bass: 0 },
      notes: '♭3 gives ♭3–5–♭7; 5 adds 9' },
    { id: 'mMaj9', suffix: 'm(Maj9)', family: 'Minor Family',
      intervals: '1–♭3–5–7–9', semitones: '0–3–4–4–3',
      recipe: { parts: [{note:0, qual:'m'},{note:7, qual:'M'}], bass: 0 },
      notes: '' },

    // Dominant Family
    { id: '7partial', suffix: '7 (no 5)', family: 'Dominant Family',
      intervals: '1–3–♭7', semitones: '0–4–6',
      recipe: { parts: [{note:0, qual:'7'}], bass: 0 },
      notes: '7 button alone; omits 5th' },
    { id: '7', suffix: '7', family: 'Dominant Family',
      intervals: '1–3–5–♭7', semitones: '0–4–3–3',
      recipe: { parts: [{note:7, qual:'d7'}], bass: 0 },
      notes: '5d7 = 5–♭7–3; full 1–3–5–♭7',
      fallback: { parts: [{note:7, qual:'m'}], bass: 0 },
      fallbackApprox: true, fallbackNote: 'Missing 3rd (no d7)' },
    { id: '9', suffix: '9', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9', semitones: '0–4–3–3–4',
      recipe: { parts: [{note:7, qual:'m'},{note:0, qual:'M'}], bass: 0 },
      notes: '' },
    { id: '11', suffix: '11', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9–11', semitones: '0–4–3–3–4–3',
      recipe: { parts: [{note:7, qual:'M'},{note:2, qual:'m'},{note:0, qual:'7'}], bass: 0 },
      notes: '2m adds 11. Theoretical full set',
      approx: true, approxNote: 'Extra tones from stacking' },
    { id: '13', suffix: '13', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9–11–13', semitones: '0–4–3–3–4–3–4',
      recipe: { parts: [{note:7, qual:'M'},{note:2, qual:'m'},{note:4, qual:'m'},{note:0, qual:'7'}], bass: 0 },
      notes: 'Full set; RH recommended',
      approx: true, approxNote: 'Extra 7th from stacking' },

    // Diminished Family
    { id: 'dim', suffix: 'dim', family: 'Diminished Family',
      intervals: '1–♭3–♭5', semitones: '0–3–3',
      recipe: { parts: [{note:3, qual:'d7'}], bass: 0 },
      notes: '♭3d7 = ♭3–♭5–1',
      fallback: { parts: [{note:3, qual:'m'}], bass: 0 },
      fallbackApprox: true, fallbackNote: 'Extra ♭7 (no d7)' },
    { id: 'dim7partial', suffix: '°7 (no ♭5)', family: 'Diminished Family',
      intervals: '1–♭3–𝄫7', semitones: '0–3–6',
      recipe: { parts: [{note:0, qual:'d7'}], bass: 0 },
      notes: 'd7 button alone; omits ♭5',
      fallback: null },
    { id: 'dim7', suffix: '°7', family: 'Diminished Family',
      intervals: '1–♭3–♭5–𝄫7', semitones: '0–3–3–3',
      recipe: { parts: [{note:0, qual:'d7'}], bass: 6 },
      notes: 'd7 + ♭5 bass; full 1–♭3–♭5–𝄫7',
      fallback: { parts: [{note:3, qual:'m'}], bass: 0 },
      fallbackUncertain: true, fallbackNote: 'Half-dim voicing (no d7)' },
    { id: 'hdim7', suffix: 'ø7', family: 'Diminished Family',
      intervals: '1–♭3–♭5–♭7', semitones: '0–3–3–4',
      recipe: { parts: [{note:3, qual:'m'}], bass: 0 },
      notes: '♭3m = ♭3–♭5–♭7, half diminished' },

    // Augmented Family
    { id: 'aug', suffix: '+', family: 'Augmented Family',
      intervals: '1–3–♯5', semitones: '0–4–4',
      recipe: { parts: [{note:4, qual:'M'}], bass: 0 },
      notes: '3 major gives 3–♯5–7',
      approx: true, approxNote: 'Extra 7th from triad' },
    { id: 'aug7', suffix: '+7', family: 'Augmented Family',
      intervals: '1–3–♯5–♭7', semitones: '0–4–4–2',
      recipe: { parts: [{note:0, qual:'7'}], bass: 8 },
      notes: 'R7 / ♯5 bass = 1–3–♭7 + ♯5' },
    { id: 'maj7s5', suffix: 'maj7♯5', family: 'Augmented Family',
      intervals: '1–3–♯5–7', semitones: '0–4–4–3',
      recipe: { parts: [{note:4, qual:'M'},{note:4, qual:'m'}], bass: 0 },
      notes: '',
      approx: true, approxNote: 'Extra 5th from triad' },

    // Sus Family
    { id: 'sus4', suffix: 'sus4', family: 'Suspended Family',
      intervals: '1–4–5', semitones: '0–5–2',
      recipe: { parts: [{note:7, qual:'7'}], bass: 0 },
      notes: '57/R = 1–4–5–7; actually maj7sus4',
      approx: true, approxNote: 'Extra major 7th' },
    { id: 'sus2', suffix: 'sus2', family: 'Suspended Family',
      intervals: '1–2–5', semitones: '0–2–5',
      recipe: { parts: [{note:7, qual:'m'}], bass: 0 },
      notes: '5m/R = 5–♭7–9 over root',
      approx: true, approxNote: 'Extra ♭7th' },
    { id: '7sus4', suffix: '7sus4', family: 'Suspended Family',
      intervals: '1–4–5–♭7', semitones: '0–5–2–3',
      recipe: null,
      notes: 'No clean Stradella recipe' },
    { id: '7sus2', suffix: '7sus2', family: 'Suspended Family',
      intervals: '1–2–5–♭7', semitones: '0–2–5–3',
      recipe: { parts: [{note:7, qual:'m'}], bass: 0 },
      notes: '5m/R = 5–♭7–2; same as sus2 approx' },
    { id: 'maj7sus4', suffix: 'maj7sus4', family: 'Suspended Family',
      intervals: '1–4–5–7', semitones: '0–5–2–4',
      recipe: { parts: [{note:7, qual:'7'}], bass: 0 },
      notes: '57/R = 5–7–4; exact' },
    { id: '9sus4', suffix: '9sus4', family: 'Suspended Family',
      intervals: '1–4–5–♭7–9', semitones: '0–5–2–3–4',
      recipe: { parts: [{note:10, qual:'M'},{note:7, qual:'m'}], bass: 0 },
      notes: '♭7M + 5m = ♭7–2–4 + 5–♭7–2' },

    // Altered Dominants
    { id: '7b5', suffix: '7♭5', family: 'Altered Dominants',
      intervals: '1–3–♭5–♭7', semitones: '0–4–2–4',
      recipe: { parts: [{note:6, qual:'7'}], bass: 0 },
      notes: '♭5dom7. Equivalent to ♯4 dom7♭5' },
    { id: '7b9', suffix: '7♭9', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♭9', semitones: '0–4–3–3–3',
      recipe: { parts: [{note:0, qual:'M'},{note:1, qual:'d7'}], bass: 0 },
      notes: 'RM + ♭2d7 = 1–3–5 + ♭9–♭7–5',
      fallback: { parts: [{note:1, qual:'M'}], bass: 0 },
      fallbackApprox: true, fallbackNote: 'Only gives ♭9 (no d7)' },
    { id: '7s9', suffix: '7♯9', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♯9', semitones: '0–4–3–3–5',
      recipe: { parts: [{note:3, qual:'M'},{note:7, qual:'d7'}], bass: 0 },
      notes: '♭3M + 5d7 = ♯9–5–♭7 + 5–♭7–3',
      fallback: { parts: [{note:3, qual:'M'}], bass: 0 },
      fallbackApprox: true, fallbackNote: 'Missing 3rd (no d7)' },
    { id: '7s11', suffix: '7♯11', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♯11', semitones: '0–4–3–3–6',
      recipe: { parts: [{note:7, qual:'m'},{note:2, qual:'M'}], bass: 0 },
      notes: '2 major gives ♯11',
      approx: true, approxNote: 'Missing 3rd, extra 9th/13th' },
    { id: '7b13', suffix: '7♭13', family: 'Altered Dominants',
      intervals: '1–3–♯5–♭7', semitones: '0–4–4–2',
      recipe: { parts: [{note:0, qual:'7'}], bass: 8 },
      notes: 'Enharmonic with +7; R7 / ♯5 bass' },

    // Misc
    { id: 'b9no7', suffix: '♭9', family: 'Misc',
      intervals: '1–3–5–♭9', semitones: '0–4–3–6',
      recipe: null,
      notes: 'No clean Stradella recipe' },
    { id: 'tritone', suffix: ' tritone', family: 'Misc',
      intervals: '1–3–♭5–♭7–♭9', semitones: '0–4–2–4–3',
      recipe: { parts: [{note:0, qual:'7'},{note:6, qual:'M'}], bass: 0 },
      notes: 'R7 + ♭5M = tritone sub stack',
      approx: true, approxNote: 'Dense 5-note voicing' },
    { id: '9_11', suffix: '9(11)', family: 'Misc',
      intervals: '1–3–5–♭7–9–11', semitones: '0–4–3–3–4–3',
      recipe: { parts: [{note:10, qual:'M'},{note:0, qual:'M'}], bass: 0 },
      notes: 'Can omit 5, maybe 3' }
  ];

  // ── Helpers ──

  function usesD7(c) {
    return c.recipe && c.recipe.parts.some(function (p) { return p.qual === 'd7'; });
  }

  function getRecipe(c, hasDim7) {
    if (hasDim7 === false && usesD7(c)) return c.fallback;
    return c.recipe;
  }

  function renderRecipe(c, key, hasDim7) {
    var r = getRecipe(c, hasDim7);
    if (!r) return '\u2014';
    var parts = r.parts.map(function (p) {
      return M.noteName(key + p.note) + QUAL[p.qual];
    });
    var bass = M.noteName(key + r.bass);
    var str = parts.join(' + ') + ' / ' + bass;
    if (r.rh != null) {
      str += ' + ' + M.noteName(key + r.rh) + ' (RH)';
    }
    return str;
  }

  function chordById(id) {
    for (var i = 0; i < CHORDS.length; i++) {
      if (CHORDS[i].id === id) return CHORDS[i];
    }
    return null;
  }

  // Find chord entries matching a Tonal-style suffix (e.g. "m7", "dim", "M")
  // Returns array since multiple recipes may exist for the same chord type
  function findBySuffix(suffix) {
    var results = [];
    for (var i = 0; i < CHORDS.length; i++) {
      if (CHORDS[i].suffix === suffix) results.push(CHORDS[i]);
    }
    // Also try matching via SUFFIX_TO_TONAL reverse lookup
    if (results.length === 0 && M.SUFFIX_TO_TONAL) {
      for (var displaySuffix in M.SUFFIX_TO_TONAL) {
        if (M.SUFFIX_TO_TONAL[displaySuffix] === suffix) {
          for (var j = 0; j < CHORDS.length; j++) {
            if (CHORDS[j].suffix === displaySuffix) results.push(CHORDS[j]);
          }
        }
      }
    }
    return results;
  }

  function computeInversions(entry, key) {
    if (!entry.semitones) return [];
    var splits = entry.semitones.split('\u2013');
    var cum = [];
    var sum = 0;
    for (var i = 0; i < splits.length; i++) {
      sum += parseInt(splits[i], 10);
      cum.push(sum % 12);
    }
    var inversions = [];
    for (var j = 1; j < cum.length; j++) {
      inversions.push({
        bass: cum[j],
        label: M.noteName(key) + entry.suffix + ' / ' + M.noteName(key + cum[j])
      });
    }
    return inversions;
  }

  // Verify chord data integrity, log warnings to console
  function verify() {
    var errors = [];
    CHORDS.forEach(function (c) {
      if (!c.intervals) errors.push(c.id + ': missing intervals');
      if (c.semitones == null) errors.push(c.id + ': missing semitones');
      var info = M.chordInfo(0, c.suffix);
      if (!info) errors.push(c.id + ': chordInfo failed for suffix "' + c.suffix + '" \u2014 add to SUFFIX_TO_TONAL');
      if (c.recipe) {
        c.recipe.parts.forEach(function (p) {
          if (!BUTTONS[p.qual]) errors.push(c.id + ': unknown button qual "' + p.qual + '"');
        });
      }
      if (c.fallback) {
        c.fallback.parts.forEach(function (p) {
          if (!BUTTONS[p.qual]) errors.push(c.id + ': unknown fallback button qual "' + p.qual + '"');
        });
      }
      if (c.recipe) {
        if (c.semitones && !c.bug && !c.approx && !c.uncertain) {
          var got = {};
          got[(c.recipe.bass) % 12] = true;
          c.recipe.parts.forEach(function (p) {
            var offsets = BUTTONS[p.qual];
            if (!offsets) return;
            offsets.forEach(function (o) { got[(p.note + o) % 12] = true; });
          });
          if (c.recipe.rh != null) got[c.recipe.rh % 12] = true;
          var want = {};
          c.semitones.split('\u2013').reduce(function (acc, s) {
            acc += parseInt(s, 10);
            want[acc % 12] = true;
            return acc;
          }, 0);
          var gotKeys = Object.keys(got).sort();
          var wantKeys = Object.keys(want).sort();
          if (gotKeys.join() !== wantKeys.join()) {
            var gotNotes = gotKeys.map(function (k) { return M.noteName(+k); });
            var wantNotes = wantKeys.map(function (k) { return M.noteName(+k); });
            errors.push(c.id + ': recipe gives [' + gotNotes + '] but expected [' + wantNotes + ']');
          }
        }
      }
    });
    if (errors.length) {
      console.warn('Stradella data issues (' + errors.length + '):');
      errors.forEach(function (e) { console.warn('  ' + e); });
    }
  }

  return {
    BUTTONS: BUTTONS,
    QUAL: QUAL,
    CHORDS: CHORDS,
    usesD7: usesD7,
    getRecipe: getRecipe,
    renderRecipe: renderRecipe,
    chordById: chordById,
    findBySuffix: findBySuffix,
    computeInversions: computeInversions,
    verify: verify
  };
})();
