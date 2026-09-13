// One musical object, seen as notation, buttons, a recipe, and sound.
(function () {
  "use strict";
  var root = document.querySelector(".workbench");
  if (!root) return;
  var M = window.Music,
    Model = window.WorkbenchModel,
    Player = window.WorkbenchPlayer;
  var Diagrams = window.WorkbenchDiagrams,
    S = window.StradellaData;
  var input = document.getElementById("workbench-input");
  var result = document.getElementById("workbench-result");
  var KEY = "musicWorkbenchSetlist";
  var state = {
    items: [],
    index: 0,
    key: 0,
    degrees: null,
    label: "",
    bpm: 96,
    loop: false,
    saved: [],
    storageError: "",
    drawer: false,
    theory: false,
    matrix: false,
    sheet: false,
  };
  var FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  var presets = [
    { id: "ii-v-i", label: "ii–V–I", degrees: ["2", "5", "1"] },
    { id: "blues-12", label: "12-bar blues", degrees: ["17", "47", "17", "17", "47", "47", "17", "17", "57", "47", "17", "57"] },
  ];

  function announce(text) {
    document.getElementById("workbench-announcement").textContent = text;
  }
  function button(text, attrs, cls) {
    return '<button type="button" class="' + (cls || "workbench-chip") + '" ' + (attrs || "") + ">" + text + "</button>";
  }
  function current() {
    return state.items[state.index];
  }
  function setInputFromState() {
    input.value = state.items
      .map(function (m) {
        return m.name;
      })
      .join(" ");
  }
  function selectItems(items, options) {
    Player.stop();
    options = options || {};
    state.items = items.filter(Boolean);
    state.index = Math.min(options.index || 0, Math.max(0, state.items.length - 1));
    state.key = options.key == null ? (current() ? current().root : 0) : options.key;
    state.label = options.label || "";
    state.degrees = options.degrees || null;
    input.removeAttribute("aria-invalid");
    document.getElementById("workbench-share-result").hidden = true;
    if (options.syncInput) setInputFromState();
    render();
    announce(current() ? current().name + (state.items.length > 1 ? ", progression of " + state.items.length + " chords." : ".") : "");
  }

  function classify(value) {
    Player.stop();
    state.sheet = false;
    document.getElementById("workbench-sheet").hidden = true;
    var c = WorkbenchClassify.classify(value.slice(0, 500), {
      isChord: function (name) {
        return !!Model.fromName(name);
      },
      parseRecipe: M.parseRecipeInput,
    });
    if (c.type === "degrees") {
      var key = c.key ? M.parseNote(c.key) : 0;
      return selectItems(
        c.degrees.map(function (t) {
          return Model.fromDegree(t, key);
        }),
        {
          key: key,
          degrees: c.degrees,
          label: "Major-key progression",
        }
      );
    }
    if (c.type === "chords") return selectItems(c.names.map(Model.fromName));
    if (c.type === "recipe") return selectItems([Model.fromNotes(c.notes, c.notes.buttonRoots)]);
    if (c.type === "notes" || c.type === "note") {
      return selectItems([Model.fromNotes(M.parseNoteInput(c.tokens ? c.tokens.join(" ") : c.token))]);
    }
    if (c.type === "sheet") {
      selectItems([]);
      return openSheet(c.text);
    }
    selectItems([]);
    if (c.type === "empty") {
      result.innerHTML = '<p class="wb-empty">Start with a chord above, or try one of the examples.</p>';
    } else {
      var message =
        c.type === "url"
          ? "Link imports are not supported. Type the notes or chords instead."
          : "That input is not recognized. Try Am7, C E G, or 2 5 1 in G.";
      result.innerHTML = '<p class="wb-empty">' + message + "</p>";
      input.setAttribute("aria-invalid", "true");
      announce(message);
    }
  }

  function keyBar() {
    var html =
      '<div class="wb-key-select"><span class="music-small">' +
      (state.items.length > 1 ? "Key / transpose" : "Root / transpose") +
      "</span>" +
      '<div class="workbench-keybar" role="group" aria-label="Transpose">';
    M.NOTES.forEach(function (n, i) {
      html += button(
        M.esc(n),
        'data-wbkey="' + i + '" aria-pressed="' + (state.key === i) + '"',
        "music-key-btn" + (state.key === i ? " is-active" : "")
      );
    });
    return html + "</div></div>";
  }

  function circle() {
    var cx = 126,
      cy = 126,
      radius = 93;
    function pos(pc) {
      var angle = ((-90 + FIFTHS.indexOf(pc) * 30) * Math.PI) / 180;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    }
    var html =
      '<svg class="workbench-circle-svg" viewBox="0 0 252 252" role="img" aria-label="Circle of fifths: ' +
      M.esc(
        state.items
          .map(function (item) {
            return item.name;
          })
          .join(", ")
      ) +
      '">';
    state.items.forEach(function (item, i) {
      if (!i || item.root === state.items[i - 1].root) return;
      var a = pos(state.items[i - 1].root),
        b = pos(item.root);
      html +=
        '<path class="wb-circle-path' +
        (i === state.index ? " is-current" : "") +
        '" d="M ' +
        a.x +
        " " +
        a.y +
        " Q 126 126 " +
        b.x +
        " " +
        b.y +
        '"/>';
    });
    FIFTHS.forEach(function (pc) {
      var p = pos(pc),
        active = current().root === pc;
      var steps = [];
      state.items.forEach(function (m, i) {
        if (m.root === pc) steps.push(i + 1);
      });
      html +=
        '<g class="workbench-circle-node' +
        (steps.length ? " in-progression" : "") +
        (active ? " is-active" : "") +
        '">' +
        '<circle cx="' +
        p.x +
        '" cy="' +
        p.y +
        '" r="18"/><text x="' +
        p.x +
        '" y="' +
        (p.y + 4) +
        '" text-anchor="middle">' +
        M.esc(M.noteName(pc)) +
        "</text><title>" +
        M.esc(M.noteName(pc)) +
        (steps.length ? ": steps " + steps.join(", ") : "") +
        "</title></g>";
    });
    return html + "</svg>";
  }

  function progression() {
    if (state.items.length < 2) return "";
    var html =
      '<section class="wb-progression-panel" aria-label="Progression"><div><div class="wb-section-heading">' +
      "<h2>" +
      M.esc(state.label || "Your progression") +
      '</h2><span class="music-small">4 beats per chord</span></div>' +
      '<div class="workbench-progression" role="group" aria-label="Progression chords">';
    state.items.forEach(function (item, i) {
      html += button(
        '<span class="music-small">' +
          (i + 1) +
          "</span> " +
          M.esc(item.name) +
          '<span class="workbench-chip-roman">' +
          M.esc(item.roman || "") +
          "</span>",
        'data-step="' + i + '" aria-pressed="' + (i === state.index) + '"',
        "workbench-chip workbench-prog-chip" + (i === state.index ? " is-active" : "")
      );
    });
    return (
      html +
      '</div><p class="music-small">Choose a chord to inspect. The path follows its root around the circle of fifths.</p></div>' +
      '<div class="workbench-circle">' +
      circle() +
      "</div></section>"
    );
  }

  function recipe(model) {
    var recipes = Model.recipes(model);
    if (!recipes.length)
      return '<section class="wb-recipe"><h3>Left hand · Stradella</h3><p class="music-small">No catalog recipe for this voicing. Explore the notes on the right-hand pitch map.</p></section>';
    recipes.sort(function (a, b) {
      return Number(b.exact) - Number(a.exact);
    });
    var r = recipes[0];
    var html =
      '<section class="wb-recipe"><div class="wb-section-heading"><h3>Left hand · Stradella</h3>' +
      '<span class="music-small">' +
      (r.exact ? "Exact pitch set" : "Approximate pitch set") +
      "</span></div>" +
      '<p class="wb-recipe-formula">' +
      M.esc(r.label) +
      '</p><div class="wb-recipe-buttons">';
    html += button(
      "<span>" + M.esc(M.noteName(r.bass)) + "</span><small>Bass</small>",
      'data-sound="' + (48 + r.bass) + '" data-pcs="' + r.bass + '"',
      "wb-bass-button"
    );
    r.parts.forEach(function (part) {
      html +=
        '<span class="music-small" aria-hidden="true">+</span>' +
        button(
          M.esc(part.name),
          'data-sound="' +
            part.notes
              .map(function (n) {
                return 60 + n;
              })
              .join(",") +
            '" data-pcs="' +
            part.notes.join(",") +
            '"',
          "wb-chord-button"
        );
    });
    html +=
      '</div><p class="music-small">Press together: bass + chord button' +
      (r.parts.length > 1 ? "s" : "") +
      ". These are pitch sets, not prescribed fingerings.</p>";
    if (r.rh != null) html += '<p class="music-small">Add ' + M.esc(M.noteName(r.rh)) + " in the right hand.</p>";
    if (r.missing.length) html += '<p class="wb-warning">Missing: ' + M.esc(r.missing.map(M.noteName).join(", ")) + ".</p>";
    if (r.extra.length) html += '<p class="wb-warning">Extra tones: ' + M.esc(r.extra.map(M.noteName).join(", ")) + ".</p>";
    if (r.large) html += '<p class="wb-warning">A theoretical stack, not an ergonomic left-hand voicing. Move extra tones to the right hand.</p>';
    if (r.warning) html += '<p class="music-small">Catalog note: ' + M.esc(r.warning) + "</p>";
    return html + "</section>";
  }

  function chordCard(model) {
    var voices = Model.voices(model);
    var html =
      '<section class="wb-chord-panel" aria-labelledby="wb-chord-title"><div class="wb-section-heading">' +
      '<h2 id="wb-chord-title" class="recognizer-chord-name">' +
      M.esc(model.name) +
      '</h2><span class="music-small">' +
      M.esc(model.roman || (model.notes[0] !== model.root ? M.noteName(model.notes[0]) + " in the bass" : "Root position")) +
      "</span></div>";
    html +=
      '<div class="wb-representations"><section class="wb-notation" aria-label="Notes and notation"><h3>Notes on the staff</h3>' +
      '<div class="wb-note-list">';
    voices.forEach(function (v, i) {
      html += button(
        M.esc(v.name.replace(/b/g, "♭").replace(/#/g, "♯")) + "<small>" + (i === 0 ? "bass" : v.octave) + "</small>",
        'data-pc="' + v.pc + '" data-midi="' + v.midi + '" aria-label="Hear ' + M.esc(v.name) + v.octave + '"',
        "wb-note"
      );
    });
    html +=
      '</div><div class="wb-staff-scroll">' +
      Diagrams.staff(model) +
      '</div><p class="music-small">Read left to right. Focus or hover a note to find it on the buttons.</p></section>' +
      '<section class="wb-map" aria-label="Bayan pitch map"><h3>Right hand · B-system</h3>' +
      Diagrams.keyboard(model) +
      '<p class="music-small">Higher notes at the top. Outlined buttons are this voicing; the double ring marks its root. Press a button to hear it.</p></section></div>' +
      recipe(model);
    html += keyBar();
    html += '<details class="workbench-disclosure wb-theory"' + (state.theory ? " open" : "") + "><summary>Theory &amp; other readings</summary>";
    if (model.detail) {
      html += '<dl class="wb-theory-grid"><dt>Intervals</dt><dd>';
      model.detail.notes.forEach(function (n, i) {
        html += '<span data-pc="' + Tonal.Note.chroma(n) + '">' + M.esc(model.detail.intervals[i]) + "</span> ";
      });
      html += "</dd><dt>Semitones from root</dt><dd>" + M.esc(model.detail.semitones.join(" · ")) + "</dd></dl>";
    } else html += '<p class="music-small">No single chord name fits this collection. You can still hear, transpose, and save it.</p>';
    if (model.alternatives && model.alternatives.length) {
      html += '<p class="music-small">Other names depend on musical context:</p><div class="workbench-hint">';
      model.alternatives.forEach(function (name) {
        html += button(M.esc(name), 'data-chord="' + M.esc(name) + '"');
      });
      html += "</div>";
    }
    return (
      html +
      '<p class="music-small">Playback uses an ascending close voicing. Real accordion registers and omitted chord tones vary by instrument.</p></details></section>'
    );
  }

  function render() {
    var model = current();
    var focused = document.activeElement;
    var focusSelector = null;
    if (result.contains(focused) || document.getElementById("workbench-matrix").contains(focused)) {
      ["data-step", "data-wbkey", "data-action", "data-suffix"].some(function (attr) {
        if (!focused.hasAttribute(attr)) return false;
        focusSelector = "[" + attr + "=" + JSON.stringify(focused.getAttribute(attr)) + "]";
        return true;
      });
    }
    result.innerHTML = model ? progression() + chordCard(model) : "";
    document.getElementById("workbench-transport").hidden = !model;
    document.getElementById("workbench-save-options").hidden = !model;
    document.getElementById("workbench-play").textContent = Player.isPlaying() ? "Stop" : state.items.length > 1 ? "Play progression" : "Hear chord";
    document.getElementById("workbench-tempo").hidden = state.items.length < 2;
    document.getElementById("workbench-roll").hidden = state.items.length > 1;
    renderMatrix();
    if (focusSelector) {
      var target = root.querySelector(focusSelector);
      if (target) target.focus({ preventScroll: true });
    }
  }

  async function play(options) {
    if (!current()) return;
    options = options || {};
    var models = options.single ? [current()] : state.items;
    var started = await Player.play(
      models.map(function (model) {
        return Model.voices(model).map(function (v) {
          return v.midi;
        });
      }),
      {
        bpm: state.bpm,
        roll: options.roll,
        loop: state.loop && models.length > 1,
        progression: models.length > 1,
        onError: announce,
        onStep: function (index) {
          if (models.length > 1) {
            state.index = index;
            render();
          }
        },
      }
    );
    if (started) {
      document.getElementById("workbench-play").textContent = "Stop";
      announce("Playing with a synthesized tone.");
    } else if (Player.isMuted()) announce("Sound is muted. Unmute to play.");
  }

  async function playNotes(midis) {
    var started = await Player.play([midis], { onError: announce });
    if (started) document.getElementById("workbench-play").textContent = "Stop";
    else if (Player.isMuted()) announce("Sound is muted. Unmute to play.");
  }

  function highlight(pcs) {
    root.querySelectorAll("[data-pc]").forEach(function (el) {
      el.classList.toggle("is-linked", pcs.indexOf(Number(el.dataset.pc)) >= 0);
    });
  }

  function readSaved() {
    try {
      state.saved = Model.savedItems(localStorage.getItem(KEY));
      state.storageError = "";
    } catch (_) {
      state.saved = [];
      state.storageError = "Saved practice could not be read. Existing data has not been changed.";
    }
  }
  function persist() {
    if (state.storageError) {
      announce(state.storageError);
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state.saved));
      return true;
    } catch (_) {
      announce("Storage is unavailable. Your changes remain in this tab; export a backup before closing it.");
      return false;
    }
  }
  function renderSaved() {
    var aside = document.getElementById("workbench-setlist");
    aside.style.display = "";
    var html =
      '<details id="wb-saved-drawer"' +
      (state.drawer ? " open" : "") +
      '><summary>Saved practice <span class="music-small">' +
      state.saved.length +
      '</span></summary><p class="music-small">Stored only in this browser. Earlier Stradella songs are kept separately.</p>';
    if (state.storageError) html += '<p class="wb-warning">' + state.storageError + "</p>";
    if (!state.saved.length && !state.storageError) html += '<p class="music-small">Save a chord or progression to return to it later.</p>';
    html += '<ol class="wb-saved-list">';
    state.saved.forEach(function (item, i) {
      html +=
        "<li>" +
        button(M.esc(item.name), 'data-load="' + i + '"', "wb-saved-load") +
        button("Remove", 'data-remove="' + i + '" aria-label="Remove ' + M.esc(item.name) + '"', "music-share-btn") +
        "</li>";
    });
    html +=
      '</ol><div class="workbench-hint">' +
      button("Export practice", 'data-action="export"', "music-share-btn") +
      '<label class="wb-import">Import backup<input type="file" id="wb-import" accept=".json,application/json"></label></div></details>';
    aside.innerHTML = html;
  }
  function saveCurrent() {
    if (!current() || state.storageError) return announce(state.storageError || "Choose a chord first.");
    var name = document.getElementById("workbench-save-name").value.trim();
    state.saved.push({
      name:
        name ||
        state.label ||
        state.items
          .map(function (m) {
            return m.name;
          })
          .join(" · "),
      chords: state.items.map(Model.entry),
      key: state.key,
      bpm: state.bpm,
    });
    var saved = persist();
    state.drawer = true;
    renderSaved();
    if (saved) announce("Practice saved in this browser.");
  }
  function exportSaved() {
    var blob = new Blob([JSON.stringify(state.saved, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "bayan-practice.json";
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  async function share() {
    if (!current()) return;
    var url = new URL(root.dataset.musicHome, location.origin);
    url.searchParams.set("chords", JSON.stringify(state.items.map(Model.entry)));
    url.searchParams.set("key", String(state.key));
    url.searchParams.set("step", String(state.index));
    url.searchParams.set("bpm", String(state.bpm));
    var field = document.getElementById("workbench-share-url");
    field.value = url.href;
    document.getElementById("workbench-share-result").hidden = false;
    try {
      await navigator.clipboard.writeText(url.href);
      announce("Link copied. It contains these chords, not your saved library.");
    } catch (_) {
      field.focus();
      field.select();
      announce("Select and copy the link below.");
    }
  }
  function restoreLink() {
    var params = new URLSearchParams(location.search);
    var payload = params.get("chords");
    if (!payload) return false;
    try {
      if (payload.length > 30000) throw new Error("Link too large.");
      var entries = JSON.parse(payload);
      var saved = Model.savedItems(JSON.stringify([{ name: "Shared progression", chords: entries }]));
      var items = saved[0].chords.map(Model.restore);
      if (
        items.some(function (m) {
          return !m;
        })
      )
        throw new Error("Invalid chord.");
      var key = Number(params.get("key")),
        step = Number(params.get("step"));
      var bpm = Number(params.get("bpm"));
      state.bpm = Number.isFinite(bpm) && bpm >= 40 && bpm <= 200 ? bpm : 96;
      document.getElementById("workbench-bpm").value = state.bpm;
      selectItems(items, {
        syncInput: true,
        key: params.has("key") && Number.isInteger(key) && key >= 0 && key < 12 ? key : items[0].root,
        index: Number.isInteger(step) && step >= 0 ? step : 0,
      });
      return true;
    } catch (_) {
      classify("Am7");
      announce("This shared link is invalid. Showing the default chord instead.");
      return true;
    }
  }

  function renderLibrary() {
    var html = '<span class="workbench-hint-label">Progressions</span>';
    presets.forEach(function (p) {
      html += button(p.label, 'data-preset="' + p.id + '"');
    });
    (window.MusicExercises || []).forEach(function (ex) {
      html += button(M.esc(ex.title), 'data-exercise="' + M.esc(ex.id) + '"');
    });
    html += button("Notation draft", 'data-action="sheet"');
    html += button("All chord types", 'data-action="matrix" aria-expanded="' + state.matrix + '"');
    document.getElementById("workbench-library").innerHTML = html;
  }
  function renderMatrix() {
    var container = document.getElementById("workbench-matrix");
    container.style.display = state.matrix ? "" : "none";
    if (!state.matrix) return;
    var model = current(),
      rootPc = model ? model.root : 0;
    var html =
      '<div class="workbench-card"><h2>Chord types on ' +
      M.esc(M.noteName(rootPc)) +
      "</h2>" +
      '<p class="music-small">Compare a different quality on the same root.</p><div class="wb-table-scroll" tabindex="0" role="region" aria-label="Chord type table">' +
      '<table class="workbench-matrix-table"><thead><tr><th scope="col">Extension</th>';
    S.GRID_COLS.forEach(function (q) {
      html += '<th scope="col">' + M.esc(q) + "</th>";
    });
    html += "</tr></thead><tbody>";
    S.GRID_ROWS.forEach(function (ext) {
      html += '<tr><th scope="row">' + ext + "</th>";
      S.GRID_COLS.forEach(function (quality) {
        html += "<td>";
        var seen = {};
        S.CHORDS.forEach(function (c) {
          if (c.extension !== ext || c.quality !== quality || c.bug || seen[c.suffix]) return;
          seen[c.suffix] = true;
          if (!Model.fromSuffix(rootPc, c.suffix)) return;
          html += button(M.esc(c.suffix || "major"), 'data-suffix="' + M.esc(c.suffix) + '"', "workbench-matrix-cell");
        });
        html += "</td>";
      });
      html += "</tr>";
    });
    container.innerHTML = html + "</tbody></table></div></div>";
  }
  function openSheet(text) {
    Player.stop();
    state.sheet = true;
    var panel = document.getElementById("workbench-sheet");
    panel.hidden = false;
    panel.style.display = "";
    panel.innerHTML =
      '<div class="workbench-card"><div class="wb-section-heading"><h2>Notation draft</h2>' +
      button("Close", 'data-action="close-sheet"', "music-share-btn") +
      "</div>" +
      '<label for="wb-abc">ABC notation</label><textarea id="wb-abc" class="workbench-sheet-text" rows="4" maxlength="10000" spellcheck="false"></textarea>' +
      '<div id="wb-abc-render" class="workbench-sheet-render"></div><p class="music-small">A notation scratchpad, not automatic harmonization. Enter a chord above to study its voicing.</p></div>';
    var ta = document.getElementById("wb-abc");
    ta.value = text || "C E G c | d2 B2 | c4";
    function draw() {
      try {
        var abc = /^[XK]:/m.test(ta.value) ? ta.value : "X:1\nM:4/4\nL:1/4\nK:C\n" + ta.value;
        ABCJS.renderAbc("wb-abc-render", abc, { responsive: "resize" });
      } catch (_) {
        document.getElementById("wb-abc-render").textContent = "Check the ABC syntax.";
      }
    }
    ta.addEventListener("input", draw);
    draw();
  }

  function transpose(key) {
    var index = state.index;
    var items = state.degrees
      ? state.degrees.map(function (d) {
          return Model.fromDegree(d, key);
        })
      : state.items.map(function (m) {
          return Model.transpose(m, Model.mod(key - state.key));
        });
    selectItems(items, { key: key, index: index, degrees: state.degrees, label: state.label, syncInput: true });
  }

  root.addEventListener("click", function (e) {
    var el = e.target.closest("button");
    var note = e.target.closest("[data-midi]");
    if (note) {
      var midi = Number(note.dataset.midi);
      playNotes([midi]);
      highlight([midi % 12]);
      return;
    }
    if (!el) return;
    if (el.hasAttribute("data-sound")) {
      playNotes(el.dataset.sound.split(",").map(Number));
      highlight(el.dataset.pcs.split(",").map(Number));
      return;
    }
    if (el.dataset.example) {
      input.value = el.dataset.example;
      classify(input.value);
      return;
    }
    if (el.dataset.chord) {
      input.value = el.dataset.chord;
      classify(input.value);
      return;
    }
    if (el.hasAttribute("data-step")) {
      Player.stop();
      state.index = Number(el.dataset.step);
      render();
      return;
    }
    if (el.hasAttribute("data-wbkey")) return transpose(Number(el.dataset.wbkey));
    if (el.hasAttribute("data-suffix"))
      return selectItems([Model.fromSuffix(current() ? current().root : 0, el.dataset.suffix)], { syncInput: true });
    if (el.dataset.preset) {
      var p = presets.find(function (item) {
        return item.id === el.dataset.preset;
      });
      return selectItems(
        p.degrees.map(function (d) {
          return Model.fromDegree(d, 0);
        }),
        { key: 0, degrees: p.degrees, label: p.label, syncInput: true }
      );
    }
    if (el.dataset.exercise) {
      var ex = (window.MusicExercises || []).find(function (item) {
        return item.id === el.dataset.exercise;
      });
      return selectItems(
        ex.progression.map(function (step) {
          var c = S.chordById(step.id),
            pc = Model.mod(ex.default_key + step.offset);
          var model = Model.fromSuffix(pc, c.suffix, step.roman);
          if (c.recipe && c.recipe.bass) {
            var bass = Model.mod(pc + c.recipe.bass);
            model = Model.fromName(model.name + "/" + M.asciiNoteName(bass));
            model.roman = step.roman;
          }
          return model;
        }),
        { key: ex.default_key, label: ex.title, syncInput: true }
      );
    }
    if (el.hasAttribute("data-load")) {
      var item = state.saved[Number(el.dataset.load)];
      state.bpm = item.bpm || 96;
      document.getElementById("workbench-bpm").value = state.bpm;
      return selectItems(item.chords.map(Model.restore), { label: item.name, key: item.key, syncInput: true });
    }
    if (el.hasAttribute("data-remove")) {
      state.saved.splice(Number(el.dataset.remove), 1);
      persist();
      renderSaved();
      return;
    }
    if (el.dataset.action === "export") return exportSaved();
    if (el.dataset.action === "matrix") {
      state.matrix = !state.matrix;
      renderLibrary();
      renderMatrix();
      root.querySelector('[data-action="matrix"]').focus({ preventScroll: true });
      return;
    }
    if (el.dataset.action === "sheet") return openSheet();
    if (el.dataset.action === "close-sheet") {
      state.sheet = false;
      document.getElementById("workbench-sheet").hidden = true;
      if (root.querySelector(".wb-library").open) root.querySelector('[data-action="sheet"]').focus({ preventScroll: true });
      else input.focus({ preventScroll: true });
      return;
    }
  });
  root.addEventListener("keydown", function (e) {
    var note = e.target.closest("g[data-midi]");
    if (note && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      note.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    if (e.key === "Escape") Player.stop();
  });
  BayanKeyboard.bind(result, {});
  ["pointerover", "focusin"].forEach(function (event) {
    root.addEventListener(event, function (e) {
      var el = e.target.closest("[data-pc], [data-pcs]");
      if (el) highlight(el.dataset.pcs ? el.dataset.pcs.split(",").map(Number) : [Number(el.dataset.pc)]);
    });
  });
  ["pointerout", "focusout"].forEach(function (event) {
    root.addEventListener(event, function (e) {
      if (e.target.closest("[data-pc], [data-pcs]")) highlight([]);
    });
  });
  root.addEventListener(
    "toggle",
    function (e) {
      if (e.target.id === "wb-saved-drawer") state.drawer = e.target.open;
      if (e.target.classList.contains("wb-theory")) state.theory = e.target.open;
    },
    true
  );
  root.addEventListener("change", async function (e) {
    if (e.target.id !== "wb-import") return;
    var file = e.target.files[0];
    if (!file) return;
    try {
      if (state.storageError || file.size > 200000) throw new Error("Invalid import.");
      var imported = Model.savedItems(await file.text());
      if (imported.length > 100) throw new Error("Too many items.");
      state.saved = state.saved.concat(imported);
      var saved = persist();
      state.drawer = true;
      renderSaved();
      if (saved) announce("Imported practice. Existing items were kept.");
    } catch (_) {
      announce("Could not import this backup. Use a valid practice export under 200 KB; existing data was kept.");
    }
  });
  input.addEventListener("input", function () {
    classify(input.value);
  });
  document.getElementById("workbench-play").addEventListener("click", function () {
    if (Player.isPlaying()) Player.stop();
    else play();
  });
  document.getElementById("workbench-roll").addEventListener("click", function () {
    play({ single: true, roll: true });
  });
  document.getElementById("workbench-mute").addEventListener("click", function (e) {
    var muted = Player.mute();
    e.currentTarget.textContent = muted ? "Unmute" : "Mute";
    e.currentTarget.setAttribute("aria-pressed", String(muted));
    announce(muted ? "Sound muted." : "Sound enabled. Nothing plays until you press a note or play button.");
  });
  document.getElementById("workbench-bpm").addEventListener("change", function (e) {
    state.bpm = Math.max(40, Math.min(200, Number(e.target.value) || 96));
    e.target.value = state.bpm;
    Player.stop();
  });
  document.getElementById("workbench-loop").addEventListener("change", function (e) {
    state.loop = e.target.checked;
    Player.stop();
  });
  document.getElementById("workbench-save").addEventListener("click", saveCurrent);
  document.getElementById("workbench-share").addEventListener("click", share);
  Player.onStop(function () {
    document.getElementById("workbench-play").textContent = state.items.length > 1 ? "Play progression" : "Hear chord";
  });
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) {
      readSaved();
      renderSaved();
    }
  });
  readSaved();
  renderSaved();
  renderLibrary();
  if (!restoreLink()) classify(input.value || "Am7");
})();
