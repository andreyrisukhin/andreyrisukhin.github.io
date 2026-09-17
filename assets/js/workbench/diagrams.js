window.WorkbenchDiagrams = (function () {
  "use strict";
  var M = window.Music;
  var Model = window.WorkbenchModel;
  var LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  function staff(model, voices) {
    voices = voices || Model.voices(model);
    var steps = voices.map(function (v) {
      return LETTERS[v.name[0]] + (v.octave - 4) * 7 - 2;
    });
    var top = Math.max(8, Math.max.apply(null, steps));
    var height = (top + 4) * 6 + 36;
    var bottom = height - 36;
    var width = Math.max(260, 58 + voices.length * 48);
    var html =
      '<svg class="wb-staff" role="group" aria-label="' +
      (model.voicing === "bass-octave" ? "Chord tones in chosen order" : "Chord tones in ascending pitch order") +
      '" style="min-width:' +
      width +
      'px" viewBox="0 0 ' +
      width +
      " " +
      height +
      '">';
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
    var labels = {};
    voices.forEach(function (v) {
      labels[v.midi] = v.name.replace(/b/g, "♭").replace(/#/g, "♯") + v.octave;
    });
    var rootVoice = voices.find(function (v) {
      return v.pc === model.root;
    });
    return BayanKeyboard.html({
      low: Math.max(0, voices[0].midi - 3),
      high: Math.min(
        127,
        Math.max(
          voices[0].midi + 14,
          ...voices.map(function (v) {
            return v.midi + 3;
          })
        )
      ),
      selected: voices.map(function (v) {
        return v.midi;
      }),
      root: rootVoice ? rootVoice.midi : null,
      labels: labels,
    });
  }
  return { staff: staff, keyboard: keyboard };
})();
