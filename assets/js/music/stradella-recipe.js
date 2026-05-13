// Shared Stradella-recipe renderer.
//
// Lifts the chord-recognizer's renderStradellaInfo into a small module so
// the sheet-music chord inspector can reuse the same lookup. Pass a chord
// name (e.g. "Cm", "Dm7", "Fm/D") and get back HTML listing every
// Stradella voicing in StradellaData that matches the suffix.
//
// Returns '' when StradellaData isn't loaded, the chord name doesn't parse,
// or no voicings match the suffix.
window.StradellaRecipe = (function () {
  'use strict';

  function render(chordName) {
    var M = window.Music;
    var S = window.StradellaData;
    var CN = window.ChordName;
    if (!M || !S || !CN || !chordName) return '';

    // Single source of truth: parse + Tonal->Stradella suffix
    // normalization (M -> "" for major triads, etc.) lives in
    // assets/js/music/chord-name.js. Add new aliases there, never
    // here, so every consumer (overlay, inspector, recognizer)
    // benefits from the fix.
    var parsed = CN.parseForStradella(chordName);
    if (!parsed) return '';
    var rootName = parsed.root;
    var suffix = parsed.suffix;

    var rootSemitone = -1;
    for (var i = 0; i < M.NOTES.length; i++) {
      if (M.toAscii(M.NOTES[i]) === rootName) { rootSemitone = i; break; }
    }
    if (rootSemitone === -1) return '';

    var entries = S.findBySuffix(suffix);
    if (!entries.length) return '';

    // If the chord name carries an explicit /bass that disagrees
    // with the chord's root (i.e., score voiced this in inversion),
    // honor it in the recipe so the player presses the bass that's
    // actually written.
    var bassOverride = null;
    if (parsed.bass) {
      var bassSemi = CN.pcToSemi(parsed.bass);
      if (bassSemi != null && bassSemi !== rootSemitone) {
        bassOverride = bassSemi;
      }
    }

    var html = '<div class="stradella-recipe">';
    html += '<strong>Stradella:</strong>';
    for (var j = 0; j < entries.length; j++) {
      var c = entries[j];
      var recipe = S.renderRecipe(c, rootSemitone, true, bassOverride);
      var cls = 'stradella-recipe__item';
      if (c.bug) cls += ' is-bug';
      else if (c.approx) cls += ' is-approx';
      html += '<div class="' + cls + '">';
      html += '<span class="stradella-recipe__voicing">' + M.esc(recipe) + '</span>';
      if (c.notes) {
        html += '<span class="stradella-recipe__note">' + M.esc(c.notes) + '</span>';
      }
      var warn = c.bugNote || c.approxNote || c.uncertainNote;
      if (warn) {
        html += '<span class="stradella-recipe__warn">' + M.esc(warn) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  return { render: render };
})();
