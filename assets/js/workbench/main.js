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
  var DRAFT_KEY = "musicWorkbenchDraft";
  var composer,
    composerNeedsLoad = true,
    draftError = "",
    initializing = true;
  var H = window.ComposerHarmony,
    Hands = window.WorkbenchHands;
  var leftRoots = [11, 4, 9, 2, 7, 0];
  var session = WorkbenchSession.create();
  var state = Object.assign(session.state, {
    saved: [],
    storageError: "",
    drawer: false,
    sheet: false,
    source: "type",
    candidate: [],
    candidateOptions: {},
    picked: [],
    menuRoot: 0,
    menuSuffix: "m7",
  });
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
  function persistDraft() {
    if (initializing || draftError) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(session.snapshot()));
      document.getElementById("wb-draft-status").textContent =
        "Current practice kept in this browser. Save a named copy below to keep another version.";
    } catch (_) {
      draftError = "Draft recovery is unavailable. Keep this tab open and export named practice before leaving.";
      document.getElementById("wb-draft-status").textContent = draftError;
    }
  }
  function composerState() {
    return {
      chords: state.items,
      selected: state.index,
      gap: state.gap,
      key: { tonic: H.roots.includes(state.keyTonic) ? state.keyTonic : H.roots[state.key], mode: state.keyMode || "major" },
    };
  }
  function acceptComposer(next) {
    state.items = next.chords;
    state.index = next.selected;
    state.key = window.Tonal.Note.chroma(next.key.tonic);
    state.keyTonic = next.key.tonic;
    state.keyMode = next.key.mode;
    state.gap = next.gap;
    state.degrees = null;
    state.label = "";
    render();
    persistDraft();
  }
  function renderHands(next) {
    var chord = next.chords[next.selected];
    document.getElementById("chord-inspector").hidden = !chord;
    if (chord) {
      var midis = next.chords.flatMap(function (item) {
        return Model.voices(item).map(function (voice) {
          return voice.midi;
        });
      });
      Hands.render(
        chord,
        {
          left: leftRoots,
          right: {
            low: Math.max(0, Math.floor((Math.min(...midis) - 1) / 3) * 3),
            high: Math.min(127, Math.ceil((Math.max(...midis) + 2) / 3) * 3 - 1),
          },
        },
        chord.handChoice
      );
    }
    var unavailable = next.chords.flatMap(function (item, i) {
      return Hands.performance(item, leftRoots, item.handChoice).midis.length ? [] : ["step " + (i + 1) + " (" + item.name + ")"];
    });
    var warning = document.getElementById("hands-warning");
    warning.hidden = !unavailable.length;
    warning.textContent = unavailable.length
      ? "Both-hand playback unavailable for " +
        unavailable.join(", ") +
        ". No playable left-hand voicing in this excerpt. Chord sketches and right-hand notes still work."
      : "";
    document.getElementById("hear-progression").disabled =
      !next.chords.length || (document.getElementById("composer-sound").value === "hands" && unavailable.length > 0);
  }
  function playbackControls(playing) {
    ["stop", "candidate-stop", "picked-stop", "hand-stop"].forEach(function (id) {
      document.getElementById(id).disabled = !playing;
    });
  }
  async function auditionHand(sound) {
    if (!sound.midis.length) return;
    var started = Player.play([sound.midis], {
      onError: announce,
      onStep: function () {
        Hands.markSounding(sound);
      },
    });
    playbackControls(true);
    if (!(await started)) playbackControls(false);
  }
  async function playComposer() {
    var hands = document.getElementById("composer-sound").value === "hands";
    var sounds = state.items.map(function (chord) {
      return hands
        ? Hands.performance(chord, leftRoots, chord.handChoice)
        : {
            midis: Model.voices(chord).map(function (v) {
              return v.midi;
            }),
            rightMidis: Model.voices(chord).map(function (v) {
              return v.midi;
            }),
            leftIds: [],
          };
    });
    if (
      !sounds.length ||
      sounds.some(function (sound) {
        return !sound.midis.length;
      })
    )
      return;
    var started = Player.play(
      sounds.map(function (sound) {
        return sound.midis;
      }),
      {
        bpm: state.bpm,
        loop: state.loop,
        progression: true,
        onError: announce,
        onStep: function (index) {
          state.index = index;
          composer.select(index, true);
          Hands.markSounding(sounds[index]);
          document.getElementById("audio-status").textContent = "Hearing " + state.items[index].name + (hands ? ", both hands." : ", chord sketch.");
        },
      }
    );
    playbackControls(true);
    if (!(await started)) playbackControls(false);
  }
  function syncComposer() {
    if (!composer) {
      composer = window.ProgressionComposer.mount(document.getElementById("workbench-composer"), {
        onChange: acceptComposer,
        onRender: renderHands,
        onPlayback: playbackControls,
        bpm: function () {
          return state.bpm;
        },
        playProgression: playComposer,
      });
      Hands.bind(auditionHand, function (choice) {
        composer.setHandChoice(choice);
      });
      document.getElementById("play").addEventListener("click", function () {
        var chord = current();
        if (chord) auditionHand(Hands.performance(chord, leftRoots, chord.handChoice));
      });
      document.getElementById("hand-stop").addEventListener("click", function () {
        Player.stop();
      });
      document.getElementById("composer-sound").addEventListener("change", function (event) {
        Player.stop();
        state.sound = event.target.value;
        renderHands(composer.state);
        persistDraft();
      });
      document.getElementById("composer-bpm").addEventListener("change", function (event) {
        Player.stop();
        state.bpm = Math.max(40, Math.min(200, Number(event.target.value) || 96));
        event.target.value = state.bpm;
        persistDraft();
      });
      document.getElementById("composer-loop").addEventListener("change", function (event) {
        Player.stop();
        state.loop = event.target.checked;
        persistDraft();
      });
      Player.subscribeStop(function () {
        playbackControls(false);
        Hands.markSounding();
      });
    }
    document.getElementById("composer-sound").value = state.sound || "chords";
    if (composerNeedsLoad) {
      composerNeedsLoad = false;
      composer.load(composerState());
      state.items = composer.state.chords;
    }
    document.getElementById("composer-bpm").value = state.bpm;
    document.getElementById("composer-loop").checked = state.loop;
  }
  function setInputFromState() {
    state.input = state.items
      .map(function (m) {
        return m.name;
      })
      .join(" ");
    input.value = state.input;
  }
  function selectItems(items, options) {
    Player.stop();
    options = options || {};
    session.set(items, options);
    if (state.mode === "progression") composerNeedsLoad = true;
    if (options.bpm) state.bpm = options.bpm;
    if (options.loop !== undefined) state.loop = options.loop;
    if (options.sound !== undefined) state.sound = options.sound === "hands" ? "hands" : "chords";
    input.removeAttribute("aria-invalid");
    document.getElementById("workbench-share-result").hidden = true;
    if (options.syncInput) {
      if (state.mode === "chord") setInputFromState();
      else input.value = state.input = "";
    }
    if (options.mode) {
      state.candidate = [];
      state.source = "type";
      feedback("");
    }
    render();
    persistDraft();
    announce(current() ? current().name + (state.items.length > 1 ? ", progression of " + state.items.length + " chords." : ".") : "");
  }

  function classify(value) {
    Player.stop();
    state.input = value;
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
      return choose(
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
    if (c.type === "chords") return choose(c.names.map(Model.fromName));
    if (c.type === "recipe") return choose([Model.fromNotes(c.notes, c.notes.buttonRoots)]);
    if (c.type === "notes" || c.type === "note") {
      return choose([Model.fromNotes(M.parseNoteInput(c.tokens ? c.tokens.join(" ") : c.token))]);
    }
    if (c.type === "sheet") {
      feedback("Use the notation scratchpad below for ABC. Your selection has not changed.");
      state.candidate = [];
      candidateActions();
      return;
    }
    state.candidate = [];
    candidateActions();
    var message =
      c.type === "empty"
        ? "Choose a chord or notes. The last valid selection stays visible."
        : c.type === "url"
          ? "Link imports are not supported. Type the notes or chords instead."
          : "That input is not recognized. Try Am7 or C E G. The current selection has not changed.";
    feedback(message);
    if (c.type !== "empty") {
      input.setAttribute("aria-invalid", "true");
    }
  }

  function feedback(message) {
    document.getElementById("wb-selection-feedback").textContent = message || "";
  }
  function candidateActions() {
    document.getElementById("wb-candidate-actions").hidden = state.mode !== "progression" || !state.candidate.length;
    root.querySelector('[data-action="replace"]').disabled = state.candidate.length !== 1 || !current();
  }
  function choose(items, options) {
    items = items.filter(Boolean);
    state.candidate = items;
    state.candidateOptions = options || {};
    input.removeAttribute("aria-invalid");
    candidateActions();
    if (!items.length) return feedback("Pick at least one note.");
    if (state.mode === "chord" && items.length === 1) {
      feedback("");
      if (state.source === "notes") {
        input.value = state.input = items[0].notes.map(M.asciiNoteName).join(" ");
      }
      return selectItems(items, Object.assign({}, options, { syncInput: state.source === "menu" }));
    }
    var names = items
      .map(function (m) {
        return m.name;
      })
      .join(" · ");
    if (state.mode === "progression") return feedback("Ready to add: " + names + ". The sequence is unchanged until you add or replace.");
    feedback("This is a sequence. Open it in Progression view without changing this chord.");
    document
      .getElementById("wb-selection-feedback")
      .insertAdjacentHTML("beforeend", " " + button("Open as progression", 'data-action="open-progression"', "music-share-btn"));
  }
  function switchView(mode) {
    Player.stop();
    state.input = input.value;
    session.switchView(mode);
    // The progression controller keeps its history while the chord view is open.
    state.candidate = [];
    state.source = "type";
    state.picked = [];
    input.value = state.input;
    input.removeAttribute("aria-invalid");
    feedback("");
    render();
    if (state.mode === "progression" && input.value.trim()) classify(input.value);
    announce(mode === "progression" ? "Progression view. Choose a step to inspect." : "Chord and notes view.");
    persistDraft();
  }
  function setSource(source) {
    Player.stop();
    state.source = source;
    state.candidate = [];
    feedback("");
    renderChooser();
    if (source === "type" && state.mode === "progression" && input.value.trim()) classify(input.value);
    if (source === "notes" && state.picked.length) choose([Model.fromNotes(state.picked)]);
  }
  function renderChooser() {
    var isProgression = state.mode === "progression";
    root.querySelectorAll("[data-view]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.view === state.mode));
    });
    root.querySelectorAll("[data-source]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.source === state.source));
      document.getElementById("wb-source-" + button.dataset.source).hidden = button.dataset.source !== state.source;
    });
    root.querySelectorAll("[data-progression-only]").forEach(function (element) {
      element.hidden = !isProgression;
    });
    document.getElementById("wb-progression-library").hidden = !isProgression;
    document.getElementById("wb-input-label").textContent = isProgression ? "Chord or sequence to add" : "Chord name or notes";
    input.placeholder = isProgression ? "Am7 D7 Gmaj7, or 2 5 1 in G" : "Am7 or C E G";
    document.getElementById("wb-chord-transpose").hidden = isProgression;
    document.getElementById("wb-transpose-root").value = state.key;
    candidateActions();
    renderMatrix();
    var picker = document.getElementById("wb-note-picker");
    var focusPc = picker.contains(document.activeElement) ? document.activeElement.dataset.pick : null;
    picker.innerHTML = M.NOTES.map(function (name, pc) {
      return button(
        M.esc(name),
        'data-pick="' + pc + '" aria-pressed="' + (state.picked.indexOf(pc) >= 0) + '"',
        "music-key-btn" + (state.picked.indexOf(pc) >= 0 ? " is-active" : "")
      );
    }).join("");
    if (focusPc != null) picker.querySelector('[data-pick="' + focusPc + '"]').focus({ preventScroll: true });
  }

  function keyBar() {
    var html =
      '<div class="wb-key-select"><span class="music-small">' +
      "Progression key / transpose" +
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
    if (state.mode !== "progression") return "";
    var html =
      '<section class="wb-progression-panel" aria-label="Progression"><div><div class="wb-section-heading">' +
      "<h2>" +
      M.esc(state.label || "Your progression") +
      '</h2><span class="music-small">4 beats per chord · ' +
      M.esc(M.noteName(state.key)) +
      " major reference</span></div>" +
      '<div class="workbench-progression" role="group" aria-label="Progression chords">';
    state.items.forEach(function (item, i) {
      html += button(
        '<span class="music-small">' +
          (i + 1) +
          "</span> " +
          M.esc(item.name) +
          '<span class="workbench-chip-roman">' +
          M.esc(Model.functionInKey(item, state.key)) +
          "</span>",
        'data-step="' + i + '" aria-pressed="' + (i === state.index) + '"',
        "workbench-chip workbench-prog-chip" + (i === state.index ? " is-active" : "")
      );
    });
    html += "</div>";
    if (current()) {
      html +=
        '<div class="wb-sequence-actions">' +
        button("Earlier", 'data-action="earlier"' + (state.index === 0 ? " disabled" : ""), "music-share-btn") +
        button("Later", 'data-action="later"' + (state.index === state.items.length - 1 ? " disabled" : ""), "music-share-btn") +
        button("Remove selected", 'data-action="remove-step"', "music-share-btn") +
        "</div>";
      if (state.index > 0) {
        var before = state.items[state.index - 1],
          model = current();
        var common = model.notes.filter(function (pc) {
          return before.notes.indexOf(pc) >= 0;
        });
        var delta = Model.mod(model.root - before.root);
        var motion = [
          "same root",
          "root up a semitone",
          "root up a tone",
          "root up a minor third",
          "root up a major third",
          "root up a fourth",
          "root moves a tritone",
          "root down a fourth",
          "root down a major third",
          "root down a minor third",
          "root down a tone",
          "root down a semitone",
        ][delta];
        html +=
          '<p class="wb-relationship">' +
          M.esc(
            before.name + " → " + model.name + ": " + motion + ". Common tones: " + (common.length ? common.map(M.noteName).join(", ") : "none") + "."
          ) +
          "</p>";
      } else
        html += '<p class="music-small">Select a step to inspect it. Later steps show root movement and common tones from the preceding chord.</p>';
    } else html += '<p class="music-small">No chords yet. Choose material above, then add it to this progression.</p>';
    html += keyBar() + "</div>";
    if (current()) html += '<details class="wb-fifths"><summary>Circle of fifths</summary>' + circle() + "</details>";
    return html + "</section>";
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
      '<section class="wb-chord-panel" aria-labelledby="wb-chord-title"><p class="wb-inspect-label">' +
      (state.mode === "progression" ? "Inspect step " + (state.index + 1) + " of " + state.items.length : "Inspect selection") +
      '</p><div class="wb-section-heading">' +
      '<h2 id="wb-chord-title" class="recognizer-chord-name">' +
      M.esc(model.name) +
      '</h2><span class="music-small">' +
      M.esc(
        state.mode === "progression"
          ? Model.functionInKey(model, state.key)
          : model.notes[0] !== model.root
            ? M.noteName(model.notes[0]) + " in the bass"
            : model.notes.length > 1
              ? "Root position"
              : "Single note"
      ) +
      "</span></div>";
    html +=
      '<div class="wb-inspector-actions wb-play-actions">' +
      button("Hear chord", 'data-action="hear" id="wb-hear"', "wb-primary") +
      button("Roll upward", 'data-action="roll"', "music-share-btn") +
      button(Player.isMuted() ? "Unmute" : "Mute", 'data-action="mute" aria-pressed="' + Player.isMuted() + '"', "music-share-btn") +
      '<span class="music-small">Synthesized tone</span></div>' +
      '<div class="wb-inspector-grid">' +
      recipe(model) +
      '<section class="wb-right-hand" aria-label="Right hand"><h3>Right hand</h3><div class="wb-right-layout">' +
      '<div class="wb-notation"><p class="music-small">Notes and staff</p>' +
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
      '</div><p class="music-small">Focus or hover a note to find it on the keyboard.</p></div>' +
      '<div class="wb-map"><p class="music-small">B-system · higher notes ↑</p>' +
      Diagrams.keyboard(model) +
      '<p class="music-small">Outlined: voiced notes.<br>Double ring: root.</p></div></div></section>';
    html += '<section class="wb-theory" aria-label="Music theory"><h3>Theory</h3>';
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
      '<p class="music-small">The staff and keyboard show one ascending close voicing, not prescribed fingerings.</p></section></div></section>'
    );
  }

  function render() {
    document.getElementById("workbench-share-result").hidden = true;
    var model = current();
    var focused = document.activeElement;
    var focusSelector = null;
    if (
      result.contains(focused) ||
      document.getElementById("wb-sequence").contains(focused) ||
      document.getElementById("workbench-matrix").contains(focused)
    ) {
      ["data-step", "data-wbkey", "data-action", "data-suffix"].some(function (attr) {
        if (!focused.hasAttribute(attr)) return false;
        focusSelector = "[" + attr + "=" + JSON.stringify(focused.getAttribute(attr)) + "]";
        return true;
      });
    }
    var isProgression = state.mode === "progression";
    root.querySelector(".wb-chooser").hidden = isProgression;
    document.getElementById("workbench-composer").hidden = !isProgression;
    result.innerHTML = isProgression
      ? ""
      : model
        ? chordCard(model)
        : '<p class="wb-empty">Choose material to inspect its left hand, right hand, and theory.</p>';
    document.getElementById("wb-sequence").innerHTML = "";
    document.getElementById("wb-progression-view").hidden = true;
    if (isProgression) syncComposer();
    document.getElementById("workbench-transport").hidden = !model;
    document.getElementById("workbench-save-options").hidden = !model;
    document.getElementById("workbench-bpm").value = state.bpm;
    document.getElementById("workbench-loop").checked = state.loop;
    updatePlayback();
    renderChooser();
    if (focusSelector) {
      var target = root.querySelector(focusSelector);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function updatePlayback() {
    document.getElementById("workbench-play").textContent = Player.isPlaying() ? "Stop" : "Play progression";
    var hear = document.getElementById("wb-hear");
    if (hear) hear.textContent = Player.isPlaying() ? "Stop" : current() && current().notes.length === 1 ? "Hear note" : "Hear chord";
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
        loop: state.loop && state.mode === "progression" && !options.single,
        progression: state.mode === "progression" && !options.single,
        onError: announce,
        onStep: function (index) {
          if (models.length > 1) {
            state.index = index;
            render();
          }
          sounding(
            Model.voices(models[index]).map(function (v) {
              return v.midi;
            })
          );
        },
      }
    );
    if (started) {
      updatePlayback();
      announce("Playing with a synthesized tone.");
    } else if (Player.isMuted()) announce("Sound is muted. Unmute to play.");
  }

  async function playNotes(midis) {
    var started = await Player.play([midis], { onError: announce });
    if (started) {
      updatePlayback();
      sounding(midis);
    } else if (Player.isMuted()) announce("Sound is muted. Unmute to play.");
  }

  function highlight(pcs) {
    root.querySelectorAll("[data-pc]").forEach(function (el) {
      el.classList.toggle("is-linked", pcs.indexOf(Number(el.dataset.pc)) >= 0);
    });
  }
  function sounding(midis) {
    result.querySelectorAll(".bayan-key").forEach(function (button) {
      button.classList.toggle("is-sounding", midis.indexOf(Number(button.dataset.midi)) >= 0);
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
        button(
          M.esc(item.name) + '<span class="music-small"> · ' + (item.mode === "progression" ? "Progression" : "Chord / notes") + "</span>",
          'data-load="' + i + '"',
          "wb-saved-load"
        ) +
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
      keyMode: state.keyMode,
      keyTonic: state.keyTonic,
      gap: state.gap,
      loop: state.loop,
      sound: state.sound,
      bpm: state.bpm,
      mode: state.mode,
      index: state.index,
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
    url.searchParams.set("keyMode", state.keyMode || "major");
    url.searchParams.set("tonic", state.keyTonic || H.roots[state.key]);
    url.searchParams.set("gap", String(state.gap));
    url.searchParams.set("loop", state.loop ? "1" : "0");
    url.searchParams.set("sound", state.sound || "chords");
    url.searchParams.set("step", String(state.index));
    url.searchParams.set("bpm", String(state.bpm));
    url.searchParams.set("view", state.mode);
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
      selectItems(items, {
        syncInput: true,
        mode: params.get("view") === "progression" || items.length > 1 ? "progression" : "chord",
        bpm: Number.isFinite(bpm) && bpm >= 40 && bpm <= 200 ? bpm : 96,
        key: params.has("key") && Number.isInteger(key) && key >= 0 && key < 12 ? key : items[0].root,
        keyMode: params.get("keyMode"),
        keyTonic: params.get("tonic"),
        gap: params.has("gap") ? Number(params.get("gap")) : items.length,
        loop: params.get("loop") === "1",
        sound: params.get("sound"),
        index: Number.isInteger(step) && step >= 0 ? step : 0,
      });
      // Consume the import once: reloading after edits must recover the draft,
      // not replace it again with the original shared progression.
      var currentUrl = new URL(location.href);
      ["chords", "key", "keyMode", "tonic", "step", "bpm", "view", "gap", "loop", "sound"].forEach(function (key) {
        currentUrl.searchParams.delete(key);
      });
      history.replaceState(null, "", currentUrl);
      return true;
    } catch (_) {
      render();
      announce("This shared link is invalid. Your current practice has not been changed.");
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
    document.getElementById("workbench-library").innerHTML = html;
  }
  function renderMatrix() {
    var container = document.getElementById("workbench-matrix");
    if (state.source !== "menu") return;
    var rootPc = state.menuRoot;
    var html =
      '<div class="workbench-card"><h3>Chord types on ' +
      M.esc(M.noteName(rootPc)) +
      "</h3>" +
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
    selectItems(items, { key: key, index: index, degrees: state.degrees, label: state.label, syncInput: state.mode === "chord" });
  }

  root.addEventListener("click", function (e) {
    if (e.target.closest(".progression-composer")) return;
    var el = e.target.closest("button");
    var note = e.target.closest("[data-midi]");
    if (note) {
      var midi = Number(note.dataset.midi);
      playNotes([midi]);
      highlight([midi % 12]);
      return;
    }
    if (!el) return;
    if (el.dataset.view) return switchView(el.dataset.view);
    if (el.dataset.source) return setSource(el.dataset.source);
    if (el.hasAttribute("data-pick")) {
      var pc = Number(el.dataset.pick),
        found = state.picked.indexOf(pc);
      if (found >= 0) state.picked.splice(found, 1);
      else state.picked.push(pc);
      choose(state.picked.length ? [Model.fromNotes(state.picked)] : []);
      return renderChooser();
    }
    if (el.dataset.action === "clear-notes") {
      state.picked = [];
      choose([]);
      return renderChooser();
    }
    if (el.dataset.action === "choose-menu") return choose([Model.fromSuffix(state.menuRoot, state.menuSuffix)]);
    if (el.dataset.action === "open-progression") {
      var pending = state.candidate.slice(),
        pendingOptions = Object.assign({}, state.candidateOptions);
      switchView("progression");
      return selectItems(pending, Object.assign(pendingOptions, { mode: "progression", syncInput: true }));
    }
    if (el.dataset.action === "append" || el.dataset.action === "replace") {
      Player.stop();
      var changed = session.insert(state.candidate, el.dataset.action === "replace");
      render();
      feedback(
        changed
          ? el.dataset.action === "append"
            ? "Added to progression."
            : "Selected chord replaced."
          : "Cannot apply this selection. A progression holds up to 128 chords."
      );
      return;
    }
    if (el.dataset.action === "remove-step" || el.dataset.action === "earlier" || el.dataset.action === "later") {
      Player.stop();
      if (el.dataset.action === "remove-step") session.remove();
      else session.move(el.dataset.action === "earlier" ? -1 : 1);
      render();
      return;
    }
    if (el.dataset.action === "hear") {
      if (Player.isPlaying()) Player.stop();
      else play({ single: true });
      return;
    }
    if (el.dataset.action === "roll") return play({ single: true, roll: true });
    if (el.dataset.action === "mute") {
      var muted = Player.mute();
      el.textContent = muted ? "Unmute" : "Mute";
      el.setAttribute("aria-pressed", String(muted));
      announce(muted ? "Sound muted." : "Sound enabled. Press a note or play button to hear it.");
      return;
    }
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
      var reading = Model.fromName(el.dataset.chord);
      if (state.mode === "progression") {
        choose([reading]);
      } else selectItems([reading], { syncInput: true });
      return;
    }
    if (el.hasAttribute("data-step")) {
      Player.stop();
      state.index = Number(el.dataset.step);
      render();
      return;
    }
    if (el.hasAttribute("data-wbkey")) return transpose(Number(el.dataset.wbkey));
    if (el.hasAttribute("data-suffix")) {
      state.menuSuffix = el.dataset.suffix;
      document.getElementById("wb-menu-quality").value = state.menuSuffix;
      return choose([Model.fromSuffix(state.menuRoot, state.menuSuffix)]);
    }
    if (el.dataset.preset) {
      var p = presets.find(function (item) {
        return item.id === el.dataset.preset;
      });
      return selectItems(
        p.degrees.map(function (d) {
          return Model.fromDegree(d, 0);
        }),
        { mode: "progression", key: 0, degrees: p.degrees, label: p.label, syncInput: true }
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
        { mode: "progression", key: ex.default_key, label: ex.title, syncInput: true }
      );
    }
    if (el.hasAttribute("data-load")) {
      var item = state.saved[Number(el.dataset.load)];
      return selectItems(item.chords.map(Model.restore), {
        label: item.name,
        key: item.key,
        keyMode: item.keyMode,
        keyTonic: item.keyTonic,
        gap: item.gap,
        loop: item.loop,
        sound: item.sound,
        bpm: item.bpm,
        mode: item.mode,
        index: item.index,
        syncInput: true,
      });
    }
    if (el.hasAttribute("data-remove")) {
      state.saved.splice(Number(el.dataset.remove), 1);
      persist();
      renderSaved();
      return;
    }
    if (el.dataset.action === "export") return exportSaved();
    if (el.dataset.action === "sheet") return openSheet();
    if (el.dataset.action === "close-sheet") {
      state.sheet = false;
      document.getElementById("workbench-sheet").hidden = true;
      if (root.querySelector(".wb-scratchpad").open) root.querySelector('[data-action="sheet"]').focus({ preventScroll: true });
      else input.focus({ preventScroll: true });
      return;
    }
  });
  root.addEventListener("keydown", function (e) {
    if (e.target.closest(".progression-composer")) return;
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
      if (e.target.closest(".progression-composer")) return;
      var el = e.target.closest("[data-pc], [data-pcs]");
      if (el) highlight(el.dataset.pcs ? el.dataset.pcs.split(",").map(Number) : [Number(el.dataset.pc)]);
    });
  });
  ["pointerout", "focusout"].forEach(function (event) {
    root.addEventListener(event, function (e) {
      if (e.target.closest(".progression-composer")) return;
      if (e.target.closest("[data-pc], [data-pcs]")) highlight([]);
    });
  });
  root.addEventListener(
    "toggle",
    function (e) {
      if (e.target.id === "wb-saved-drawer") state.drawer = e.target.open;
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
    persistDraft();
  });
  document.getElementById("workbench-play").addEventListener("click", function () {
    if (Player.isPlaying()) Player.stop();
    else play();
  });
  document.getElementById("workbench-bpm").addEventListener("change", function (e) {
    state.bpm = Math.max(40, Math.min(200, Number(e.target.value) || 96));
    e.target.value = state.bpm;
    Player.stop();
    persistDraft();
  });
  document.getElementById("workbench-loop").addEventListener("change", function (e) {
    state.loop = e.target.checked;
    Player.stop();
    persistDraft();
  });
  document.getElementById("workbench-save").addEventListener("click", saveCurrent);
  document.getElementById("workbench-share").addEventListener("click", share);
  Player.onStop(function () {
    updatePlayback();
    sounding([]);
  });
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) {
      readSaved();
      renderSaved();
    }
    if (e.key === DRAFT_KEY) {
      draftError = "Current practice changed in another tab. Reload to use that version; this tab has not overwritten it.";
      document.getElementById("wb-draft-status").textContent = draftError;
    }
  });
  var roots = M.NOTES.map(function (name, pc) {
    return '<option value="' + pc + '">' + M.esc(name) + "</option>";
  }).join("");
  document.getElementById("wb-menu-root").innerHTML = roots;
  document.getElementById("wb-transpose-root").innerHTML = roots;
  var suffixes = [];
  S.CHORDS.forEach(function (chord) {
    if (!chord.bug && suffixes.indexOf(chord.suffix) < 0 && Model.fromSuffix(0, chord.suffix)) suffixes.push(chord.suffix);
  });
  document.getElementById("wb-menu-quality").innerHTML = suffixes
    .map(function (suffix) {
      return '<option value="' + M.esc(suffix) + '">' + M.esc(suffix || "major") + "</option>";
    })
    .join("");
  document.getElementById("wb-menu-quality").value = state.menuSuffix;
  ["wb-menu-root", "wb-menu-quality"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      state.menuRoot = Number(document.getElementById("wb-menu-root").value);
      state.menuSuffix = document.getElementById("wb-menu-quality").value;
      choose([Model.fromSuffix(state.menuRoot, state.menuSuffix)]);
      renderMatrix();
    });
  });
  document.getElementById("wb-transpose-root").addEventListener("change", function (event) {
    transpose(Number(event.target.value));
  });
  readSaved();
  renderSaved();
  renderLibrary();
  var recovered = false;
  try {
    var draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      session.restore(JSON.parse(draft));
      recovered = true;
    }
  } catch (_) {
    draftError = "The practice draft could not be read. Existing data has not been changed; named saved practice remains separate.";
  }
  if (!restoreLink()) {
    if (!recovered) {
      session.switchView("progression");
      state.index = 1;
      state.gap = 2;
    }
    input.value = state.input;
    render();
  }
  initializing = false;
  if (draftError) document.getElementById("wb-draft-status").textContent = draftError;
  else persistDraft();
})();
