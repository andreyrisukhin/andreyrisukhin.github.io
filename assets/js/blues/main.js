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
    var toggleGroup = document.querySelector('.blues-toggle-group');
    if (toggleGroup) {
      toggleGroup.addEventListener('click', function (e) {
        var btn = e.target.closest('.blues-toggle-btn');
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
