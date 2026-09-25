/* All sources prepare candidates; the host owns persistence and instrument playback. */
window.ProgressionComposer = {
  mount(root, options) {
    "use strict";
    options = options || {};
    const H = window.ComposerHarmony;
    const M = window.WorkbenchModel;
    const Player = window.WorkbenchPlayer;
    const $ = (id) => root.querySelector("#" + id);
    const esc = window.Music.esc;
    const doc = H.createDocument();
    const sources = ["key", "matrix", "type", "notes", "transitions", "patterns"];
    let source = "key";
    let candidate = [];
    let origin = "";
    let picked = [];
    let matches = [];
    let transitionAnchor = null;
    let audioGeneration = 0;
    const selected = () => doc.state.chords[doc.state.selected];
    const announce = (text) => {
      $("announcement").textContent = text;
    };
    const notes = (chord) => chord.notes.map((pc) => H.spell(chord, pc)).join(" · ");
    const button = (text, attrs = "", cls = "") => '<button type="button" class="' + cls + '" ' + attrs + ">" + text + "</button>";
    const choiceButton = (chord, detail = "") =>
      button(
        "<strong>" + esc(H.pretty(chord.name)) + "</strong><small>" + esc(detail || H.numeral(chord, doc.state.key)) + "</small>",
        'data-chord="' + esc(chord.name) + '"',
        "choice"
      );

    ["key-tonic", "transpose-tonic", "matrix-root"].forEach((id) => {
      $(id).innerHTML = H.roots.map((root) => '<option value="' + root + '">' + H.pretty(root) + "</option>").join("");
    });
    $("matrix-root").value = "C";
    const grid = window.ChordGrid.mount($("sequence"), {
      error: $("grid-error"),
      more: $("grid-more"),
      describe: (chord) => H.numeral(chord, doc.state.key),
      onStart(cell) {
        Player.stop();
        const index = doc.state.chords.findIndex((chord) => chord.gridCell === cell);
        if (index >= 0) doc.select(index);
        else {
          const following = doc.state.chords.findIndex((chord) => chord.gridCell > cell);
          doc.setGap(following < 0 ? doc.state.chords.length : following);
          $("intent").value = "insert";
        }
        renderFunction();
        renderCandidate();
        options.onRender?.(doc.state);
        options.onChange?.(doc.state);
      },
      onCommit(cell, chord) {
        if (!doc.putCell(cell, chord)) return false;
        transitionAnchor = null;
        afterEdit(chord.name + " added, four beats. Keep typing in the next space.");
        return true;
      },
      onMove(index, cell) {
        if (doc.moveToCell(index, cell)) {
          transitionAnchor = null;
          afterEdit("Chord moved. Playback follows the grid from left to right, then down.");
        }
      },
      onRemove(index) {
        doc.select(index);
        doc.remove();
        afterEdit("Chord removed. Its cell stays available for typing.");
      },
      onHistory(action) {
        doc[action]();
        afterEdit(action === "undo" ? "Change undone." : "Change restored.");
      },
    });

    function renderSequence() {
      const { chords, selected: index, gap, key } = doc.state;
      let html = "";
      for (let i = 0; i <= chords.length; i++) {
        const label = !chords.length
          ? "Start here"
          : i === 0
            ? "Insert before the first chord"
            : i === chords.length
              ? "Insert at the end"
              : "Insert between " + chords[i - 1].name + " and " + chords[i].name;
        html += button(
          chords.length ? "+" : "Start here",
          'data-gap="' + i + '" aria-label="' + esc(label) + '" aria-pressed="' + (i === gap && $("intent").value === "insert") + '"',
          "gap"
        );
      }
      $("sequence-gaps").innerHTML = html;
      grid.render(chords, index);
      $("position-hint").textContent = chords.length
        ? "Selected: step " + (index + 1) + " of " + chords.length + ". Edit its tile to change the chord."
        : "No chords yet. Click a cell and type the first chord.";
      $("earlier").disabled = !chords.length || index === 0;
      $("later").disabled = !chords.length || index === chords.length - 1;
      $("remove").disabled = $("hear-progression").disabled = !chords.length;
      $("undo").disabled = !doc.canUndo;
      $("redo").disabled = !doc.canRedo;
      $("key-tonic").value = key.tonic;
      $("key-mode").value = key.mode;
      $("transpose-tonic").value = key.tonic;
    }

    function renderFunction() {
      const { chords, selected: index, key } = doc.state;
      const chord = selected();
      if (!chord) {
        $("function-chord").textContent = "A place to listen and compare";
        $("function-heading").textContent = "What will the first chord establish?";
        $("function-copy").textContent = "Choose a key as a frame of reference, then try a tonic or start somewhere less settled.";
        $("function-outside").textContent = "";
        $("function-listening").innerHTML = "";
        return;
      }
      const reading = H.explain(chord, key, chords[index - 1], chords[index + 1]);
      $("function-chord").textContent = H.pretty(chord.name) + " · " + reading.roman + " in " + H.keyName(key);
      $("function-heading").textContent = reading.role;
      $("function-copy").textContent = reading.text;
      $("function-outside").textContent = reading.outside.length
        ? "Outside " +
          (key.mode === "minor" ? "natural minor" : "the major scale") +
          ": " +
          reading.outside.map((pc) => H.spell(chord, pc)).join(" · ") +
          ". Chromatic notes are allowed."
        : "";
      let html = button("Hear selected chord", 'data-listen="selected"');
      const resolve = H.resolution(chord, key);
      if (resolve) {
        html += button(esc(H.pretty(chord.name + " → " + resolve.target.name)), 'data-listen="resolve"');
        html += button(esc(H.pretty(chord.name + " → " + resolve.alternative.name)), 'data-listen="deceptive"');
        html += button(esc("Hear " + resolve.label), 'data-listen="tones"');
      }
      const dominantNext = chords[index + 1] && H.resolution(chords[index + 1], key);
      if (reading.role === "Predominant" && dominantNext) {
        const alternative = H.diatonic(key, "triads")[3];
        html += button(esc("Compare " + chord.name + " / " + alternative.name + " → " + chords[index + 1].name), 'data-listen="prepare"');
        html += button(esc("Try " + alternative.name + " instead"), 'data-prepare="' + esc(alternative.name) + '"');
      }
      if (!resolve && !dominantNext && chords[index - 1]) html += button("Hear the arrival", 'data-listen="arrival"');
      $("function-listening").innerHTML = html;
    }

    function renderCandidate() {
      const key = doc.state.key;
      const intent = $("intent").value;
      const position = intent === "replace" ? doc.state.selected : doc.state.gap;
      const before = doc.state.chords[position - 1];
      const after = doc.state.chords[position + (intent === "replace" ? 1 : 0)];
      $("candidate-heading").textContent = candidate.length ? candidate.map((chord) => H.pretty(chord.name)).join(" → ") : "Nothing chosen yet";
      $("mobile-candidate").hidden = !candidate.length;
      $("mobile-candidate").textContent =
        candidate.length === 1 ? "Review " + H.pretty(candidate[0].name) + " ↓" : "Review " + candidate.length + " chords ↓";
      $("candidate-notes").textContent =
        candidate.length === 1
          ? notes(candidate[0])
          : candidate.length
            ? candidate.length + " chords, ready as a phrase."
            : "Choose a chord from any of the six views.";
      $("candidate-analysis").textContent =
        candidate.length === 1
          ? (() => {
              const reading = H.explain(candidate[0], key, before, after);
              return reading.roman + " · " + reading.role + ". " + reading.text;
            })()
          : candidate.map((chord) => H.numeral(chord, key)).join(" → ");
      $("candidate-origin").textContent = origin;
      $("candidate-destination").textContent =
        intent === "replace"
          ? selected()
            ? "Replace step " + (doc.state.selected + 1) + ": " + H.pretty(selected().name) + "."
            : "Select a chord to replace."
          : "Gap " +
            (doc.state.gap + 1) +
            ": " +
            (before ? "after " + H.pretty(before.name) : "at the beginning") +
            (after ? ", before " + H.pretty(after.name) : "") +
            ".";
      const preview = candidate.length ? H.context(doc.state, candidate, intent) : [];
      $("candidate-route").textContent = preview.map((chord) => H.pretty(chord.name)).join(" → ");
      $("candidate-relation").textContent = "";
      if (candidate.length && before) {
        const relation = H.transition(before, candidate[0]);
        $("candidate-relation").textContent =
          relation.movement +
          ". Shared pitch classes: " +
          (relation.common.join(" · ") || "none") +
          ". This does not choose a voice-leading pattern.";
      }
      const invalidReplace = intent === "replace" && (candidate.length !== 1 || !selected());
      const overLimit = doc.state.chords.length + candidate.length - (intent === "replace" ? 1 : 0) > 128;
      $("commit").disabled = !candidate.length || invalidReplace || overLimit;
      $("hear-candidate").disabled = !candidate.length;
      $("hear-context").disabled = !candidate.length || invalidReplace;
      $("commit").textContent =
        intent === "replace" ? "Replace selected chord" : "Insert " + (candidate.length > 1 ? candidate.length + " chords" : "candidate");
      $("commit-help").textContent = overLimit
        ? "Keep the progression within 128 chords."
        : invalidReplace && candidate.length > 1
          ? "A phrase inserts at a gap. Replacement accepts one chord."
          : "Nothing changes until you press " + (intent === "replace" ? "Replace" : "Insert") + ". Undo is always available afterward.";
    }

    function renderKey() {
      const key = doc.state.key;
      const size = $("chord-size").value;
      $("collection-field").hidden = key.mode !== "minor";
      $("key-summary").textContent =
        H.keyName(key) +
        (key.mode === "minor" ? ", " + $("minor-collection").selectedOptions[0].textContent.toLowerCase() : "") +
        ". Select a degree to see what it might do at your chosen position.";
      $("key-chords").innerHTML = H.diatonic(key, size, $("minor-collection").value)
        .map((chord) => {
          const reading = H.explain(chord, key);
          return choiceButton(chord, reading.roman + " · " + reading.role);
        })
        .join("");
      const parallel = H.diatonic({ ...key, mode: key.mode === "major" ? "minor" : "major" }, size);
      const current = H.diatonic(key, size);
      let extra = parallel
        .filter((chord) => !current.some((other) => other.name === chord.name))
        .map((chord) => choiceButton(chord, "Parallel " + (key.mode === "major" ? "minor" : "major")));
      current
        .filter(
          (chord) => chord.root !== window.Tonal.Note.chroma(key.tonic) && ["Major", "Minor"].includes(window.Tonal.Chord.get(chord.name).quality)
        )
        .forEach((chord) => {
          const root = window.Tonal.Note.transpose(chord.detail.notes[0], "5P");
          const dominant = M.fromName(root + "7");
          extra.push(choiceButton(dominant, "V7 of " + H.pretty(chord.name)));
        });
      $("extra-chords").innerHTML = extra.join("");
    }

    function renderMatrix() {
      const entries = H.catalog($("matrix-root").value, $("matrix-scope").value === "all");
      $("matrix").innerHTML =
        '<caption class="sr-only">Chord types on ' +
        esc($("matrix-root").value) +
        '</caption><thead><tr><th scope="col">Extension</th>' +
        H.families.map((family) => '<th scope="col">' + family + "</th>").join("") +
        "</tr></thead><tbody>" +
        H.extensions
          .map(
            (ext) =>
              '<tr><th scope="row">' +
              ext +
              "</th>" +
              H.families
                .map(
                  (family) =>
                    "<td>" +
                    entries
                      .filter((entry) => entry.family === family && entry.extension === ext)
                      .map((entry) =>
                        button(esc(H.pretty(entry.chord.name)), 'data-chord="' + esc(entry.chord.name) + '" title="' + esc(entry.description) + '"')
                      )
                      .join("") +
                    "</td>"
                )
                .join("") +
              "</tr>"
          )
          .join("") +
        "</tbody>";
    }

    function renderNotes() {
      $("note-picker").innerHTML = H.roots
        .map((root, pc) => button(H.pretty(root), 'data-pc="' + pc + '" aria-pressed="' + picked.includes(pc) + '"'))
        .join("");
      $("note-bass").innerHTML = picked.map((pc) => '<option value="' + pc + '">' + H.pretty(H.roots[pc]) + "</option>").join("");
      $("note-bass").disabled = !picked.length;
      $("note-bass").value = String(picked[0]);
      $("picked-empty").hidden = !!picked.length;
      $("picked-staff").hidden = $("picked-help").hidden = !picked.length;
      $("hear-picked").disabled = $("hear-picked-order").disabled = $("clear-notes").disabled = !picked.length;
      const model = H.pickedChord(picked);
      const voices = model ? H.voices(model) : [];
      if (model) {
        window.WorkbenchNotation.renderNotation($("picked-staff"), model, {
          voices,
          label: "Picked notes in your chosen order. Activate a note to edit it.",
        });
        $("picked-staff")
          .querySelectorAll("[data-midi]")
          .forEach((note, i) => {
            note.dataset.pickedStaff = i;
            note.setAttribute("aria-label", "Edit note " + (i + 1) + ": " + H.pretty(voices[i].name) + voices[i].octave);
          });
      } else $("picked-staff").textContent = "";
      $("picked-order").innerHTML = voices
        .map((voice, i) => {
          const name = H.pretty(voice.name);
          const options = H.roots
            .map(
              (root, pc) =>
                '<option value="' +
                pc +
                '"' +
                (pc === voice.pc ? " selected" : picked.includes(pc) ? " disabled" : "") +
                ">" +
                H.pretty(root) +
                "</option>"
            )
            .join("");
          const controls = [
            ["earlier", "←", -1],
            ["later", "→", 1],
            ["remove", "Remove", 0],
          ]
            .map(([action, text, delta]) =>
              button(
                text,
                'data-picked-action="' +
                  action +
                  '" data-picked-index="' +
                  i +
                  '" aria-label="' +
                  (action === "remove" ? "Remove " : "Move ") +
                  "note " +
                  (i + 1) +
                  ": " +
                  name +
                  (delta ? " " + action : "") +
                  '"' +
                  (delta && (i + delta < 0 || i + delta >= picked.length) ? " disabled" : "")
              )
            )
            .join("");
          return (
            '<li><span class="picked-number">' +
            (i + 1) +
            '</span><label class="sr-only" for="picked-note-' +
            i +
            '">Note ' +
            (i + 1) +
            (i === 0 ? ", bass" : "") +
            '</label><select id="picked-note-' +
            i +
            '" data-picked-index="' +
            i +
            '">' +
            options +
            '</select><span class="picked-octave">' +
            voice.octave +
            (i === 0 ? " · bass" : "") +
            '</span><div class="actions">' +
            controls +
            "</div></li>"
          );
        })
        .join("");
      matches = H.recognize(picked);
      $("notes-summary").textContent = picked.length
        ? "Bass: " + H.pretty(H.roots[picked[0]]) + ". Choose an interpretation; the same pitches may have more than one name."
        : "No notes selected.";
      $("note-matches").innerHTML = matches
        .map((chord, i) =>
          button(
            "<strong>" +
              esc(H.pretty(chord.name)) +
              "</strong><small>" +
              esc(chord.detail ? "Use this interpretation" : "Keep as a note set") +
              "</small>",
            'data-match="' + i + '"',
            "choice"
          )
        )
        .join("");
    }

    function updatePicked(next, focusId, message) {
      Player.stop();
      picked = next;
      renderNotes();
      prepare([], picked.length ? "Notes changed. Choose an interpretation for this order." : "");
      if (focusId) ($(focusId) || root.querySelector("#note-picker [data-pc]")).focus({ preventScroll: true });
      announce(message);
    }

    function renderTransitions() {
      $("circle").innerHTML = H.fifths
        .map((root, i) => {
          const angle = ((i * 30 - 90) * Math.PI) / 180;
          return button(
            H.pretty(root),
            'data-circle="' +
              root +
              '" aria-label="Prepare ' +
              esc(root + $("circle-quality").value) +
              '" aria-pressed="false" style="left:' +
              (132 + 108 * Math.cos(angle)) +
              "px;top:" +
              (132 + 108 * Math.sin(angle)) +
              'px"'
          );
        })
        .join("");
      $("circle-path").textContent = "Progression roots: " + doc.state.chords.map((item) => H.spell(item, item.root)).join(" → ");
      updateCircle();
      renderRelated();
    }

    function updateCircle() {
      const chord = transitionAnchor || selected();
      root.querySelectorAll("[data-circle]").forEach((el) => {
        const active = chord?.root === window.Tonal.Note.chroma(el.dataset.circle);
        el.classList.toggle("is-anchor", active);
        el.setAttribute("aria-pressed", String(!!transitionAnchor && active));
        el.setAttribute("aria-label", "Prepare " + el.dataset.circle + $("circle-quality").value);
      });
    }

    function renderRelated() {
      const chord = transitionAnchor || selected();
      $("transition-anchor").textContent = chord
        ? "Explore from " +
          H.pretty(chord.name) +
          (transitionAnchor ? ", chosen on the wheel." : ", the selected progression chord.") +
          " Choose another wheel chord to update the comparisons. Insertion still uses the gap or Replace choice."
        : "Choose a wheel chord to compare relationships and prepare your first chord.";
      const kind = $("relation").value;
      const help = {
        resolve:
          "These roots move up a fourth. They are plausible dominant targets only when the source chord and musical context support that reading.",
        common: "Chords from the analysis key, ordered by shared pitch classes. Shared notes alone do not guarantee smooth voice leading.",
        bass: "Keep the chord above a neighboring bass note. A non-chord bass is a slash-chord color, not an inversion.",
        color: "Keep this root and compare chord types. Quality can change function even when the root stays still.",
      };
      $("relation-help").textContent = help[kind];
      $("related-chords").innerHTML = H.related(chord, doc.state.key, kind)
        .map((item) =>
          choiceButton(item, kind === "common" ? H.transition(chord, item).common.length + " shared tones" : H.numeral(item, doc.state.key))
        )
        .join("");
    }

    function chooseWheel(root) {
      transitionAnchor = M.fromName(root + $("circle-quality").value);
      prepare([transitionAnchor], "Root and comparisons chosen on the circle of fifths.");
      updateCircle();
      renderRelated();
    }

    function renderSource() {
      if (source === "key") renderKey();
      if (source === "matrix") renderMatrix();
      if (source === "notes") renderNotes();
      if (source === "transitions") renderTransitions();
      if (source === "patterns")
        $("patterns").innerHTML = H.patterns(doc.state.key)
          .map((pattern) =>
            button(
              "<strong>" +
                esc(pattern.label) +
                "</strong><span>" +
                esc(pattern.chords.map((chord) => H.pretty(chord.name)).join(" → ")) +
                "</span><small>" +
                esc(pattern.description) +
                "</small>",
              'data-pattern="' + pattern.id + '"',
              "choice"
            )
          )
          .join("");
    }

    function render() {
      const focused = document.activeElement;
      const step = focused.dataset.step;
      const gap = focused.dataset.gap;
      renderSequence();
      renderFunction();
      renderSource();
      renderCandidate();
      options.onRender?.(doc.state);
      if (focused.disabled || (!focused.isConnected && document.activeElement === document.body)) {
        const target =
          step !== undefined
            ? root.querySelector('[data-step="' + doc.state.selected + '"]')
            : gap !== undefined
              ? root.querySelector('[data-gap="' + doc.state.gap + '"]')
              : $("tab-" + source);
        (target || $("tab-" + source)).focus({ preventScroll: true });
      }
    }

    function prepare(chords, description) {
      Player.stop();
      candidate = chords;
      origin = description;
      renderCandidate();
      announce(candidate.map((chord) => chord.name).join(", ") + " prepared. Progression unchanged.");
    }

    function changeSource(next, focus = false) {
      Player.stop();
      source = next;
      sources.forEach((name) => {
        $("tab-" + name).setAttribute("aria-selected", String(name === source));
        $("tab-" + name).tabIndex = name === source ? 0 : -1;
        $("panel-" + name).hidden = name !== source;
      });
      renderSource();
      if (focus) $("tab-" + source).focus();
    }

    function afterEdit(message) {
      Player.stop();
      render();
      announce(message);
      options.onChange?.(doc.state);
    }

    Player.subscribeStop(() => {
      audioGeneration++;
      $("stop").disabled = $("candidate-stop").disabled = $("picked-stop").disabled = true;
      root.querySelectorAll(".is-sounding").forEach((el) => el.classList.remove("is-sounding"));
      $("audio-status").textContent = "Stopped. Synthesized chord sketches, not instrument voicings.";
    });

    async function hear(chords, { progression = false, midis = null, labels = null, pickedNotes = false } = {}) {
      const sounds = midis || chords.map((chord) => H.voices(chord).map((voice) => voice.midi));
      if (!sounds.length) return;
      const result = Player.play(sounds, {
        progression,
        bpm: options.bpm?.() || 96,
        onStep: (index) => {
          root.querySelectorAll(".is-sounding").forEach((el) => el.classList.remove("is-sounding"));
          if (progression) root.querySelector('[data-step="' + index + '"]')?.classList.add("is-sounding");
          if (pickedNotes)
            $("picked-staff")
              .querySelectorAll("[data-midi]")
              .forEach((note) => {
                note.classList.toggle("is-sounding", sounds[index].includes(Number(note.dataset.midi)));
              });
          $("audio-status").textContent = "Hearing " + (labels ? labels[index] : H.pretty(chords[index].name)) + ".";
        },
        onError: (message) => {
          $("audio-status").textContent = message;
        },
      });
      const ticket = ++audioGeneration;
      $("stop").disabled = $("candidate-stop").disabled = $("picked-stop").disabled = false;
      options.onPlayback?.(true);
      $("audio-status").textContent = "Preparing audio…";
      if (!(await result) && ticket === audioGeneration) Player.stop();
    }

    root.addEventListener("click", (event) => {
      if (event.target.closest(".composer-hands")) return;
      const el = event.target.closest("button");
      if (!el) return;
      if (el.dataset.step !== undefined) {
        const cell = Number(el.closest("[data-grid-cell]").dataset.gridCell);
        if (grid.editing && !grid.commit()) return;
        Player.stop();
        doc.select(doc.state.chords.findIndex((chord) => chord.gridCell === cell));
        transitionAnchor = null;
        render();
        options.onChange?.(doc.state);
      } else if (el.dataset.gap !== undefined) {
        Player.stop();
        doc.setGap(Number(el.dataset.gap));
        $("intent").value = "insert";
        render();
        options.onChange?.(doc.state);
      } else if (el.dataset.chord)
        prepare(
          [M.fromName(el.dataset.chord)],
          source === "matrix" ? "From the chord catalog." : "From " + $("tab-" + source).textContent.toLowerCase() + "."
        );
      else if (el.dataset.circle) chooseWheel(el.dataset.circle);
      else if (el.dataset.match !== undefined) prepare([matches[Number(el.dataset.match)]], "From selected notes; bass kept explicit.");
      else if (el.dataset.pickedAction) {
        const index = Number(el.dataset.pickedIndex);
        const action = el.dataset.pickedAction;
        const delta = action === "earlier" ? -1 : 1;
        const next = H.editPicked(picked, index, action === "remove" ? "remove" : "move", delta);
        const focus = action === "remove" ? Math.min(index, next.length - 1) : index + delta;
        updatePicked(next, "picked-note-" + focus, "Note order updated. The first note is the bass.");
      } else if (el.dataset.pc !== undefined) {
        const pc = Number(el.dataset.pc);
        updatePicked(picked.includes(pc) ? picked.filter((value) => value !== pc) : [...picked, pc], null, "Picked notes updated.");
        root.querySelector('#note-picker [data-pc="' + pc + '"]').focus({ preventScroll: true });
      } else if (el.dataset.pattern) {
        const pattern = H.patterns(doc.state.key).find((item) => item.id === el.dataset.pattern);
        prepare(pattern.chords, pattern.description);
      } else if (el.dataset.text) {
        $("chord-text").value = el.dataset.text;
        $("type-form").requestSubmit();
      } else if (el.dataset.prepare) {
        $("intent").value = "replace";
        prepare([M.fromName(el.dataset.prepare)], "Alternative preparation for the following dominant.");
      } else if (el.dataset.listen) {
        const chord = selected();
        if (!chord) return;
        const resolution = H.resolution(chord, doc.state.key);
        if (el.dataset.listen === "selected") hear([chord]);
        if (el.dataset.listen === "resolve" && resolution) hear([chord, resolution.target]);
        if (el.dataset.listen === "deceptive" && resolution) hear([chord, resolution.alternative]);
        if (el.dataset.listen === "tones" && resolution)
          hear([], { midis: resolution.midis, labels: ["the dominant’s third and seventh", "their tonic destinations"] });
        if (el.dataset.listen === "arrival") hear([doc.state.chords[doc.state.selected - 1], chord]);
        if (el.dataset.listen === "prepare") {
          const next = doc.state.chords[doc.state.selected + 1];
          hear([chord, next, H.diatonic(doc.state.key, "triads")[3], next]);
        }
      }
    });
    sources.forEach((name) => $("tab-" + name).addEventListener("click", () => changeSource(name)));
    root.querySelector(".source-tabs").addEventListener("keydown", (event) => {
      const index = sources.indexOf(source);
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % sources.length
          : event.key === "ArrowLeft"
            ? (index + sources.length - 1) % sources.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? sources.length - 1
                : null;
      if (next !== null) {
        event.preventDefault();
        changeSource(sources[next], true);
      }
    });
    $("type-form").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const parsed = H.parse($("chord-text").value, doc.state.key);
        $("type-error").hidden = true;
        $("chord-text").removeAttribute("aria-invalid");
        prepare(
          parsed.chords,
          parsed.explicitKey
            ? "Interpreted in " + H.keyName(parsed.key) + ". The progression’s analysis key stays " + H.keyName(doc.state.key) + "."
            : "From typed chords or degrees."
        );
      } catch (error) {
        prepare([], "");
        $("type-error").textContent = error.message;
        $("type-error").hidden = false;
        $("chord-text").setAttribute("aria-invalid", "true");
      }
    });
    $("chord-text").addEventListener("input", () => {
      prepare([], "Press Preview when the phrase is ready.");
      $("type-error").hidden = true;
      $("chord-text").removeAttribute("aria-invalid");
    });
    $("note-bass").addEventListener("change", () => {
      const pc = Number($("note-bass").value);
      updatePicked([pc, ...picked.filter((value) => value !== pc)], "note-bass", "Bass changed. The remaining note order is unchanged.");
    });
    $("clear-notes").addEventListener("click", () => {
      updatePicked([], "picked-note-0", "Picked notes cleared.");
    });
    $("picked-order").addEventListener("change", (event) => {
      const index = Number(event.target.dataset.pickedIndex);
      updatePicked(
        H.editPicked(picked, index, "replace", Number(event.target.value)),
        "picked-note-" + index,
        "Note replaced. Choose an updated interpretation."
      );
    });
    function editStaff(event) {
      const note = event.target.closest("[data-picked-staff]");
      if (!note) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      $("picked-note-" + note.dataset.pickedStaff).focus();
    }
    $("picked-staff").addEventListener("click", editStaff);
    $("picked-staff").addEventListener("keydown", editStaff);
    $("hear-picked").addEventListener("click", () => {
      if (picked.length) hear([H.pickedChord(picked)], { pickedNotes: true });
    });
    $("hear-picked-order").addEventListener("click", () => {
      if (!picked.length) return;
      const voices = H.voices(H.pickedChord(picked));
      hear([], { midis: voices.map((voice) => [voice.midi]), labels: voices.map((voice) => H.pretty(voice.name) + voice.octave), pickedNotes: true });
    });
    $("picked-stop").addEventListener("click", () => Player.stop());
    $("circle-quality").addEventListener("change", () => {
      const chord = transitionAnchor || selected();
      if (chord) chooseWheel(H.fifths.find((root) => window.Tonal.Note.chroma(root) === chord.root));
      else renderTransitions();
    });
    ["chord-size", "minor-collection", "matrix-root", "matrix-scope", "relation"].forEach((id) =>
      $(id).addEventListener("change", () => {
        Player.stop();
        renderSource();
      })
    );
    ["key-tonic", "key-mode"].forEach((id) =>
      $(id).addEventListener("change", () => {
        doc.analyze({ tonic: $("key-tonic").value, mode: $("key-mode").value });
        afterEdit("Analysis key changed. Chord notes unchanged.");
      })
    );
    $("transpose").addEventListener("click", () => {
      if (!grid.commit()) return;
      doc.transpose($("transpose-tonic").value);
      afterEdit("Progression notes transposed. The scratchpad stays unchanged.");
    });
    $("intent").addEventListener("change", () => {
      Player.stop();
      renderSequence();
      renderCandidate();
    });
    $("commit").addEventListener("click", () => {
      if (!grid.commit()) return;
      if (doc.commit(candidate, $("intent").value)) afterEdit("Candidate added. Undo restores the previous progression.");
      else announce("No room at that position. Move a tile or choose another insertion gap.");
    });
    [
      ["earlier", -1],
      ["later", 1],
    ].forEach(([id, delta]) =>
      $(id).addEventListener("click", () => {
        if (!grid.commit()) return;
        doc.move(delta);
        afterEdit("Selected chord moved.");
      })
    );
    [
      ["remove", "remove"],
      ["undo", "undo"],
      ["redo", "redo"],
    ].forEach(([id, action]) =>
      $(id).addEventListener("click", () => {
        if (grid.editing && (id === "undo" || id === "redo")) {
          const dirty = grid.dirty;
          grid.cancel();
          if (dirty) {
            announce("Typing cancelled. The progression is unchanged.");
            return;
          }
        }
        if (!grid.commit()) return;
        doc[action]();
        afterEdit(id === "remove" ? "Selected chord removed." : id === "undo" ? "Change undone." : "Change restored.");
      })
    );
    $("hear-progression").addEventListener("click", () => {
      if (!grid.commit()) return;
      if (options.playProgression) options.playProgression();
      else hear(doc.state.chords, { progression: true });
    });
    $("hear-candidate").addEventListener("click", () => hear(candidate));
    $("hear-context").addEventListener("click", () => hear(H.context(doc.state, candidate, $("intent").value)));
    $("stop").addEventListener("click", () => Player.stop());
    $("candidate-stop").addEventListener("click", () => Player.stop());
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") Player.stop();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.closest("input, textarea, select")) {
        event.preventDefault();
        doc[event.shiftKey ? "redo" : "undo"]();
        afterEdit("History changed.");
      }
    });
    render();
    return {
      get state() {
        return doc.state;
      },
      load(state) {
        Player.stop();
        grid.cancel(false);
        doc.load(state);
        candidate = [];
        transitionAnchor = null;
        render();
      },
      select(index, playing = false) {
        doc.select(index);
        render();
        if (playing) root.querySelector('[data-step="' + index + '"]')?.classList.add("is-sounding");
      },
      setHandChoice(choice) {
        doc.setHandChoice(choice);
        afterEdit("Left-hand choice updated.");
      },
      prepare(chords) {
        prepare(chords, "From the workbench.");
      },
    };
  },
};
