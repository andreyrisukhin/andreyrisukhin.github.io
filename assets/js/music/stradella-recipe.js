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
    if (!M || !S || !chordName) return '';

    // Slash chords: drop bass for lookup, e.g. "Dm7/F" -> "Dm7"
    var name = chordName.split('/')[0];
    var rootMatch = name.match(/^([A-G][#b]?)(.*)/);
    if (!rootMatch) return '';
    var rootName = rootMatch[1];
    var suffix = rootMatch[2];
    // Tonal returns "CM" / "GM" / "EbM" for plain major triads; the
    // Stradella data records the basic Major Triad as suffix "" so
    // a literal "M" lookup returns nothing. Normalize first so the
    // overlay paints the same Cm-style "C / C" recipe for majors as
    // for minors.
    if (suffix === 'M') suffix = '';

    var rootSemitone = -1;
    for (var i = 0; i < M.NOTES.length; i++) {
      if (M.toAscii(M.NOTES[i]) === rootName) { rootSemitone = i; break; }
    }
    if (rootSemitone === -1) return '';

    var entries = S.findBySuffix(suffix);
    if (!entries.length) return '';

    var html = '<div class="stradella-recipe">';
    html += '<strong>Stradella:</strong>';
    for (var j = 0; j < entries.length; j++) {
      var c = entries[j];
      var recipe = S.renderRecipe(c, rootSemitone, true);
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
