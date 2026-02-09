// 12-Bar Blues Jam Helper
(function () {
  'use strict';

  var M = window.Music;

  var BLUES_SCALE = [0, 3, 5, 6, 7, 10]; // 1, b3, 4, b5, 5, b7
  var BLUE_NOTE_INDEX = 3; // b5 is at position 3 in the scale array

  // Each progression is 12 bars: { deg: semitone offset, suf: chord suffix, roman: roman numeral label }
  var PROGRESSIONS = {
    standard: [
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 7, suf: '7', roman: 'V7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 7, suf: '7', roman: 'V7' },
    ],
    quickChange: [
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 7, suf: '7', roman: 'V7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 7, suf: '7', roman: 'V7' },
    ],
    jazz: [
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 5, suf: '7', roman: 'IV7' },
      { deg: 6, suf: '\u00B07', roman: '#IV\u00B07' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 9, suf: '7', roman: 'VI7' },
      { deg: 2, suf: 'm7', roman: 'ii\u20137' },
      { deg: 7, suf: '7', roman: 'V7' },
      { deg: 0, suf: '7', roman: 'I7' },
      { deg: 7, suf: '7', roman: 'V7' },
    ],
  };

  // Blues suffix → stradella chord ID mapping
  var BLUES_TO_STRADELLA = {
    '7': '7',
    'm7': 'm7',
    '\u00B07': 'dim7',
  };

  var state = {
    root: 0,
    variant: 'standard',
    show: { degree: true, notes: false, intervals: false, semitones: false }
  };

  function renderGrid() {
    var grid = document.getElementById('blues-grid');
    grid.innerHTML = '';
    var bars = PROGRESSIONS[state.variant];

    bars.forEach(function (bar) {
      var cell = document.createElement('div');
      cell.className = 'blues-cell';

      var chord = document.createElement('div');
      chord.className = 'blues-chord';
      chord.textContent = M.chordName(bar.deg + state.root, bar.suf);
      cell.appendChild(chord);

      if (state.show.degree) {
        var degree = document.createElement('div');
        degree.className = 'blues-detail blues-degree';
        degree.textContent = bar.roman;
        cell.appendChild(degree);
      }

      var info = M.chordInfo(bar.deg + state.root, bar.suf);
      if (info) {
        if (state.show.notes) {
          var notes = document.createElement('div');
          notes.className = 'blues-detail blues-notes';
          notes.textContent = info.notes.join(' ');
          cell.appendChild(notes);
        }
        if (state.show.intervals) {
          var intervals = document.createElement('div');
          intervals.className = 'blues-detail blues-intervals';
          intervals.textContent = info.intervals.join(' ');
          cell.appendChild(intervals);
        }
        if (state.show.semitones) {
          var semitones = document.createElement('div');
          semitones.className = 'blues-detail blues-semitones';
          semitones.textContent = info.semitones.join('\u2013');
          cell.appendChild(semitones);
        }
      }

      grid.appendChild(cell);
    });
  }

  function renderScale() {
    var container = document.getElementById('blues-scale-notes');
    container.innerHTML = '';

    BLUES_SCALE.forEach(function (interval, i) {
      var pill = document.createElement('span');
      pill.className = 'blues-note';
      if (i === BLUE_NOTE_INDEX) pill.classList.add('blues-note--blue');
      pill.textContent = M.noteName(interval + state.root);
      container.appendChild(pill);
    });
  }

  // ── SVG staff rendering ──

  // Map note letter to staff step relative to E4 (bottom line = 0)
  // C=−2, D=−1, E=0, F=1, G=2, A=3, B=4
  var LETTER_STEP = { C: -2, D: -1, E: 0, F: 1, G: 2, A: 3, B: 4 };

  // Blues scale semitone offsets mapped to note info for staff rendering
  // Returns { letter, accidental, step } for a given semitone (0–11)
  var SEMITONE_TO_STAFF = [
    { letter: 'C', acc: '' },   // 0
    { letter: 'D', acc: '\u266D' }, // 1  Db
    { letter: 'D', acc: '' },   // 2
    { letter: 'E', acc: '\u266D' }, // 3  Eb
    { letter: 'E', acc: '' },   // 4
    { letter: 'F', acc: '' },   // 5
    { letter: 'F', acc: '\u266F' }, // 6  F#
    { letter: 'G', acc: '' },   // 7
    { letter: 'A', acc: '\u266D' }, // 8  Ab
    { letter: 'A', acc: '' },   // 9
    { letter: 'B', acc: '\u266D' }, // 10  Bb
    { letter: 'B', acc: '' }    // 11
  ];

  function renderScaleStaff() {
    var container = document.getElementById('blues-scale-staff');
    if (!container) return;

    // Compute note positions
    var notes = [];
    BLUES_SCALE.forEach(function (interval, i) {
      var semitone = (interval + state.root) % 12;
      var info = SEMITONE_TO_STAFF[semitone];
      var step = LETTER_STEP[info.letter];
      // If this note's absolute semitone is lower than previous, bump to octave 5
      var absSemitone = interval + state.root;
      var octave = 4;
      if (absSemitone >= 12) octave = 5;
      // Also bump if step would go below previous note's step (wrapping)
      if (i > 0 && step + (octave - 4) * 7 < notes[i - 1].step) {
        octave = 5;
      }
      var finalStep = step + (octave - 4) * 7;
      notes.push({
        letter: info.letter,
        acc: info.acc,
        step: finalStep,
        isBlue: i === BLUE_NOTE_INDEX
      });
    });

    // SVG layout
    var lineSpacing = 10;          // pixels between staff lines
    var bottomLineY = 60;          // Y of bottom line (E4, step 0)
    var leftMargin = 40;           // space for clef
    var noteSpacing = 50;          // horizontal space between notes
    var rightPad = 20;
    var svgWidth = leftMargin + notes.length * noteSpacing + rightPad;
    var svgHeight = 90;

    var svg = '<svg class="blues-staff-svg" viewBox="0 0 ' + svgWidth + ' ' + svgHeight +
              '" xmlns="http://www.w3.org/2000/svg">';

    // 5 staff lines: E4(0), G4(2), B4(4), D5(6), F5(8)
    var staffLineSteps = [0, 2, 4, 6, 8];
    for (var li = 0; li < 5; li++) {
      var ly = bottomLineY - staffLineSteps[li] * (lineSpacing / 2);
      svg += '<line class="blues-staff-line" x1="' + (leftMargin - 5) + '" y1="' + ly +
             '" x2="' + (svgWidth - rightPad + 5) + '" y2="' + ly + '"/>';
    }

    // Treble clef
    svg += '<text class="blues-staff-clef" x="5" y="' + (bottomLineY - 2 * lineSpacing + 8) +
           '" font-family="serif, \'Noto Music\', \'Segoe UI Symbol\'" font-size="38">\uD834\uDD1E</text>';

    // Draw notes
    notes.forEach(function (n, i) {
      var x = leftMargin + (i + 0.5) * noteSpacing;
      var y = bottomLineY - n.step * (lineSpacing / 2);

      // Ledger lines for notes below staff (step < 0) or above (step > 8)
      if (n.step < 0) {
        for (var ls = -2; ls >= n.step; ls -= 2) {
          var lly = bottomLineY - ls * (lineSpacing / 2);
          svg += '<line class="blues-staff-ledger" x1="' + (x - 10) + '" y1="' + lly +
                 '" x2="' + (x + 10) + '" y2="' + lly + '"/>';
        }
      }
      if (n.step > 8) {
        for (var ls2 = 10; ls2 <= n.step; ls2 += 2) {
          var lly2 = bottomLineY - ls2 * (lineSpacing / 2);
          svg += '<line class="blues-staff-ledger" x1="' + (x - 10) + '" y1="' + lly2 +
                 '" x2="' + (x + 10) + '" y2="' + lly2 + '"/>';
        }
      }

      // Accidental
      if (n.acc) {
        svg += '<text class="blues-staff-accidental" x="' + (x - 14) + '" y="' + (y + 4) +
               '" text-anchor="end">' + n.acc + '</text>';
      }

      // Notehead (tilted ellipse)
      var headClass = n.isBlue ? 'blues-staff-notehead blues-staff-notehead--blue' : 'blues-staff-notehead';
      svg += '<ellipse class="' + headClass + '" cx="' + x + '" cy="' + y +
             '" rx="6" ry="4.5" transform="rotate(-15 ' + x + ' ' + y + ')"/>';
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderKeyBar() {
    var bar = document.getElementById('blues-key-bar');
    if (!bar) return;
    var html = '';
    M.NOTES.forEach(function (n, i) {
      var cls = 'music-key-btn';
      if (i === state.root) cls += ' is-active';
      html += '<button class="' + cls + '" data-key="' + i + '">' + M.esc(n) + '</button>';
    });
    bar.innerHTML = html;
  }

  function renderShareBox() {
    var el = document.getElementById('blues-share-text');
    if (!el) return;
    var bars = PROGRESSIONS[state.variant];
    // Collect unique {suf, absoluteKey} pairs
    var seen = {};
    var entries = [];
    bars.forEach(function (bar) {
      var absKey = (bar.deg + state.root) % 12;
      var stradellaId = BLUES_TO_STRADELLA[bar.suf];
      if (!stradellaId) return;
      var k = stradellaId + '@' + absKey;
      if (seen[k]) return;
      seen[k] = true;
      entries.push({ id: stradellaId, key: absKey });
    });
    el.value = M.encodeEntries(state.root, entries);
  }

  function render() {
    renderKeyBar();
    renderGrid();
    renderScale();
    renderScaleStaff();
    renderShareBox();
  }

  function init() {
    // Key bar click (delegated)
    var keyBar = document.getElementById('blues-key-bar');
    if (keyBar) {
      keyBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.music-key-btn');
        if (!btn) return;
        state.root = parseInt(btn.getAttribute('data-key'), 10);
        render();
      });
    }

    // Variant buttons
    document.querySelectorAll('.blues-variant-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.blues-variant-btn').forEach(function (b) {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        state.variant = btn.dataset.variant;
        render();
      });
    });

    // Toggle buttons (multi-select)
    var toggleGroup = document.getElementById('blues-toggle-group');
    if (toggleGroup) {
      toggleGroup.addEventListener('click', function (e) {
        var btn = e.target.closest('.music-toggle-btn');
        if (!btn) return;
        var layer = btn.dataset.layer;
        if (!state.show.hasOwnProperty(layer)) return;
        state.show[layer] = !state.show[layer];
        btn.classList.toggle('is-active', state.show[layer]);
        renderGrid();
      });
    }

    // Copy for Stradella button
    var copyBtn = document.getElementById('blues-stradella-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var el = document.getElementById('blues-share-text');
        if (!el) return;
        el.select();
        navigator.clipboard.writeText(el.value).then(function () {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy for Stradella'; }, 1500);
        });
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
