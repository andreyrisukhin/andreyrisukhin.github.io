window.WorkbenchDiagrams = (function () {
  "use strict";
  var M = window.Music;
  var Model = window.WorkbenchModel;
  var LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  function staff(model) {
    var voices = Model.voices(model);
    var steps = voices.map(function (v) {
      return LETTERS[v.name[0]] + (v.octave - 4) * 7 - 2;
    });
    var top = Math.max(8, Math.max.apply(null, steps));
    var height = (top + 4) * 6 + 36;
    var bottom = height - 36;
    var width = Math.max(260, 58 + voices.length * 48);
    var html = '<svg class="wb-staff" role="group" aria-label="Chord tones in ascending pitch order" viewBox="0 0 ' + width + " " + height + '">';
    [0, 2, 4, 6, 8].forEach(function (step) {
      var y = bottom - step * 6;
      html += '<line x1="36" y1="' + y + '" x2="' + (width - 8) + '" y2="' + y + '"/>';
    });
    html += '<text class="wb-clef" x="0" y="' + (bottom - 9) + '">𝄞</text>';
    voices.forEach(function (v, i) {
      var x = 66 + i * 48,
        step = steps[i],
        y = bottom - step * 6;
      var label = v.name.replace(/b/g, "♭").replace(/#/g, "♯") + v.octave;
      html +=
        '<g role="button" tabindex="0" data-pc="' +
        v.pc +
        '" data-midi="' +
        v.midi +
        '" aria-label="Hear ' +
        M.esc(label) +
        '"><title>' +
        M.esc(label) +
        "</title>";
      html += '<rect class="wb-note-hit" x="' + (x - 22) + '" y="' + (y - 22) + '" width="44" height="44"/>';
      for (var s = -2; s >= step; s -= 2) {
        html += '<line x1="' + (x - 13) + '" x2="' + (x + 13) + '" y1="' + (bottom - s * 6) + '" y2="' + (bottom - s * 6) + '"/>';
      }
      for (var t = 10; t <= step; t += 2) {
        html += '<line x1="' + (x - 13) + '" x2="' + (x + 13) + '" y1="' + (bottom - t * 6) + '" y2="' + (bottom - t * 6) + '"/>';
      }
      var accidental = v.name.slice(1).replace(/b/g, "♭").replace(/#/g, "♯");
      html += '<text x="' + (x - 18) + '" y="' + (y + 5) + '">' + M.esc(accidental) + "</text>";
      html += '<ellipse cx="' + x + '" cy="' + y + '" rx="7" ry="5" transform="rotate(-15 ' + x + " " + y + ')"/></g>';
    });
    return html + "</svg>";
  }
  function keyboard(model) {
    var voices = Model.voices(model);
    var base = Math.floor(voices[0].midi / 12) * 12;
    var max = Math.max(base + 23, voices[voices.length - 1].midi);
    var columns = Math.ceil((max - base + 1) / 3);
    var html =
      '<div class="wb-keyboard-scroll" tabindex="0" role="group" aria-label="B-system pitch map, rotated view. Scroll for higher notes.">' +
      '<div class="wb-keyboard" style="--wb-columns:' +
      columns +
      '">';
    for (var row = 2; row >= 0; row--) {
      for (var col = 0; col < columns; col++) {
        var midi = base + col * 3 + row,
          pc = midi % 12;
        var voice = voices.find(function (v) {
          return v.midi === midi;
        });
        var name = voice ? voice.name.replace(/b/g, "♭").replace(/#/g, "♯") : M.noteName(pc);
        var octave = voice ? voice.octave : Math.floor(midi / 12) - 1;
        html +=
          '<button type="button" class="wb-key' +
          (model.notes.indexOf(pc) >= 0 ? " in-chord" : "") +
          '" data-midi="' +
          midi +
          '" data-pc="' +
          pc +
          '" aria-label="Hear ' +
          M.esc(name) +
          octave +
          '"><span>' +
          M.esc(name) +
          "</span><small>" +
          octave +
          "</small></button>";
      }
    }
    return html + "</div></div>";
  }
  return { staff: staff, keyboard: keyboard };
})();
