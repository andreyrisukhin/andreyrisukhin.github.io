// Shared music utilities, loaded before tool-specific scripts
window.Music = (function () {
  "use strict";

  var NOTES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

  function noteName(semitone) {
    return NOTES[((semitone % 12) + 12) % 12];
  }

  function chordName(root, suffix) {
    return noteName(root) + suffix;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // Render a 12-button key bar into a container, call onSelect(key) on click
  function renderKeyBar(containerId, activeKey, onSelect) {
    var bar = document.getElementById(containerId);
    if (!bar) return;
    var html = "";
    NOTES.forEach(function (n, i) {
      var cls = "music-key-btn";
      if (i === activeKey) cls += " is-active";
      html += '<button class="' + cls + '" data-key="' + i + '">' + esc(n) + "</button>";
    });
    bar.innerHTML = html;

    bar.addEventListener("click", function handler(e) {
      var btn = e.target.closest(".music-key-btn");
      if (!btn) return;
      var key = parseInt(btn.getAttribute("data-key"), 10);
      onSelect(key);
    });
  }

  // Share string codec: "prefix:id@key,id@key,..." <-> [{id, key}, ...]
  function encodeEntries(prefix, entries) {
    var parts = entries.map(function (e) {
      return e.id + "@" + e.key;
    });
    return prefix + ":" + parts.join(",");
  }

  function decodeEntries(str, validIds) {
    str = (str || "").trim();
    var colonIdx = str.indexOf(":");
    if (colonIdx === -1) return null;
    var prefix = parseInt(str.substring(0, colonIdx), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 11) return null;
    var rest = str.substring(colonIdx + 1);
    var entries = [];
    if (rest.length > 0) {
      var tokens = rest.split(",");
      for (var i = 0; i < tokens.length; i++) {
        var atIdx = tokens[i].lastIndexOf("@");
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
    7: "7",
    m7: "m7",
    "\u00B07": "dim7",
    "": "M",
    m: "m",
    maj7: "maj7",
    dim: "dim",
    aug: "aug",
    m7b5: "m7b5",
    "+": "aug",
    "+7": "7#5",
    "\u00F87": "m7b5",
    "maj7\u266F5": "maj7#5",
    "7\u266D5": "7b5",
    "7\u266D9": "7b9",
    "7\u266F9": "7#9",
    "7\u266F11": "7#11",
    "7\u266D13": "7b13",
    maj6: "6",
    m6: "m6",
    sus4: "sus4",
    sus2: "sus2",
    "7sus4": "7sus4",
    "7sus2": "7sus2",
    maj7sus4: "maj7sus4",
    "9sus4": "9sus4",
    "maj7 (inv)": "maj7",
    "7 (no 5)": "7",
    "\u00B07 (no \u266D5)": "dim7",
    "m\u266F5": "m#5",
    "m(Maj9)": "mMaj7",
    maj9: "maj9",
    m9: "m9",
    add9: "add9",
    9: "9",
    11: "11",
    13: "13",
    "9(11)": "11",
    " tritone": "dim",
  };

  // Convert Unicode accidentals to ASCII for Tonal input
  function toAscii(name) {
    return name.replace(/\u266D/g, "b").replace(/\u266F/g, "#");
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

    if (qual === "P" || qual === "M") return "" + num;
    if (qual === "m") return "\u266D" + num; // minor → flat
    if (qual === "A") return "\u266F" + num; // augmented → sharp
    if (qual === "d") {
      // diminished: flat for perfect intervals, double-flat for major intervals
      return isPerfect ? "\u266D" + num : "\uD834\uDD2B" + num;
    }
    if (qual === "dd") return "\uD834\uDD2B" + num; // doubly diminished → double-flat
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
      notes: semitones.map(function (s) {
        return noteName(rootSemitone + s);
      }),
      intervals: chord.intervals.map(formatInterval),
      semitones: semitones,
    };
  }

  // Convert semitone to ASCII note name for Tonal (e.g. 3 → "Eb")
  function asciiNoteName(semitone) {
    return toAscii(noteName(semitone));
  }

  // Parse space-separated note names into array of semitone values
  // Accepts Unicode (E♭) and ASCII (Eb) accidentals
  // Returns [] for empty/invalid input
  function parseNoteInput(str) {
    if (!str || !str.trim()) return [];
    var tokens = str.trim().split(/\s+/);
    var result = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      // Capitalize first letter, keep rest
      tok = tok.charAt(0).toUpperCase() + tok.slice(1);
      // Normalize ASCII accidentals after the letter: Eb→E♭, F#→F♯
      tok = tok.replace(/b$/, "\u266D").replace(/#$/, "\u266F");
      var idx = NOTES.indexOf(tok);
      // Handle enharmonic equivalents not in NOTES (e.g. D♯→E♭, G♭→F♯)
      if (idx === -1 && tok.length === 2) {
        var natural = NOTES.indexOf(tok.charAt(0));
        if (natural !== -1) {
          var acc = tok.charAt(1);
          if (acc === "\u266F") idx = (natural + 1) % 12; // sharp = +1
          else if (acc === "\u266D") idx = (natural + 11) % 12; // flat  = -1
        }
      }
      if (idx === -1) continue; // skip unrecognized tokens
      result.push(idx);
    }
    return result;
  }

  // Parse a note name (e.g. "C", "Db", "F#") to semitone index, or -1
  function parseNote(str) {
    var tok = str.charAt(0).toUpperCase() + str.slice(1);
    tok = tok.replace(/b$/, "\u266D").replace(/#$/, "\u266F");
    var idx = NOTES.indexOf(tok);
    if (idx === -1 && tok.length === 2) {
      var natural = NOTES.indexOf(tok.charAt(0));
      if (natural !== -1) {
        var acc = tok.charAt(1);
        if (acc === "\u266F") idx = (natural + 1) % 12;
        else if (acc === "\u266D") idx = (natural + 11) % 12;
      }
    }
    return idx;
  }

  // Parse a Stradella recipe string like "Fd7/C" or "CM + Gm/D"
  // Returns array of semitone values, or null if not a valid recipe
  function parseRecipeInput(str) {
    if (!str || !window.StradellaData) return null;
    str = str.trim();
    // Must contain "/" for bass note
    var slashIdx = str.lastIndexOf("/");
    if (slashIdx === -1) return null;

    var partsStr = str.substring(0, slashIdx).trim();
    var bassStr = str.substring(slashIdx + 1).trim();
    var bassSemitone = parseNote(bassStr);
    if (bassSemitone === -1) return null;

    var BUTTONS = window.StradellaData.BUTTONS;
    var quals = { M: "M", m: "m", 7: "7", d7: "d7" };
    var notes = new Set();
    notes.add(bassSemitone);

    // Split on "+" to get individual button presses
    var parts = partsStr.split("+");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      // Parse: NoteName + Qual (e.g. "Fd7", "CM", "Bbm", "G7")
      // Note name is 1-2 chars (letter + optional accidental), qual is the rest
      var noteEnd = 1;
      if (p.length > 1 && (p[1] === "b" || p[1] === "#") && p[1] !== undefined) {
        // Check it's an accidental, not a qual like "m"
        // "b" is accidental only if followed by more chars or nothing... tricky
        // Heuristic: if char at [1] is b/# and char at [2] exists and is not empty, it could be accidental
        // Eb7, Bbm, F#d7: accidental if the remaining after [0:2] is a valid qual
        var possibleQual = p.substring(2);
        if (quals[possibleQual] !== undefined || possibleQual === "") {
          noteEnd = 2;
        }
      }
      var notePart = p.substring(0, noteEnd);
      var qualPart = p.substring(noteEnd);
      if (!qualPart) return null; // need a qual
      if (!quals[qualPart]) return null;
      var noteSemitone = parseNote(notePart);
      if (noteSemitone === -1) return null;
      var offsets = BUTTONS[qualPart];
      if (!offsets) return null;
      for (var j = 0; j < offsets.length; j++) {
        notes.add((noteSemitone + offsets[j]) % 12);
      }
    }

    if (notes.size < 2) return null;
    // Convert Set to sorted array
    var result = [];
    notes.forEach(function (n) {
      result.push(n);
    });
    result.sort(function (a, b) {
      return a - b;
    });
    return result;
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
    chordInfo: chordInfo,
    asciiNoteName: asciiNoteName,
    parseNoteInput: parseNoteInput,
    parseNote: parseNote,
    parseRecipeInput: parseRecipeInput,
  };
})();
