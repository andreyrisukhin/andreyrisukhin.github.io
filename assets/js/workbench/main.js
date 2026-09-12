// Music Workbench — one smart input, progressive disclosure, shared setlist
(function () {
  "use strict";

  var M = window.Music;
  var Classify = window.WorkbenchClassify;
  var STORAGE_KEY = "musicWorkbenchSetlist";

  // ── State ──
  // current: active chord model { name, root, notes:[semis, bass first], detail, alternatives, roman? }
  // progression: { label, steps, key, transposable, items:[model], activeIdx }

  var state = {
    current: null,
    progression: null,
    matrixOpen: false,
    sheet: { open: false, text: "", barModels: [] },
    setlist: loadSetlist(),
  };

  // ── Classifier deps ──

  function isChord(tok) {
    if (!window.Tonal) return false;
    var parts = tok.split("/");
    if (parts.length > 2) return false;
    var name = M.toAscii(parts[0]);
    name = name.charAt(0).toUpperCase() + name.slice(1);
    var chord = Tonal.Chord.get(name);
    if (chord.empty || !chord.notes || chord.notes.length === 0) return false;
    if (parts.length === 2 && M.parseNote(parts[1]) === -1) return false;
    return true;
  }

  // ── Degree parsing (major key) ──

  var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  var DIATONIC7 = ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"];
  var ROMAN_VAL = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };
  var ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];
  var DEGREE_TOKEN_RE = /^(vii|vi|v|iv|iii|ii|i|[1-7])(\u00B0|\u00F8|dim7?|maj7|m7b5|m7|m|7)?$/i;

  // "V7" / "2" / "viiø" -> { deg: 1-7, suffix: chord suffix for Tonal }
  function parseDegreeToken(tok) {
    var m = tok.match(DEGREE_TOKEN_RE);
    if (!m) return null;
    var numeral = m[1];
    var deg = /^[1-7]$/.test(numeral) ? parseInt(numeral, 10) : ROMAN_VAL[numeral.toLowerCase()];
    var qual = m[2] || "";
    var suffix;
    if (qual === "\u00B0" || qual === "dim") suffix = "dim";
    else if (qual === "dim7") suffix = "dim7";
    else if (qual === "\u00F8") suffix = "m7b5";
    else if (qual) suffix = qual;
    else if (/^[1-7]$/.test(numeral)) suffix = DIATONIC7[deg - 1];
    else if (numeral === numeral.toLowerCase()) suffix = deg === 7 ? "m7b5" : "m7";
    else suffix = deg === 5 ? "7" : "maj7";
    return { deg: deg, suffix: suffix };
  }

  function romanLabel(deg, suffix) {
    var minorish = /^(m(?!aj)|dim)/.test(suffix);
    var base = minorish ? ROMANS[deg - 1].toLowerCase() : ROMANS[deg - 1];
    if (suffix === "m7b5") return base + "\u00F87";
    if (suffix === "dim") return base + "\u00B0";
    if (suffix === "dim7") return base + "\u00B07";
    if (suffix === "maj7") return base + "maj7";
    if (suffix === "m7" || suffix === "7") return base + "7";
    if (suffix === "m") return base;
    return base + suffix;
  }

  // ── Model builders ──

  function rootOfChordName(name) {
    var m = M.toAscii(name).match(/^[A-G][#b]?/);
    return m ? M.parseNote(m[0]) : -1;
  }

  // Move the first candidate whose root matches one of the given semitones to the front
  function promoteByRoot(detected, roots) {
    if (!roots || roots.length === 0) return detected;
    for (var i = 0; i < detected.length; i++) {
      var m = detected[i].split("/")[0].match(/^[A-G][#b]?/);
      if (m && roots.indexOf(M.parseNote(m[0])) !== -1) {
        if (i === 0) return detected;
        return [detected[i]].concat(detected.slice(0, i), detected.slice(i + 1));
      }
    }
    return detected;
  }

  function detailFromTonalName(chordName) {
    if (!window.Tonal || !chordName) return null;
    var chord = Tonal.Chord.get(chordName.split("/")[0]);
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

  function modelFromNotes(semitones, source) {
    if (semitones.length < 2) return null;
    var unique = [];
    var seen = {};
    semitones.forEach(function (s) {
      if (!seen[s]) {
        seen[s] = true;
        unique.push(s);
      }
    });
    var names = unique.map(M.asciiNoteName);
    var detected = window.Tonal ? Tonal.Chord.detect(names) : [];
    if (source === "recipe" && semitones.buttonRoots) {
      detected = promoteByRoot(detected, semitones.buttonRoots);
    }
    var primary = detected[0] || null;
    return {
      name: primary,
      root: primary ? rootOfChordName(primary) : -1,
      inversion: primary ? inversionLabel(primary) : "",
      alternatives: detected.slice(1),
      notes: semitones,
      detail: detailFromTonalName(primary),
      suffix: primary ? suffixOfChordName(primary) : null,
    };
  }

  function modelFromChordName(name) {
    if (!window.Tonal) return null;
    var parts = name.split("/");
    var main = M.toAscii(parts[0]);
    main = main.charAt(0).toUpperCase() + main.slice(1);
    var chord = Tonal.Chord.get(main);
    if (chord.empty || !chord.tonic) return null;
    var rootChroma = Tonal.Note.chroma(chord.tonic);
    var semis = chord.intervals.map(function (iv) {
      return (rootChroma + Tonal.Interval.semitones(iv)) % 12;
    });
    if (parts.length === 2) {
      var bass = M.parseNote(parts[1]);
      var idx = semis.indexOf(bass);
      if (idx > 0) semis = semis.slice(idx).concat(semis.slice(0, idx));
      else if (idx === -1) semis.unshift(bass);
    }
    var displayName = chord.symbol + (parts.length === 2 ? "/" + M.toAscii(parts[1]) : "");
    return {
      name: displayName,
      root: rootChroma,
      inversion: "",
      alternatives: [],
      notes: semis,
      detail: detailFromTonalName(main),
      suffix: suffixOfChordName(chord.symbol),
    };
  }

  // Build a model from an explicit root + display suffix (matrix cells, exercises)
  function modelFromSuffix(root, suffix, roman) {
    var info = M.chordInfo(root, suffix);
    if (!info) return null;
    return {
      name: M.chordName(root, suffix),
      root: root,
      roman: roman || "",
      inversion: "",
      alternatives: [],
      notes: info.semitones.map(function (s) {
        return (root + s) % 12;
      }),
      detail: info,
      suffix: suffix,
    };
  }

  function suffixOfChordName(name) {
    var m = M.toAscii(name.split("/")[0]).match(/^[A-G][#b]?(.*)$/);
    return m ? m[1] : null;
  }

  // ── Progressions ──
  // steps: [{kind:'chord', name} | {kind:'degree', token} | {kind:'stradella', id, offset, roman}]

  function buildProgressionItems(prog) {
    return prog.steps
      .map(function (step) {
        if (step.kind === "entry") {
          return modelFromEntry(step.entry);
        }
        if (step.kind === "chord") {
          var mo = modelFromChordName(step.name);
          if (mo && step.roman) mo.roman = step.roman;
          return mo;
        }
        if (step.kind === "degree") {
          var d = parseDegreeToken(step.token);
          if (!d) return null;
          var root = (prog.key + MAJOR_SCALE[d.deg - 1]) % 12;
          var model = modelFromSuffix(root, d.suffix);
          if (model) model.roman = romanLabel(d.deg, d.suffix);
          return model;
        }
        if (step.kind === "stradella") {
          var c = window.StradellaData && StradellaData.chordById(step.id);
          if (!c) return null;
          var r = (prog.key + step.offset) % 12;
          return modelFromSuffix(r, c.suffix, step.roman);
        }
        return null;
      })
      .filter(function (x) {
        return x;
      });
  }

  function setProgression(prog) {
    prog.items = buildProgressionItems(prog);
    prog.activeIdx = 0;
    state.progression = prog.items.length > 0 ? prog : null;
    state.current = prog.items[0] || null;
    renderMain();
  }

  // ── Setlist (localStorage) ──
  // item: { name, chords: [{name, roman, notes}] }

  function loadSetlist() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      // Migrate v1 single-chord items { name, notes }
      return list.map(function (item) {
        if (item.notes && !item.chords) {
          return { name: item.name, chords: [{ name: item.name, notes: item.notes }] };
        }
        return item;
      });
    } catch (e) {
      return [];
    }
  }

  function saveSetlist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.setlist));
    } catch (e) {
      /* private mode */
    }
  }

  function chordEntry(model) {
    return {
      name: model.name || model.notes.map(M.noteName).join(" "),
      roman: model.roman || "",
      root: model.root,
      suffix: model.suffix,
      notes: model.notes,
    };
  }

  // Rebuild a model from a stored setlist entry. Prefer root+suffix (exact,
  // handles Stradella-only names like "maj7 (inv)"), fall back to parsing the
  // name, then to re-detecting from raw notes (v1 items)
  function modelFromEntry(entry) {
    var model = null;
    if (entry.suffix != null && entry.root >= 0) {
      model = modelFromSuffix(entry.root, entry.suffix, entry.roman);
    }
    if (!model && entry.name) model = modelFromChordName(entry.name);
    if (!model && entry.notes) model = modelFromNotes(entry.notes, "notes");
    if (model && entry.roman) model.roman = entry.roman;
    return model;
  }

  function addChordToSetlist(model) {
    state.setlist.push({ name: chordEntry(model).name, chords: [chordEntry(model)] });
    saveSetlist();
    renderSetlist();
  }

  function addProgressionToSetlist(prog) {
    state.setlist.push({
      name:
        prog.label ||
        prog.items
          .map(function (i) {
            return i.name;
          })
          .join(" "),
      chords: prog.items.map(chordEntry),
    });
    saveSetlist();
    renderSetlist();
  }

  // ── Chord detail helpers ──

  function inversionLabel(chordName) {
    if (!window.Tonal || !chordName) return "";
    var parts = chordName.split("/");
    if (parts.length < 2) return "Root position";
    var bass = parts[parts.length - 1];
    var chord = Tonal.Chord.get(parts.slice(0, -1).join("/"));
    if (chord.empty || !chord.notes) return "";
    var bassChroma = Tonal.Note.chroma(bass);
    for (var i = 0; i < chord.notes.length; i++) {
      if (Tonal.Note.chroma(chord.notes[i]) === bassChroma) {
        var labels = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"];
        return labels[i] || i + "th inversion";
      }
    }
    return "Bass: " + bass;
  }

  function renderStradellaEntries(rootSemitone, suffix) {
    var S = window.StradellaData;
    if (!S || rootSemitone < 0 || suffix == null) return "";
    var entries = S.findBySuffix(suffix);
    if (entries.length === 0) return "";
    var html = '<div class="workbench-section"><h4 class="workbench-section-title">How to play (Stradella)</h4>';
    for (var j = 0; j < entries.length; j++) {
      var c = entries[j];
      var cls = "recognizer-stradella-item";
      if (c.bug) cls += " is-bug";
      else if (c.approx) cls += " is-approx";
      html += '<div class="' + cls + '">';
      html += '<span class="recognizer-stradella-recipe">' + M.esc(S.renderRecipe(c, rootSemitone, true)) + "</span>";
      if (c.notes) html += '<span class="recognizer-stradella-note">' + M.esc(c.notes) + "</span>";
      var warn = c.bugNote || c.approxNote || c.uncertainNote;
      if (warn) html += '<span class="recognizer-stradella-warn">' + M.esc(warn) + "</span>";
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  // ── Staff SVG ──

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

  function staffSvg(semitones) {
    var notes = [];
    semitones.forEach(function (semitone, i) {
      var info = SEMITONE_TO_STAFF[semitone];
      var step = LETTER_STEP[info.letter];
      var octave = 4;
      if (i > 0 && step + (octave - 4) * 7 < notes[i - 1].step) octave = 5;
      notes.push({ letter: info.letter, acc: info.acc, step: step + (octave - 4) * 7 });
    });

    var lineSpacing = 10,
      bottomLineY = 60,
      leftMargin = 40,
      noteSpacing = 50,
      rightPad = 20;
    var svgWidth = leftMargin + notes.length * noteSpacing + rightPad;
    var svg = '<svg class="recognizer-staff-svg" viewBox="0 0 ' + svgWidth + ' 90" xmlns="http://www.w3.org/2000/svg">';

    [0, 2, 4, 6, 8].forEach(function (s) {
      var ly = bottomLineY - s * (lineSpacing / 2);
      svg +=
        '<line class="recognizer-staff-line" x1="' + (leftMargin - 5) + '" y1="' + ly + '" x2="' + (svgWidth - rightPad + 5) + '" y2="' + ly + '"/>';
    });
    svg +=
      '<text class="recognizer-staff-clef" x="5" y="' +
      (bottomLineY - 2 * lineSpacing + 8) +
      '" font-family="serif, \'Noto Music\', \'Segoe UI Symbol\'" font-size="38">\uD834\uDD1E</text>';

    notes.forEach(function (n, i) {
      var x = leftMargin + (i + 0.5) * noteSpacing;
      var y = bottomLineY - n.step * (lineSpacing / 2);
      var ls;
      for (ls = -2; ls >= n.step; ls -= 2) {
        var lly = bottomLineY - ls * (lineSpacing / 2);
        svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly + '" x2="' + (x + 10) + '" y2="' + lly + '"/>';
      }
      for (ls = 10; ls <= n.step; ls += 2) {
        var lly2 = bottomLineY - ls * (lineSpacing / 2);
        svg += '<line class="recognizer-staff-ledger" x1="' + (x - 10) + '" y1="' + lly2 + '" x2="' + (x + 10) + '" y2="' + lly2 + '"/>';
      }
      if (n.acc) {
        svg += '<text class="recognizer-staff-accidental" x="' + (x - 14) + '" y="' + (y + 4) + '" text-anchor="end">' + n.acc + "</text>";
      }
      svg += '<ellipse class="recognizer-staff-notehead" cx="' + x + '" cy="' + y + '" rx="6" ry="4.5" transform="rotate(-15 ' + x + " " + y + ')"/>';
    });
    return svg + "</svg>";
  }

  // ── Circle of fifths SVG ──

  var FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  function circlePos(semitone, cx, cy, r) {
    var idx = FIFTHS.indexOf(((semitone % 12) + 12) % 12);
    var angle = ((-90 + idx * 30) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function circleSvg(items, activeIdx) {
    var size = 260,
      cx = size / 2,
      cy = size / 2,
      r = 100,
      nodeR = 17;
    var roots = items.map(function (it) {
      return it.root;
    });
    var inProg = {};
    roots.forEach(function (root, i) {
      if (root < 0) return;
      if (!inProg[root]) inProg[root] = [];
      inProg[root].push(i + 1);
    });

    var svg = '<svg class="workbench-circle-svg" viewBox="0 0 ' + size + " " + size + '" xmlns="http://www.w3.org/2000/svg">';
    svg +=
      '<defs><marker id="wb-arrow" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" class="workbench-circle-arrowhead"/></marker></defs>';

    // Edges between consecutive roots, curved toward center
    for (var i = 0; i < roots.length - 1; i++) {
      if (roots[i] < 0 || roots[i + 1] < 0 || roots[i] === roots[i + 1]) continue;
      var a = circlePos(roots[i], cx, cy, r);
      var b = circlePos(roots[i + 1], cx, cy, r);
      // Trim endpoints to node edge
      var dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.sqrt(dx * dx + dy * dy);
      var ax = a.x + (dx / len) * nodeR,
        ay = a.y + (dy / len) * nodeR;
      var bx = b.x - (dx / len) * (nodeR + 4),
        by = b.y - (dy / len) * (nodeR + 4);
      var mx = (ax + bx) / 2 + (cx - (ax + bx) / 2) * 0.25;
      var my = (ay + by) / 2 + (cy - (ay + by) / 2) * 0.25;
      svg +=
        '<path class="workbench-circle-edge" d="M ' + ax + " " + ay + " Q " + mx + " " + my + " " + bx + " " + by + '" marker-end="url(#wb-arrow)"/>';
    }

    // Nodes
    FIFTHS.forEach(function (semitone) {
      var p = circlePos(semitone, cx, cy, r);
      var steps = inProg[semitone];
      var isActive = steps && activeIdx != null && items[activeIdx] && items[activeIdx].root === semitone;
      var cls = "workbench-circle-node" + (steps ? " in-progression" : "") + (isActive ? " is-active" : "");
      svg += '<g class="' + cls + '">';
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + nodeR + '"/>';
      svg += '<text x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle">' + M.esc(M.noteName(semitone)) + "</text>";
      if (steps) {
        var bp = circlePos(semitone, cx, cy, r + nodeR + 9);
        svg += '<text class="workbench-circle-order" x="' + bp.x + '" y="' + (bp.y + 3) + '" text-anchor="middle">' + steps.join(",") + "</text>";
      }
      svg += "</g>";
    });

    return svg + "</svg>";
  }

  // ── Key bar (own delegation-safe version) ──

  function keyBarHtml(activeKey) {
    var html = '<div class="workbench-keybar">';
    M.NOTES.forEach(function (n, i) {
      var cls = "music-key-btn" + (i === activeKey ? " is-active" : "");
      html += '<button class="' + cls + '" data-wbkey="' + i + '">' + M.esc(n) + "</button>";
    });
    return html + "</div>";
  }

  // ── Chord card ──

  function renderChordCard(model) {
    var html = '<div class="workbench-card">';

    if (model.name) {
      html += '<div class="recognizer-chord-name">' + M.esc(model.name);
      if (model.roman) html += '<span class="recognizer-inversion">' + M.esc(model.roman) + "</span>";
      if (model.inversion) html += '<span class="recognizer-inversion">(' + M.esc(model.inversion) + ")</span>";
      html += "</div>";
    } else {
      html +=
        '<div class="recognizer-chord-name">?</div>' +
        '<p class="recognizer-prompt">No chord recognized for ' +
        M.esc(model.notes.map(M.noteName).join(" ")) +
        "</p>";
    }

    if (model.alternatives && model.alternatives.length > 0) {
      html += '<div class="recognizer-alternatives">Also: ';
      html += model.alternatives
        .map(function (c) {
          return '<button class="workbench-chip" data-chord="' + M.esc(c) + '">' + M.esc(c) + "</button>";
        })
        .join(" ");
      html += "</div>";
    }

    if (model.detail) {
      html += '<div class="recognizer-details">';
      html += "<div><strong>Notes:</strong> " + M.esc(model.detail.notes.join(" ")) + "</div>";
      html += "<div><strong>Intervals:</strong> " + M.esc(model.detail.intervals.join(" ")) + "</div>";
      html += "<div><strong>Semitones:</strong> " + M.esc(model.detail.semitones.join("\u2013")) + "</div>";
      html += "</div>";
    }

    html += '<div class="workbench-section"><h4 class="workbench-section-title">Sheet</h4>' + staffSvg(model.notes) + "</div>";
    html += renderStradellaEntries(model.root, model.suffix);

    html += '<div class="workbench-actions">' + '<button class="music-share-btn" id="workbench-add">Add to setlist</button>' + "</div>";

    html += "</div>";
    return html;
  }

  // ── Progression block ──

  function renderProgressionBlock(prog) {
    var html = '<div class="workbench-card workbench-progression-block">';
    html += '<div class="workbench-progression-head">';
    if (prog.label) html += '<span class="workbench-progression-label">' + M.esc(prog.label) + "</span>";
    html += '<button class="music-share-btn" id="workbench-add-prog">Add progression to setlist</button>';
    html += "</div>";

    if (prog.transposable) html += keyBarHtml(prog.key);

    html += '<div class="workbench-progression">';
    prog.items.forEach(function (item, i) {
      var cls = "workbench-chip workbench-prog-chip" + (i === prog.activeIdx ? " is-active" : "");
      html += '<button class="' + cls + '" data-idx="' + i + '">' + M.esc(item.name);
      if (item.roman) html += '<span class="workbench-chip-roman">' + M.esc(item.roman) + "</span>";
      html += "</button>";
    });
    html += "</div>";

    html += '<div class="workbench-circle">' + circleSvg(prog.items, prog.activeIdx) + "</div>";
    html += "</div>";
    return html;
  }

  // ── Sheet draft (abcjs) ──

  var SHEET_SEED = "C E G c | d2 B2 | c4";
  var ACCIDENTAL_OFFSET = { "^": 1, _: -1, "=": 0 };

  function fullAbc(text) {
    if (/^[XK]:/m.test(text)) return text;
    return "X:1\nM:4/4\nL:1/4\nK:C\n" + text;
  }

  // Extract pitch classes per bar from ABC body text (headers stripped)
  function sheetBarModels(text) {
    var body = text
      .split("\n")
      .filter(function (line) {
        return !/^[A-Za-z]:/.test(line);
      })
      .join(" ");
    var bars = body.split("|");
    var models = [];
    bars.forEach(function (bar, barIdx) {
      var semis = [];
      var re = /([_^=]?)([A-Ga-g])/g;
      var m;
      while ((m = re.exec(bar)) !== null) {
        var s = M.parseNote(m[2].toUpperCase());
        if (s === -1) continue;
        s = (s + (ACCIDENTAL_OFFSET[m[1]] || 0) + 12) % 12;
        if (semis.indexOf(s) === -1) semis.push(s);
      }
      if (semis.length === 0) return;
      var model = semis.length >= 2 ? modelFromNotes(semis, "notes") : null;
      models.push({ bar: barIdx + 1, model: model, semis: semis });
    });
    return models;
  }

  function openSheet(text) {
    state.sheet.open = true;
    state.sheet.text = text || state.sheet.text || SHEET_SEED;
    var panel = document.getElementById("workbench-sheet");
    if (!panel) return;
    if (!panel.innerHTML) {
      panel.innerHTML =
        '<div class="workbench-card">' +
        '<div class="workbench-sheet-head">' +
        '<span class="workbench-section-title">Sheet draft (ABC notation)</span>' +
        '<span><button class="music-share-btn" id="workbench-sheet-setlist">Add chords to setlist</button> ' +
        '<button class="music-share-btn" id="workbench-sheet-close">Close</button></span>' +
        "</div>" +
        '<textarea id="workbench-sheet-text" class="workbench-sheet-text" rows="4" spellcheck="false"></textarea>' +
        '<div id="workbench-sheet-render" class="workbench-sheet-render"></div>' +
        '<div id="workbench-sheet-chords" class="workbench-progression"></div>' +
        "</div>";
      var ta = document.getElementById("workbench-sheet-text");
      ta.addEventListener("input", function () {
        state.sheet.text = ta.value;
        updateSheetRender();
      });
    }
    document.getElementById("workbench-sheet-text").value = state.sheet.text;
    panel.style.display = "";
    updateSheetRender();
    var hint = document.getElementById("workbench-hint");
    if (hint) hint.style.display = "none";
  }

  function closeSheet() {
    state.sheet.open = false;
    var panel = document.getElementById("workbench-sheet");
    if (panel) panel.style.display = "none";
    renderLibrary();
  }

  function updateSheetRender() {
    var renderDiv = document.getElementById("workbench-sheet-render");
    var chordsDiv = document.getElementById("workbench-sheet-chords");
    if (!renderDiv || !window.ABCJS) return;
    try {
      ABCJS.renderAbc(renderDiv, fullAbc(state.sheet.text), { responsive: "resize" });
    } catch (e) {
      renderDiv.innerHTML = '<p class="recognizer-prompt">Could not render — check the ABC syntax</p>';
    }
    state.sheet.barModels = sheetBarModels(state.sheet.text);
    var html = "";
    state.sheet.barModels.forEach(function (bm, i) {
      var label = bm.model && bm.model.name ? bm.model.name : bm.semis.map(M.noteName).join(" ");
      html +=
        '<button class="workbench-chip" data-bar="' +
        i +
        '">' +
        M.esc(label) +
        '<span class="workbench-chip-roman">bar ' +
        bm.bar +
        "</span></button>";
    });
    chordsDiv.innerHTML = html ? '<span class="workbench-hint-label">Bar chords:</span> ' + html : "";
  }

  // ── Chord type matrix ──

  function matrixToggleHtml() {
    return '<button class="workbench-chip' + (state.matrixOpen ? " is-active" : "") + '" id="workbench-matrix-toggle">All chord types</button>';
  }

  function renderMatrix() {
    var container = document.getElementById("workbench-matrix");
    if (!container) return;
    if (!state.matrixOpen || !window.StradellaData) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }
    var S = window.StradellaData;
    var root = state.current && state.current.root >= 0 ? state.current.root : 0;
    var currentSet = null;
    if (state.current) {
      currentSet = {};
      state.current.notes.forEach(function (s) {
        currentSet[s] = true;
      });
    }

    var html =
      '<div class="workbench-card"><div class="workbench-matrix-head">' +
      '<span class="workbench-section-title">All chord types on ' +
      M.esc(M.noteName(root)) +
      "</span>";
    if (currentSet) {
      html += '<span class="workbench-matrix-hint">\u00B1n = tones changed vs ' + M.esc(state.current.name || "current") + "</span>";
    }
    html += '</div><table class="workbench-matrix-table"><thead><tr><th></th>';
    S.GRID_COLS.forEach(function (q) {
      html += "<th>" + M.esc(q) + "</th>";
    });
    html += "</tr></thead><tbody>";

    S.GRID_ROWS.forEach(function (ext) {
      html += "<tr><th>" + M.esc(ext) + "</th>";
      S.GRID_COLS.forEach(function (qual) {
        html += "<td>";
        var seenSuffix = {};
        S.CHORDS.forEach(function (c) {
          if (c.quality !== qual || c.extension !== ext || c.bug) return;
          if (seenSuffix[c.suffix]) return;
          seenSuffix[c.suffix] = true;
          var info = M.chordInfo(root, c.suffix);
          if (!info) return;
          var label = c.suffix === "" ? "maj" : c.suffix;
          var diffBadge = "";
          if (currentSet) {
            var cellSet = {};
            info.semitones.forEach(function (s) {
              cellSet[(root + s) % 12] = true;
            });
            var diff = 0;
            var k;
            for (k in cellSet) if (!currentSet[k]) diff++;
            for (k in currentSet) if (!cellSet[k]) diff++;
            if (diff > 0) diffBadge = '<span class="workbench-matrix-diff">\u00B1' + diff + "</span>";
          }
          html +=
            '<button class="workbench-matrix-cell" data-suffix="' +
            M.esc(c.suffix) +
            '">' +
            '<span class="workbench-matrix-suffix">' +
            M.esc(label) +
            diffBadge +
            "</span>" +
            '<span class="workbench-matrix-formula">' +
            M.esc(c.intervals) +
            "</span>" +
            "</button>";
        });
        html += "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    container.innerHTML = html;
    container.style.display = "";
  }

  // ── Library ──

  function builtinPresets() {
    return [
      { id: "ii-v-i", title: "ii\u2013V\u2013I", degrees: ["2", "5", "1"] },
      { id: "blues-12", title: "12-Bar Blues", degrees: ["17", "47", "17", "17", "47", "47", "17", "17", "57", "47", "17", "57"] },
    ];
  }

  function renderLibrary() {
    var container = document.getElementById("workbench-library");
    if (!container) return;
    var html = '<span class="workbench-hint-label">Library:</span>';
    builtinPresets().forEach(function (p) {
      html += '<button class="workbench-chip" data-preset="' + p.id + '">' + p.title + "</button>";
    });
    (window.MusicExercises || []).forEach(function (ex) {
      html += '<button class="workbench-chip" data-exercise="' + M.esc(ex.id) + '">' + M.esc(ex.title) + "</button>";
    });
    html += '<button class="workbench-chip' + (state.sheet.open ? " is-active" : "") + '" id="workbench-sheet-toggle">Sheet draft</button>';
    html += matrixToggleHtml();
    container.innerHTML = html;
  }

  function loadPreset(id) {
    var preset = builtinPresets().filter(function (p) {
      return p.id === id;
    })[0];
    if (!preset) return;
    setProgression({
      label: preset.title,
      steps: preset.degrees.map(function (t) {
        return { kind: "degree", token: t };
      }),
      key: 0,
      transposable: true,
    });
  }

  function loadExercise(id) {
    var ex = (window.MusicExercises || []).filter(function (e) {
      return e.id === id;
    })[0];
    if (!ex) return;
    setProgression({
      label: ex.title,
      steps: ex.progression.map(function (step) {
        return { kind: "stradella", id: step.id, offset: step.offset, roman: step.roman };
      }),
      key: ex.default_key || 0,
      transposable: true,
    });
  }

  // ── Main rendering ──

  function renderMain() {
    var container = document.getElementById("workbench-result");
    var hint = document.getElementById("workbench-hint");
    if (!container) return;

    var html = "";
    if (state.progression) {
      html += renderProgressionBlock(state.progression);
    }
    if (state.current) {
      html += renderChordCard(state.current);
    }
    container.innerHTML = html;
    if (hint) hint.style.display = state.current || state.progression || state.sheet.open ? "none" : "";
    renderMatrix();
  }

  function showMessage(msg) {
    state.current = null;
    state.progression = null;
    var container = document.getElementById("workbench-result");
    var hint = document.getElementById("workbench-hint");
    if (container) {
      container.innerHTML = msg ? '<div class="workbench-card"><p class="recognizer-prompt">' + msg + "</p></div>" : "";
    }
    if (hint) hint.style.display = msg ? "none" : "";
    renderMatrix();
  }

  function renderResult(classification) {
    switch (classification.type) {
      case "empty":
        showMessage("");
        return;
      case "note":
        state.progression = null;
        state.current = null;
        var container = document.getElementById("workbench-result");
        container.innerHTML =
          '<div class="workbench-card"><div class="recognizer-chord-name">' +
          M.esc(M.noteName(M.parseNote(classification.token))) +
          "</div>" +
          '<p class="recognizer-prompt">Add more notes to identify a chord, or type a chord name like Am7</p></div>';
        var hint = document.getElementById("workbench-hint");
        if (hint) hint.style.display = "none";
        renderMatrix();
        return;
      case "notes":
        state.progression = null;
        state.current = modelFromNotes(M.parseNoteInput(classification.tokens.join(" ")), "notes");
        renderMain();
        return;
      case "recipe":
        state.progression = null;
        state.current = modelFromNotes(classification.notes, "recipe");
        renderMain();
        return;
      case "degrees":
        setProgression({
          label: classification.degrees.join(" ") + (classification.key ? " in " + classification.key : ""),
          steps: classification.degrees.map(function (t) {
            return { kind: "degree", token: t };
          }),
          key: classification.key ? Math.max(0, M.parseNote(classification.key)) : 0,
          transposable: true,
        });
        return;
      case "chords":
        if (classification.names.length === 1) {
          state.progression = null;
          state.current = modelFromChordName(classification.names[0]);
          renderMain();
        } else {
          setProgression({
            label: "",
            steps: classification.names.map(function (n) {
              return { kind: "chord", name: n };
            }),
            key: 0,
            transposable: false,
          });
        }
        return;
      case "sheet":
        state.progression = null;
        state.current = null;
        renderMain();
        openSheet(classification.text);
        renderLibrary();
        return;
      case "url":
        showMessage("Tab and MuseScore ingestion is coming soon. For now, type notes (C E G) or a chord name (Am7).");
        return;
      default:
        showMessage('Not recognized. Try notes like "C E G", a chord like "Am7", degrees like "2 5 1 in G", or a Stradella recipe like "Fd7/C".');
    }
  }

  // ── Setlist rendering ──

  function renderSetlist() {
    var aside = document.getElementById("workbench-setlist");
    if (!aside) return;
    if (state.setlist.length === 0) {
      aside.style.display = "none";
      aside.innerHTML = "";
      return;
    }
    aside.style.display = "";
    var html = '<h4 class="workbench-section-title">Setlist</h4><ul class="workbench-setlist-items">';
    state.setlist.forEach(function (item, i) {
      var count = item.chords.length > 1 ? ' <span class="workbench-setlist-count">(' + item.chords.length + ")</span>" : "";
      html +=
        '<li class="workbench-setlist-item">' +
        '<button class="workbench-setlist-load" data-index="' +
        i +
        '">' +
        M.esc(item.name) +
        count +
        "</button>" +
        '<button class="workbench-setlist-remove" data-index="' +
        i +
        '" title="Remove">&times;</button>' +
        "</li>";
    });
    html += "</ul>";
    aside.innerHTML = html;
  }

  function loadSetlistItem(item) {
    if (item.chords.length === 1) {
      state.progression = null;
      state.current = modelFromEntry(item.chords[0]);
      renderMain();
    } else {
      setProgression({
        label: item.name,
        steps: item.chords.map(function (c) {
          return { kind: "entry", entry: c };
        }),
        key: 0,
        transposable: false,
      });
    }
  }

  // ── Wiring ──

  function handleInput(value) {
    var classification = Classify.classify(value, {
      isChord: isChord,
      parseRecipe: M.parseRecipeInput,
    });
    renderResult(classification);
  }

  function init() {
    var input = document.getElementById("workbench-input");
    if (!input) return;

    input.addEventListener("input", function () {
      handleInput(input.value);
    });

    renderLibrary();
    renderSetlist();
    handleInput(input.value || "Am7");

    document.addEventListener("click", function (e) {
      // Example chips fill the input
      var example = e.target.closest(".workbench-chip[data-example]");
      if (example) {
        input.value = example.getAttribute("data-example");
        handleInput(input.value);
        input.focus();
        return;
      }

      if (e.target.id === "workbench-add" && state.current) {
        addChordToSetlist(state.current);
        return;
      }
      if (e.target.id === "workbench-add-prog" && state.progression) {
        addProgressionToSetlist(state.progression);
        return;
      }
      if (e.target.id === "workbench-matrix-toggle") {
        state.matrixOpen = !state.matrixOpen;
        renderLibrary();
        renderMatrix();
        return;
      }
      if (e.target.id === "workbench-sheet-toggle") {
        if (state.sheet.open) closeSheet();
        else {
          openSheet();
          renderLibrary();
        }
        return;
      }
      if (e.target.id === "workbench-sheet-close") {
        closeSheet();
        return;
      }
      if (e.target.id === "workbench-sheet-setlist") {
        var models = state.sheet.barModels
          .map(function (bm) {
            return bm.model;
          })
          .filter(function (mo) {
            return mo && mo.name;
          });
        if (models.length > 0) {
          addProgressionToSetlist({ label: "Sheet draft", items: models });
        }
        return;
      }
      var barChip = e.target.closest(".workbench-chip[data-bar]");
      if (barChip) {
        var bm = state.sheet.barModels[parseInt(barChip.getAttribute("data-bar"), 10)];
        if (bm && bm.model) {
          state.progression = null;
          state.current = bm.model;
          renderMain();
        }
        return;
      }

      var preset = e.target.closest(".workbench-chip[data-preset]");
      if (preset) {
        loadPreset(preset.getAttribute("data-preset"));
        return;
      }
      var exercise = e.target.closest(".workbench-chip[data-exercise]");
      if (exercise) {
        loadExercise(exercise.getAttribute("data-exercise"));
        return;
      }

      var progChip = e.target.closest(".workbench-prog-chip[data-idx]");
      if (progChip && state.progression) {
        state.progression.activeIdx = parseInt(progChip.getAttribute("data-idx"), 10);
        state.current = state.progression.items[state.progression.activeIdx] || null;
        renderMain();
        return;
      }

      var keyBtn = e.target.closest(".music-key-btn[data-wbkey]");
      if (keyBtn && state.progression && state.progression.transposable) {
        state.progression.key = parseInt(keyBtn.getAttribute("data-wbkey"), 10);
        var idx = state.progression.activeIdx;
        state.progression.items = buildProgressionItems(state.progression);
        state.progression.activeIdx = Math.min(idx, state.progression.items.length - 1);
        state.current = state.progression.items[state.progression.activeIdx] || null;
        renderMain();
        return;
      }

      var matrixCell = e.target.closest(".workbench-matrix-cell[data-suffix]");
      if (matrixCell) {
        var root = state.current && state.current.root >= 0 ? state.current.root : 0;
        var model = modelFromSuffix(root, matrixCell.getAttribute("data-suffix"));
        if (model) {
          state.progression = null;
          state.current = model;
          renderMain();
        }
        return;
      }

      var chip = e.target.closest(".workbench-chip[data-chord]");
      if (chip) {
        input.value = chip.getAttribute("data-chord");
        handleInput(input.value);
        return;
      }

      var load = e.target.closest(".workbench-setlist-load");
      if (load) {
        var item = state.setlist[parseInt(load.getAttribute("data-index"), 10)];
        if (item) loadSetlistItem(item);
        return;
      }
      var remove = e.target.closest(".workbench-setlist-remove");
      if (remove) {
        state.setlist.splice(parseInt(remove.getAttribute("data-index"), 10), 1);
        saveSetlist();
        renderSetlist();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
