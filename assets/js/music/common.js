// Shared music utilities — loaded before tool-specific scripts
window.Music = (function () {
  'use strict';

  var NOTES = ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];

  function noteName(semitone) {
    return NOTES[((semitone % 12) + 12) % 12];
  }

  function chordName(root, suffix) {
    return noteName(root) + suffix;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Render a 12-button key bar into a container, call onSelect(key) on click
  function renderKeyBar(containerId, activeKey, onSelect) {
    var bar = document.getElementById(containerId);
    if (!bar) return;
    var html = '';
    NOTES.forEach(function (n, i) {
      var cls = 'music-key-btn';
      if (i === activeKey) cls += ' is-active';
      html += '<button class="' + cls + '" data-key="' + i + '">' + esc(n) + '</button>';
    });
    bar.innerHTML = html;

    bar.addEventListener('click', function handler(e) {
      var btn = e.target.closest('.music-key-btn');
      if (!btn) return;
      var key = parseInt(btn.getAttribute('data-key'), 10);
      onSelect(key);
    });
  }

  // Share string codec: "prefix:id@key,id@key,..." <-> [{id, key}, ...]
  function encodeEntries(prefix, entries) {
    var parts = entries.map(function (e) {
      return e.id + '@' + e.key;
    });
    return prefix + ':' + parts.join(',');
  }

  function decodeEntries(str, validIds) {
    str = (str || '').trim();
    var colonIdx = str.indexOf(':');
    if (colonIdx === -1) return null;
    var prefix = parseInt(str.substring(0, colonIdx), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 11) return null;
    var rest = str.substring(colonIdx + 1);
    var entries = [];
    if (rest.length > 0) {
      var tokens = rest.split(',');
      for (var i = 0; i < tokens.length; i++) {
        var atIdx = tokens[i].lastIndexOf('@');
        if (atIdx === -1) return null;
        var id = tokens[i].substring(0, atIdx);
        var key = parseInt(tokens[i].substring(atIdx + 1), 10);
        if (!validIds[id] || isNaN(key) || key < 0 || key > 11) return null;
        entries.push({ id: id, key: key });
      }
    }
    return { prefix: prefix, entries: entries };
  }

  // --- Chord detail helpers (require Tonal.js) ---

  // Map display suffixes to Tonal's chord-type strings
  var SUFFIX_TO_TONAL = {
    '7': '7', 'm7': 'm7', '\u00B07': 'dim7',
    '': 'M', 'm': 'm', 'maj7': 'maj7',
    'dim': 'dim', 'aug': 'aug', 'm7b5': 'm7b5',
    '+': 'aug', '+7': '7#5', '\u00F87': 'm7b5',
    'maj7\u266F5': 'maj7#5', '7\u266D5': '7b5',
    '7\u266D9': '7b9', '7\u266F9': '7#9',
    '7\u266F11': '7#11', '7\u266D13': '7b13',
    'maj6': '6', '9sus4': '9sus4'
  };

  // Convert Unicode accidentals to ASCII for Tonal input
  function toAscii(name) {
    return name.replace(/\u266D/g, 'b').replace(/\u266F/g, '#');
  }

  // Intervals where the "natural" form is perfect (unison, 4th, 5th, octave)
  var PERFECT_INTERVALS = { 1: true, 4: true, 5: true, 8: true };

  // Convert Tonal interval string (e.g. "3M", "7m") to display format ("3", "b7")
  function formatInterval(iv) {
    var m = iv.match(/^(\d+)(.+)$/);
    if (!m) return iv;
    var num = parseInt(m[1], 10);
    var qual = m[2];
    var isPerfect = PERFECT_INTERVALS[num];

    if (qual === 'P' || qual === 'M') return '' + num;
    if (qual === 'm') return '\u266D' + num;              // minor → flat
    if (qual === 'A') return '\u266F' + num;              // augmented → sharp
    if (qual === 'd') {
      // diminished: flat for perfect intervals, double-flat for major intervals
      return isPerfect ? '\u266D' + num : '\uD834\uDD2B' + num;
    }
    if (qual === 'dd') return '\uD834\uDD2B' + num;      // doubly diminished → double-flat
    return iv; // fallback
  }

  // Get chord info: notes, intervals, semitone offsets
  // Returns { notes: [...], intervals: [...], semitones: [...] } or null
  function chordInfo(rootSemitone, suffix) {
    if (!window.Tonal) return null;
    var tonalSuffix = SUFFIX_TO_TONAL[suffix];
    if (tonalSuffix === undefined) tonalSuffix = toAscii(suffix);
    var asciiRoot = toAscii(noteName(rootSemitone));
    var chord = Tonal.Chord.get(asciiRoot + tonalSuffix);
    if (chord.empty) return null;
    var semitones = chord.intervals.map(function (iv) {
      return Tonal.Interval.semitones(iv);
    });
    return {
      notes: semitones.map(function (s) { return noteName(rootSemitone + s); }),
      intervals: chord.intervals.map(formatInterval),
      semitones: semitones
    };
  }

  return {
    NOTES: NOTES,
    noteName: noteName,
    chordName: chordName,
    esc: esc,
    renderKeyBar: renderKeyBar,
    encodeEntries: encodeEntries,
    decodeEntries: decodeEntries,
    SUFFIX_TO_TONAL: SUFFIX_TO_TONAL,
    toAscii: toAscii,
    formatInterval: formatInterval,
    chordInfo: chordInfo
  };
})();
