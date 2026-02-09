// Chord Recognizer Tool
(function () {
  'use strict';

  var M = window.Music;

  // ── Staff rendering data (shared with blues) ──

  var LETTER_STEP = { C: -2, D: -1, E: 0, F: 1, G: 2, A: 3, B: 4 };

  var SEMITONE_TO_STAFF = [
    { letter: 'C', acc: '' },
    { letter: 'D', acc: '\u266D' },
    { letter: 'D', acc: '' },
    { letter: 'E', acc: '\u266D' },
    { letter: 'E', acc: '' },
    { letter: 'F', acc: '' },
    { letter: 'F', acc: '\u266F' },
    { letter: 'G', acc: '' },
    { letter: 'A', acc: '\u266D' },
    { letter: 'A', acc: '' },
    { letter: 'B', acc: '\u266D' },
    { letter: 'B', acc: '' }
  ];

  // ── State ──

  var state = {
    notes: [] // ordered array of semitone values (0–11)
  };

  // ── Note management ──

  function addNote(semitone) {
    if (state.notes.indexOf(semitone) === -1) {
      state.notes.push(semitone);
    }
  }

  function removeNote(semitone) {
    var idx = state.notes.indexOf(semitone);
    if (idx !== -1) state.notes.splice(idx, 1);
  }

  function toggleNote(semitone) {
    if (state.notes.indexOf(semitone) !== -1) {
      removeNote(semitone);
    } else {
      addNote(semitone);
    }
  }

  // ── Chord detection ──

  function detectChord() {
    if (state.notes.length < 2 || !window.Tonal) return [];
    var names = state.notes.map(function (s) { return M.asciiNoteName(s); });
    return Tonal.Chord.detect(names);
  }

  // Determine inversion label from a chord name like "C/E"
  function inversionLabel(chordName) {
    if (!window.Tonal) return '';
    var parts = chordName.split('/');
    if (parts.length < 2) return 'Root position';

    var bass = parts[parts.length - 1];
    var rootChord = parts.slice(0, parts.length - 1).join('/');
    var chord = Tonal.Chord.get(rootChord);
    if (chord.empty || !chord.notes) return '';

    // Find bass in chord notes
    var bassChroma = Tonal.Note.chroma(bass);
    for (var i = 0; i < chord.notes.length; i++) {
      if (Tonal.Note.chroma(chord.notes[i]) === bassChroma) {
        var labels = ['Root position', '1st inversion', '2nd inversion', '3rd inversion'];
        return labels[i] || i + 'th inversion';
      }
    }
    return 'Bass: ' + bass;
  }

  // Get detail info for a detected chord name
  function chordDetail(chordName) {
    if (!window.Tonal) return null;
    var chord = Tonal.Chord.get(chordName);
    if (chord.empty) return null;

    var semitones = chord.intervals.map(function (iv) {
      return Tonal.Interval.semitones(iv);
    });

    return {
      notes: chord.notes,
      intervals: chord.intervals.map(M.formatInterval),
      semitones: semitones
    };
  }

  // ── Rendering ──

  function renderNoteButtons() {
    var container = document.getElementById('recognizer-note-buttons');
    if (!container) return;
    var html = '';
    M.NOTES.forEach(function (n, i) {
      var isActive = state.notes.indexOf(i) !== -1;
      var order = isActive ? state.notes.indexOf(i) + 1 : 0;
      var cls = 'recognizer-note-btn';
      if (isActive) cls += ' is-active';
      html += '<button class="' + cls + '" data-semitone="' + i + '">';
      if (isActive) {
        html += '<span class="recognizer-order">' + order + '</span>';
      }
      html += M.esc(n) + '</button>';
    });
    container.innerHTML = html;
  }

  function renderInput() {
    var input = document.getElementById('recognizer-text-input');
    if (!input || input === document.activeElement) return; // don't overwrite while typing
    var names = state.notes.map(function (s) { return M.noteName(s); });
    input.value = names.join(' ');
  }

  function renderResult() {
    var container = document.getElementById('recognizer-result');
    if (!container) return;

    if (state.notes.length === 0) {
      container.innerHTML = '<p class="recognizer-prompt">Click notes or type them above</p>';
      return;
    }

    if (state.notes.length === 1) {
      container.innerHTML = '<div class="recognizer-chord-name">' +
        M.esc(M.noteName(state.notes[0])) + '</div>' +
        '<p class="recognizer-prompt">Add more notes to identify a chord</p>';
      return;
    }

    var detected = detectChord();

    if (detected.length === 0) {
      var noteNames = state.notes.map(function (s) { return M.noteName(s); });
      container.innerHTML = '<div class="recognizer-chord-name">?</div>' +
        '<p class="recognizer-prompt">No chord recognized for ' +
        M.esc(noteNames.join(' ')) + '</p>';
      return;
    }

    var primary = detected[0];
    var label = inversionLabel(primary);
    var detail = chordDetail(primary);

    var html = '<div class="recognizer-chord-name">' + M.esc(primary);
    if (label) {
      html += '<span class="recognizer-inversion">(' + M.esc(label) + ')</span>';
    }
    html += '</div>';

    if (detected.length > 1) {
      var alts = detected.slice(1).map(function (c) { return M.esc(c); });
      html += '<div class="recognizer-alternatives">Also: ' + alts.join(', ') + '</div>';
    }

    if (detail) {
      html += '<div class="recognizer-details">';
      html += '<div><strong>Notes:</strong> ' + M.esc(detail.notes.join(' ')) + '</div>';
      html += '<div><strong>Intervals:</strong> ' + M.esc(detail.intervals.join(' ')) + '</div>';
      html += '<div><strong>Semitones:</strong> ' + M.esc(detail.semitones.join('\u2013')) + '</div>';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function renderStaff() {
    var container = document.getElementById('recognizer-staff');
    if (!container) return;

    if (state.notes.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Compute note positions — place notes starting at octave 4,
    // bumping up to octave 5 when needed to keep ascending order
    var notes = [];
    state.notes.forEach(function (semitone, i) {
      var info = SEMITONE_TO_STAFF[semitone];
      var step = LETTER_STEP[info.letter];
      var octave = 4;
      // Bump octave if this note's step would be below the previous note
      if (i > 0 && step + (octave - 4) * 7 < notes[i - 1].step) {
        octave = 5;
      }
      var finalStep = step + (octave - 4) * 7;
      notes.push({
        letter: info.letter,
        acc: info.acc,
        step: finalStep
      });
    });

    // SVG layout
    var lineSpacing = 10;
    var bottomLineY = 60;
    var leftMargin = 40;
    var noteSpacing = 50;
    var rightPad = 20;
    var svgWidth = leftMargin + notes.length * noteSpacing + rightPad;
    var svgHeight = 90;

    var svg = '<svg class="recognizer-staff-svg" viewBox="0 0 ' + svgWidth + ' ' + svgHeight +
              '" xmlns="http://www.w3.org/2000/svg">';

    // 5 staff lines
    var staffLineSteps = [0, 2, 4, 6, 8];
    for (var li = 0; li < 5; li++) {
      var ly = bottomLineY - staffLineSteps[li] * (lineSpacing / 2);
      svg += '<line class="recognizer-staff-line" x1="' + (leftMargin - 5) + '" y1="' + ly +
             '" x2="' + (svgWidth - rightPad + 5) + '" y2="' + ly + '"/>';
    }

    // Treble clef
    svg += '<text class="recognizer-staff-clef" x="5" y="' + (bottomLineY - 2 * lineSpacing + 8) +
           '" font-family="serif, \'Noto Music\', \'Segoe UI Symbol\'" font-size="38">\uD834\uDD1E</text>';

    // Draw notes
    notes.forEach(function (n, i) {
      var x = leftMargin + (i + 0.5) * noteSpacing;
      var y = bottomLineY - n.step * (lineSpacing / 2);

      // Ledger lines below staff
      if (n.step < 0) {
        for (var ls = -2; ls >= n.step; ls -= 2) {
          var lly = bottomLineY - ls * (lineSpacing / 2);
          svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly +
                 '" x2="' + (x + 10) + '" y2="' + lly + '"/>';
        }
      }
      // Ledger lines above staff
      if (n.step > 8) {
        for (var ls2 = 10; ls2 <= n.step; ls2 += 2) {
          var lly2 = bottomLineY - ls2 * (lineSpacing / 2);
          svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly2 +
                 '" x2="' + (x + 10) + '" y2="' + lly2 + '"/>';
        }
      }

      // Accidental
      if (n.acc) {
        svg += '<text class="recognizer-staff-accidental" x="' + (x - 14) + '" y="' + (y + 4) +
               '" text-anchor="end">' + n.acc + '</text>';
      }

      // Notehead (tilted ellipse)
      svg += '<ellipse class="recognizer-staff-notehead" cx="' + x + '" cy="' + y +
             '" rx="6" ry="4.5" transform="rotate(-15 ' + x + ' ' + y + ')"/>';
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function render() {
    renderNoteButtons();
    renderInput();
    renderResult();
    renderStaff();
  }

  // ── Event handling ──

  function init() {
    // Note button clicks (delegated)
    var btnContainer = document.getElementById('recognizer-note-buttons');
    if (btnContainer) {
      btnContainer.addEventListener('click', function (e) {
        var btn = e.target.closest('.recognizer-note-btn');
        if (!btn) return;
        var semitone = parseInt(btn.getAttribute('data-semitone'), 10);
        toggleNote(semitone);
        render();
      });
    }

    // Text input
    var textInput = document.getElementById('recognizer-text-input');
    if (textInput) {
      textInput.addEventListener('input', function () {
        state.notes = M.parseNoteInput(textInput.value);
        renderNoteButtons();
        renderResult();
        renderStaff();
      });
    }

    // Clear button
    var clearBtn = document.getElementById('recognizer-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.notes = [];
        render();
      });
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
