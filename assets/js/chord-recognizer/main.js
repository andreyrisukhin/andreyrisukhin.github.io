// Chord Recognizer Tool
(function () {
  "use strict";

  var M = window.Music;

  // ── Staff rendering data (shared with blues) ──

  var LETTER_STEP = { C: -2, D: -1, E: 0, F: 1, G: 2, A: 3, B: 4 };

  var SEMITONE_TO_STAFF = [
    { letter: "C", acc: "" },
    { letter: "D", acc: "\u266D" },
    { letter: "D", acc: "" },
    { letter: "E", acc: "\u266D" },
    { letter: "E", acc: "" },
    { letter: "F", acc: "" },
    { letter: "F", acc: "\u266F" },
    { letter: "G", acc: "" },
    { letter: "A", acc: "\u266D" },
    { letter: "A", acc: "" },
    { letter: "B", acc: "\u266D" },
    { letter: "B", acc: "" },
  ];

  // ── State ──

  var state = {
    notes: [], // ordered array of semitone values (0–11)
  };

  // ── Note management ──

  function appendNote(semitone) {
    state.notes.push(semitone);
  }

  function removeLastNote() {
    state.notes.pop();
  }

  // ── Chord detection ──

  function detectChord() {
    if (state.notes.length < 2 || !window.Tonal) return [];
    var unique = uniqueNotes();
    if (unique.length < 2) return [];
    var names = unique.map(function (s) {
      return M.asciiNoteName(s);
    });
    return Tonal.Chord.detect(names);
  }

  // Return unique pitch classes from state.notes, preserving first-occurrence order
  function uniqueNotes() {
    var seen = {};
    var unique = [];
    for (var i = 0; i < state.notes.length; i++) {
      if (!seen[state.notes[i]]) {
        seen[state.notes[i]] = true;
        unique.push(state.notes[i]);
      }
    }
    return unique;
  }

  // Find recognized chords from (n-1)-note subsets when full set is unrecognized
  // Returns array of { removed: noteName, chords: [...] }
  function detectSubsets() {
    if (!window.Tonal) return [];
    var unique = uniqueNotes();
    if (unique.length < 3) return [];
    var results = [];
    var seenChords = {};
    for (var i = 0; i < unique.length; i++) {
      var subset = unique.filter(function (_, j) {
        return j !== i;
      });
      var names = subset.map(function (s) {
        return M.asciiNoteName(s);
      });
      var detected = Tonal.Chord.detect(names);
      if (detected.length > 0) {
        // Deduplicate across subsets, only show first occurrence of each chord
        var novel = detected.filter(function (c) {
          return !seenChords[c];
        });
        novel.forEach(function (c) {
          seenChords[c] = true;
        });
        if (novel.length > 0) {
          results.push({ removed: M.noteName(unique[i]), chords: novel });
        }
      }
    }
    return results;
  }

  // Determine inversion label from a chord name like "C/E"
  function inversionLabel(chordName) {
    if (!window.Tonal) return "";
    var parts = chordName.split("/");
    if (parts.length < 2) return "Root position";

    var bass = parts[parts.length - 1];
    var rootChord = parts.slice(0, parts.length - 1).join("/");
    var chord = Tonal.Chord.get(rootChord);
    if (chord.empty || !chord.notes) return "";

    // Find bass in chord notes
    var bassChroma = Tonal.Note.chroma(bass);
    for (var i = 0; i < chord.notes.length; i++) {
      if (Tonal.Note.chroma(chord.notes[i]) === bassChroma) {
        var labels = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"];
        return labels[i] || i + "th inversion";
      }
    }
    return "Bass: " + bass;
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
      semitones: semitones,
    };
  }

  // ── Stradella recipe display ──

  // Shared renderer lives in assets/js/music/stradella-recipe.js, but the
  // recognizer's existing CSS targets .recognizer-stradella* class names,
  // so we wrap and rewrite class hooks rather than restyle.
  function renderStradellaInfo(chordName) {
    if (!window.StradellaRecipe) return "";
    var html = window.StradellaRecipe.render(chordName);
    if (!html) return "";
    return html
      .replace(/class="stradella-recipe"/g, 'class="recognizer-stradella"')
      .replace(/class="stradella-recipe__item/g, 'class="recognizer-stradella-item')
      .replace(/class="stradella-recipe__voicing"/g, 'class="recognizer-stradella-recipe"')
      .replace(/class="stradella-recipe__note"/g, 'class="recognizer-stradella-note"')
      .replace(/class="stradella-recipe__warn"/g, 'class="recognizer-stradella-warn"');
  }

  // ── Rendering ──

  function renderNoteButtons() {
    var container = document.getElementById("recognizer-note-buttons");
    if (!container) return;

    // Build map: semitone -> [1-based positions]
    var positions = {};
    for (var j = 0; j < state.notes.length; j++) {
      var s = state.notes[j];
      if (!positions[s]) positions[s] = [];
      positions[s].push(j + 1);
    }

    var html = "";
    M.NOTES.forEach(function (n, i) {
      var isActive = positions[i] && positions[i].length > 0;
      var cls = "recognizer-note-btn";
      if (isActive) cls += " is-active";
      html += '<button class="' + cls + '" data-semitone="' + i + '">';
      if (isActive) {
        html += '<span class="recognizer-order">' + positions[i].join(",") + "</span>";
      }
      html += M.esc(n) + "</button>";
    });
    container.innerHTML = html;
  }

  function renderInput() {
    var input = document.getElementById("recognizer-text-input");
    if (!input || input === document.activeElement) return; // don't overwrite while typing
    var names = state.notes.map(function (s) {
      return M.noteName(s);
    });
    input.value = names.join(" ");
  }

  function renderResult() {
    var container = document.getElementById("recognizer-result");
    if (!container) return;

    if (state.notes.length === 0) {
      container.innerHTML = '<p class="recognizer-prompt">Click notes or type them above</p>';
      return;
    }

    if (state.notes.length === 1) {
      container.innerHTML =
        '<div class="recognizer-chord-name">' +
        M.esc(M.noteName(state.notes[0])) +
        "</div>" +
        '<p class="recognizer-prompt">Add more notes to identify a chord</p>';
      return;
    }

    var detected = detectChord();

    if (detected.length === 0) {
      var noteNames = state.notes.map(function (s) {
        return M.noteName(s);
      });
      var html =
        '<div class="recognizer-chord-name">?</div>' + '<p class="recognizer-prompt">No chord recognized for ' + M.esc(noteNames.join(" ")) + "</p>";

      var subsets = detectSubsets();
      if (subsets.length > 0) {
        html += '<div class="recognizer-subsets"><strong>Subsets recognized:</strong>';
        for (var si = 0; si < subsets.length; si++) {
          html +=
            '<div class="recognizer-subset-row">' +
            M.esc(subsets[si].chords.join(", ")) +
            '<span class="recognizer-subset-note"> (without ' +
            M.esc(subsets[si].removed) +
            ")</span></div>";
        }
        html += "</div>";
      }

      container.innerHTML = html;
      return;
    }

    var primary = detected[0];
    var label = inversionLabel(primary);
    var detail = chordDetail(primary);

    var html = '<div class="recognizer-chord-name">' + M.esc(primary);
    if (label) {
      html += '<span class="recognizer-inversion">(' + M.esc(label) + ")</span>";
    }
    html += "</div>";

    if (detected.length > 1) {
      var alts = detected.slice(1).map(function (c) {
        return M.esc(c);
      });
      html += '<div class="recognizer-alternatives">Also: ' + alts.join(", ") + "</div>";
    }

    if (detail) {
      html += '<div class="recognizer-details">';
      html += "<div><strong>Notes:</strong> " + M.esc(detail.notes.join(" ")) + "</div>";
      html += "<div><strong>Intervals:</strong> " + M.esc(detail.intervals.join(" ")) + "</div>";
      html += "<div><strong>Semitones:</strong> " + M.esc(detail.semitones.join("\u2013")) + "</div>";
      html += "</div>";
    }

    // Stradella recipe info (if stradella-data.js is loaded)
    if (window.StradellaData) {
      var recipeHtml = renderStradellaInfo(primary);
      if (recipeHtml) html += recipeHtml;
    }

    container.innerHTML = html;
  }

  function renderStaff() {
    var container = document.getElementById("recognizer-staff");
    if (!container) return;

    if (state.notes.length === 0) {
      container.innerHTML = "";
      return;
    }

    // Compute note positions, place notes starting at octave 4,
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
        step: finalStep,
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

    var svg = '<svg class="recognizer-staff-svg" viewBox="0 0 ' + svgWidth + " " + svgHeight + '" xmlns="http://www.w3.org/2000/svg">';

    // 5 staff lines
    var staffLineSteps = [0, 2, 4, 6, 8];
    for (var li = 0; li < 5; li++) {
      var ly = bottomLineY - staffLineSteps[li] * (lineSpacing / 2);
      svg +=
        '<line class="recognizer-staff-line" x1="' + (leftMargin - 5) + '" y1="' + ly + '" x2="' + (svgWidth - rightPad + 5) + '" y2="' + ly + '"/>';
    }

    // Treble clef
    svg +=
      '<text class="recognizer-staff-clef" x="5" y="' +
      (bottomLineY - 2 * lineSpacing + 8) +
      '" font-family="serif, \'Noto Music\', \'Segoe UI Symbol\'" font-size="38">\uD834\uDD1E</text>';

    // Draw notes
    notes.forEach(function (n, i) {
      var x = leftMargin + (i + 0.5) * noteSpacing;
      var y = bottomLineY - n.step * (lineSpacing / 2);

      // Ledger lines below staff
      if (n.step < 0) {
        for (var ls = -2; ls >= n.step; ls -= 2) {
          var lly = bottomLineY - ls * (lineSpacing / 2);
          svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly + '" x2="' + (x + 10) + '" y2="' + lly + '"/>';
        }
      }
      // Ledger lines above staff
      if (n.step > 8) {
        for (var ls2 = 10; ls2 <= n.step; ls2 += 2) {
          var lly2 = bottomLineY - ls2 * (lineSpacing / 2);
          svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly2 + '" x2="' + (x + 10) + '" y2="' + lly2 + '"/>';
        }
      }

      // Accidental
      if (n.acc) {
        svg += '<text class="recognizer-staff-accidental" x="' + (x - 14) + '" y="' + (y + 4) + '" text-anchor="end">' + n.acc + "</text>";
      }

      // Notehead (tilted ellipse)
      svg += '<ellipse class="recognizer-staff-notehead" cx="' + x + '" cy="' + y + '" rx="6" ry="4.5" transform="rotate(-15 ' + x + " " + y + ')"/>';
    });

    svg += "</svg>";
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
    var btnContainer = document.getElementById("recognizer-note-buttons");
    if (btnContainer) {
      btnContainer.addEventListener("click", function (e) {
        var btn = e.target.closest(".recognizer-note-btn");
        if (!btn) return;
        var semitone = parseInt(btn.getAttribute("data-semitone"), 10);
        appendNote(semitone);
        render();
      });
    }

    // Text input: try recipe format first (e.g. "Fd7/C"), then note names
    var textInput = document.getElementById("recognizer-text-input");
    if (textInput) {
      textInput.addEventListener("input", function () {
        var recipeNotes = M.parseRecipeInput(textInput.value);
        if (recipeNotes) {
          state.notes = recipeNotes;
        } else {
          state.notes = M.parseNoteInput(textInput.value);
        }
        renderNoteButtons();
        renderResult();
        renderStaff();
      });
    }

    // Undo button (remove last note)
    var undoBtn = document.getElementById("recognizer-undo");
    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        removeLastNote();
        render();
      });
    }

    // Clear button
    var clearBtn = document.getElementById("recognizer-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.notes = [];
        render();
      });
    }

    // Backspace key removes last note (when text input not focused)
    document.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && document.activeElement !== textInput) {
        e.preventDefault();
        removeLastNote();
        render();
      }
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
