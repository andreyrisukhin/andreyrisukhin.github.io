(function () {
  "use strict";
  const M = window.BassPatterns,
    Player = window.BassPatternPlayer,
    $ = (id) => document.getElementById("bp-" + id);
  const store = window.BassPatternStorage.create(() => window.localStorage);
  const imported = M.validate(JSON.parse($("imported").textContent));
  M.examples.push(imported);
  let notebook = store.read() || { version: 1, draft: M.clone(imported), saved: [], active: null };
  let selected = notebook.draft.steps.length ? 0 : -1,
    past = [],
    future = [],
    lastWritten = true;
  let playingButton = null;
  const defaultSound = { presses: [], notes: [M.staffNote(21)] };
  let entrySound = M.clone(defaultSound);
  let entryTicks = notebook.draft.steps[0]?.ticks || 12,
    accidental = 0,
    mode = "note",
    selectedNote = 0;
  const labels = { bass: "Bass", counter: "Counterbass", M: "Major", m: "Minor", 7: "Seventh", d7: "Diminished seventh" };
  function announce(text) {
    $("status").textContent = text;
  }
  function storageStatus() {
    $("storage-error").hidden = !store.error;
    $("storage-error").textContent = store.error;
    $("replace-save").hidden = !store.error;
  }
  function persist(force = false) {
    lastWritten = store.write(notebook, force);
    storageStatus();
    return lastWritten;
  }
  function snapshot() {
    return M.clone({ pattern: notebook.draft, selected, selectedNote, entryTicks, entrySound, active: notebook.active });
  }
  function remember() {
    past.push(snapshot());
    if (past.length > 100) past.shift();
    future = [];
  }
  function edit(change) {
    const next = M.clone(notebook.draft);
    try {
      change(next);
      next.steps = M.reconcile(next.steps, next.meter);
      const valid = M.validate(next);
      if (JSON.stringify(valid) === JSON.stringify(notebook.draft)) return;
      Player.stop();
      remember();
      notebook.draft = valid;
      selected = Math.min(selected, valid.steps.length - 1);
      persist();
      render();
      return true;
    } catch (error) {
      announce(error.message);
      return false;
    }
  }
  function restore(direction) {
    const source = direction === "undo" ? past : future,
      target = direction === "undo" ? future : past;
    if (!source.length) return;
    Player.stop();
    target.push(snapshot());
    const state = source.pop();
    notebook.draft = state.pattern;
    notebook.active = state.active;
    selected = state.selected;
    selectedNote = state.selectedNote;
    entryTicks = state.entryTicks;
    entrySound = state.entrySound;
    persist();
    render();
    announce(direction === "undo" ? "Undone." : "Redone.");
  }
  function option(value, text) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = text;
    return el;
  }
  function library() {
    $("library").replaceChildren(option("", "Current draft"));
    const examples = document.createElement("optgroup");
    examples.label = "Examples";
    M.examples.forEach((pattern, i) => examples.append(option("example:" + i, pattern.title)));
    $("library").append(examples);
    if (notebook.saved.length) {
      const saved = document.createElement("optgroup");
      saved.label = "Saved in this browser";
      notebook.saved.forEach((entry) => saved.append(option(entry.id, entry.pattern.title || "Untitled pattern")));
      $("library").append(saved);
    }
    $("library").value = notebook.active || "";
  }
  function load(pattern, active = null) {
    const valid = M.validate(pattern);
    Player.stop();
    remember();
    notebook.draft = valid;
    notebook.active = active;
    selected = valid.steps.length ? 0 : -1;
    selectedNote = 0;
    entryTicks = valid.steps[0]?.ticks || 12;
    entrySound = M.clone(defaultSound);
    persist();
    render();
    announce("Pattern loaded. Undo restores the previous pattern.");
  }
  function select(index) {
    selected = index;
    if (notebook.draft.steps[index]) {
      entryTicks = notebook.draft.steps[index].ticks;
      selectedNote = Math.max(0, Math.min(selectedNote, M.pitches(notebook.draft.steps[index]).length - 1));
    } else selectedNote = 0;
    render();
  }
  function durationLabel(ticks) {
    return M.durations.find(([value]) => value === ticks)[1];
  }
  function field(label, id, values, value) {
    const wrapper = document.createElement("label"),
      select = document.createElement("select");
    wrapper.textContent = label;
    select.id = id;
    values.forEach(([key, title]) => select.append(option(key, title)));
    select.value = value;
    wrapper.append(select);
    return wrapper;
  }
  function renderEditor() {
    const step = notebook.draft.steps[selected];
    if (step) {
      entryTicks = step.ticks;
      const note = M.pitches(step)[selectedNote];
      if (note) accidental = window.Tonal.Note.get(note.name).alt;
      if (M.pitches(step).length) entrySound = M.clone(step);
    }
    $("editor").hidden = !step;
    $("duration").value = entryTicks;
    $("accidental").value = accidental;
    $("remove").disabled = !step;
    $("pin").disabled = !step;
    $("pin").setAttribute("aria-pressed", String(!!(step && step.pin !== undefined)));
    ["note", "rest", "chord"].forEach((name) => $(name + "-mode").setAttribute("aria-pressed", String(mode === name)));
    if (!step) return;
    $("step-title").textContent = "Step " + (selected + 1);
    $("earlier").disabled = selected === 0;
    $("later").disabled = selected === notebook.draft.steps.length - 1;
    $("duplicate").disabled = notebook.draft.steps.length >= 128;
    $("add-button").disabled = step.presses.length >= 6;
    $("presses").replaceChildren();
    step.presses.forEach((press, i) => {
      const row = document.createElement("div");
      row.className = "bp-press";
      row.dataset.press = i;
      row.append(
        field(
          "Root column",
          "bp-root-" + i,
          Array.from({ length: 12 }, (_, pc) => [pc, window.Music.noteName(pc)]),
          press.root
        ),
        field(
          "Button",
          "bp-kind-" + i,
          M.kinds.map((kind) => [kind, labels[kind]]),
          press.kind
        ),
        field("Finger", "bp-finger-" + i, [["", "Unassigned"], ...[1, 2, 3, 4, 5].map((n) => [n, String(n)])], press.finger ?? "")
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove button";
      remove.dataset.remove = i;
      row.append(remove);
      $("presses").append(row);
    });
    if (!step.presses.length) {
      const rest = document.createElement("p");
      rest.textContent = M.pitches(step).length ? "Staff notes. Buttons unassigned." : "Rest";
      $("presses").append(rest);
    }
  }
  function drawScore(container, pattern, onSelect, current = -1) {
    container.replaceChildren();
    if (!pattern.steps.length) {
      const text = document.createElement("p");
      text.textContent = "Add a step to start.";
      container.append(text);
      return null;
    }
    const score = M.score(pattern);
    const rendered = window.ABCJS.renderAbc(container, score.abc, {
      staffwidth: Math.max(280, container.clientWidth - 24),
      responsive: "resize",
      add_classes: true,
      wrap: { minSpacing: 1.5, maxSpacing: 2.5, preferredMeasuresPerLine: 4 },
      foregroundColor: getComputedStyle(container).color,
    });
    const svg = container.querySelector("svg");
    if (svg) {
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", (pattern.title || "Bass pattern") + ", bass clef, " + pattern.meter.join("/"));
    }
    if (rendered[0]) {
      rendered[0].lines.forEach((line) =>
        (line.staff || []).forEach((staff) =>
          staff.voices.forEach((voice) =>
            voice.forEach((element) => {
              const segment = M.segmentForElement(score, element);
              if (segment)
                (element.abselem?.elemset || []).forEach((node) => {
                  node.setAttribute?.("data-bp-step", segment.step);
                  if (segment.step === current) node.classList?.add("bp-active-note");
                  if (onSelect && node.getBBox) {
                    const box = node.getBBox();
                    const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    hit.setAttribute("x", box.x - 4);
                    hit.setAttribute("y", box.y - 4);
                    hit.setAttribute("width", Math.max(16, box.width + 8));
                    hit.setAttribute("height", Math.max(24, box.height + 8));
                    hit.setAttribute("fill", "transparent");
                    hit.setAttribute("pointer-events", "all");
                    node.prepend(hit);
                    node.setAttribute("role", "button");
                    node.setAttribute("tabindex", "0");
                    node.setAttribute("aria-label", "Edit step " + (segment.step + 1));
                    node.addEventListener("click", (event) => {
                      event.stopPropagation();
                      onSelect(segment.step);
                    });
                    node.addEventListener("keydown", (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelect(segment.step);
                      }
                    });
                  }
                });
            })
          )
        )
      );
    }
    return score;
  }
  function renderScore() {
    if (!$("workspace").open) return;
    window.BassPatternStaff.mount($("score"), notebook.draft, {
      selected,
      note: selectedNote,
      ticks: entryTicks,
      accidental,
      mode,
      hint: (text) => {
        $("staff-hint").textContent = text;
      },
      select: (index, note) => {
        selectedNote = note;
        select(index);
        focusStaff(index);
      },
      write: writeNote,
      key: staffKey,
    });
    const score = M.score(notebook.draft);
    $("measure-status").textContent = !notebook.draft.steps.length ? "" : score.incomplete ? "Last measure is incomplete." : "";
    $("play-draft").disabled = !notebook.draft.steps.length;
  }
  function focusStaff(index) {
    $("score").querySelector(`[data-bp-slot="${index}"]`)?.focus({ preventScroll: true });
  }
  function writeNote(index, position, noteIndex = 0, action = mode) {
    const old = notebook.draft.steps[index];
    const notes = old ? M.pitches(old) : [];
    const previous = notes[noteIndex];
    const alt = action === "move" && previous ? window.Tonal.Note.get(previous.name).alt : accidental;
    const note = M.staffNote(position, alt);
    if (action === "rest") notes.length = 0;
    else if (action === "chord") {
      if (!notes.some((candidate) => candidate.midi === note.midi)) notes.push(note);
    } else if (notes.length) notes[Math.min(noteIndex, notes.length - 1)] = note;
    else notes.push(note);
    if (old && JSON.stringify(notes) === JSON.stringify(M.pitches(old))) {
      select(index);
      focusStaff(index);
      return;
    }
    const changed = edit((p) => {
      p.version = 2;
      while (p.steps.length <= index) p.steps.push({ ticks: entryTicks, presses: [] });
      const pin = p.steps[index].pin;
      p.steps[index] = { ticks: p.steps[index].ticks, presses: [], notes };
      if (pin !== undefined) p.steps[index].pin = pin;
    });
    selectedNote = Math.max(
      0,
      M.pitches(notebook.draft.steps[index] || { presses: [] }).findIndex((n) => n.midi === note.midi)
    );
    select(Math.min(index, notebook.draft.steps.length - 1));
    focusStaff(selected);
    if (changed && old?.presses.length) announce("Staff notes changed. Button assignments cleared for this step; Undo restores them.");
  }
  function removeNote() {
    if (!notebook.draft.steps[selected]) return;
    edit((p) => {
      const notes = M.pitches(p.steps[selected]);
      if (notes.length > 1) {
        notes.splice(selectedNote, 1);
        p.version = 2;
        const pin = p.steps[selected].pin;
        p.steps[selected] = { ticks: p.steps[selected].ticks, presses: [], notes };
        if (pin !== undefined) p.steps[selected].pin = pin;
      } else p.steps.splice(selected, 1);
    });
    selectedNote = 0;
    focusStaff(Math.max(0, selected));
  }
  function togglePinned() {
    const step = notebook.draft.steps[selected];
    if (!step) {
      announce("Select a step to lock.");
      return;
    }
    if (step.pin !== undefined) {
      edit((p) => {
        delete p.steps[selected].pin;
      });
      announce("Step unlocked.");
      return;
    }
    const barTicks = (notebook.draft.meter[0] * 48) / notebook.draft.meter[1];
    let onset = 0;
    for (let i = 0; i < selected; i++) onset += notebook.draft.steps[i].ticks;
    edit((p) => {
      p.version = 2;
      p.steps[selected].pin = onset % barTicks;
    });
    announce("Step locked to its beat. Earlier edits shift rests instead of this note.");
  }
  function chooseMode(name) {
    mode = name;
    const step = notebook.draft.steps[selected];
    if (step && name !== "chord") {
      const sounded = M.pitches(step).length > 0;
      if (name === "rest" && sounded) {
        edit((p) => {
          const pin = p.steps[selected].pin;
          p.steps[selected] = { ticks: step.ticks, presses: [] };
          if (pin !== undefined) p.steps[selected].pin = pin;
        });
        announce("Changed to a rest. Note brings back the last selected notes.");
      } else if (name === "note" && !sounded) {
        edit((p) => {
          if (entrySound.notes !== undefined) p.version = 2;
          const pin = p.steps[selected].pin;
          p.steps[selected] = { ...M.clone(entrySound), ticks: step.ticks };
          if (pin !== undefined) p.steps[selected].pin = pin;
        });
        announce("Changed to notes. Drag on the staff to change pitch.");
      }
    }
    render();
    $("staff-hint").textContent =
      name === "chord"
        ? "Click above or below a note to add a chord tone."
        : name === "rest"
          ? "Selected step is a rest. Click the staff to place more rests. R switches back."
          : "Click a rest to place a note. Note / Rest changes the selected step; R toggles.";
  }
  function staffKey(event, index, noteIndex) {
    const notes = notebook.draft.steps[index] ? M.pitches(notebook.draft.steps[index]) : [];
    const note = notes[noteIndex] || notes[0] || { midi: 48, name: "C" };
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      selectedNote = noteIndex;
      select(index);
      chooseMode(notes.length ? "rest" : "note");
      focusStaff(index);
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      selectedNote = noteIndex;
      select(index);
      togglePinned();
      focusStaff(index);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const target = Math.max(0, Math.min(notebook.draft.steps.length, index + (event.key === "ArrowLeft" ? -1 : 1)));
      select(target);
      focusStaff(target);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      writeNote(index, M.staffPosition(note) + (event.key === "ArrowUp" ? 1 : -1), noteIndex, "move");
    } else if (!event.ctrlKey && !event.metaKey && /^[a-g]$/i.test(event.key)) {
      event.preventDefault();
      mode = "note";
      writeNote(index, Math.floor(M.staffPosition(note) / 7) * 7 + "CDEFGAB".indexOf(event.key.toUpperCase()), noteIndex, "note");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      selected = index;
      removeNote();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (index >= notebook.draft.steps.length) writeNote(index, 21);
      else if (event.key === " ") play(notebook.draft, $("play-draft"), $("score"));
      else select(index);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restore(event.shiftKey ? "redo" : "undo");
      focusStaff(Math.max(0, selected));
    }
  }
  function openEditor() {
    $("workspace").open = true;
    renderScore();
    $("workspace").scrollIntoView({ block: "start" });
  }
  function play(pattern, button, container) {
    if (playingButton === button) {
      Player.stop();
      return;
    }
    Player.stop();
    playingButton = button;
    button.textContent = "Stop";
    button.setAttribute("aria-pressed", "true");
    Player.play(pattern, {
      bpm: $("tempo").value,
      onStep(index) {
        container
          .querySelectorAll("[data-bp-step]")
          .forEach((node) => node.classList.toggle("bp-playing-note", Number(node.dataset.bpStep) === index));
      },
      onStop() {
        playingButton = null;
        button.textContent = "Play";
        button.setAttribute("aria-pressed", "false");
        container.querySelectorAll(".bp-playing-note").forEach((node) => node.classList.remove("bp-playing-note"));
      },
      onError: announce,
    });
  }
  async function copyPattern(pattern) {
    const code = M.encode(pattern);
    $("code").value = code;
    $("code-error").hidden = true;
    try {
      await navigator.clipboard.writeText(code);
      announce("Pattern code copied.");
    } catch (_) {
      openEditor();
      $("code-form").hidden = false;
      $("code").focus();
      $("code").select();
      announce("Select and copy this pattern code.");
    }
  }
  function collection() {
    Player.stop();
    $("collection").replaceChildren();
    const entries = notebook.saved
      .map((entry) => ({ ...entry, example: false }))
      .concat(
        M.examples
          .map((pattern, i) => ({ id: "example:" + i, pattern, example: true }))
          .sort((a, b) => Number(b.pattern === imported) - Number(a.pattern === imported))
      );
    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "bp-card";
      card.dataset.patternId = entry.id;
      if (entry.example && entry.pattern === imported) card.id = "bp-prison-blues";
      const toolbar = document.createElement("div");
      toolbar.className = "bp-toolbar";
      const title = document.createElement("h2");
      title.textContent = entry.pattern.title || "Untitled pattern";
      const tag = document.createElement("span");
      tag.className = "bp-small";
      tag.textContent = entry.example ? (entry.pattern === imported ? "From MusicXML · 6/8 · Repeat twice" : "Example") : "Saved";
      const staff = document.createElement("div");
      staff.className = "bp-score";
      function control(text, action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.addEventListener("click", () => action(button));
        toolbar.append(button);
        return button;
      }
      toolbar.append(title, tag);
      const playButton = control("Play", (button) => play(entry.pattern, button, staff));
      playButton.disabled = !entry.pattern.steps.length;
      control("Edit", () => {
        load(entry.pattern, entry.example ? null : entry.id);
        openEditor();
      });
      control("Copy", () => copyPattern(entry.pattern));
      if (!entry.example)
        control("Delete", () => {
          if (!window.confirm("Delete this saved bassline? Copy its code first if you need a backup.")) return;
          notebook.saved = notebook.saved.filter((candidate) => candidate.id !== entry.id);
          if (notebook.active === entry.id) notebook.active = null;
          persist();
          library();
          collection();
        });
      card.append(toolbar, staff);
      $("collection").append(card);
      drawScore(staff, entry.pattern, (index) => {
        load(entry.pattern, entry.example ? null : entry.id);
        select(index);
        openEditor();
      });
    });
  }
  function render() {
    const focused = document.activeElement?.id;
    $("title").value = notebook.draft.title;
    $("meter-top").value = notebook.draft.meter[0];
    $("meter-bottom").value = notebook.draft.meter[1];
    $("repeat").checked = !!notebook.draft.repeat;
    $("undo").disabled = !past.length;
    $("redo").disabled = !future.length;
    $("add").disabled = $("add-rest").disabled = notebook.draft.steps.length >= 128;
    library();
    $("steps").replaceChildren();
    notebook.draft.steps.forEach((step, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.step = i;
      button.id = "bp-step-" + i;
      button.setAttribute("aria-pressed", String(i === selected));
      button.setAttribute("aria-label", "Step " + (i + 1) + ", " + durationLabel(step.ticks) + (M.pitches(step).length ? "" : " rest"));
      if (step.pin !== undefined) button.dataset.pinned = "";
      else delete button.dataset.pinned;
      button.textContent = String(i + 1);
      const duration = document.createElement("small");
      duration.textContent = durationLabel(step.ticks);
      button.append(duration);
      $("steps").append(button);
    });
    renderEditor();
    renderScore();
    if (focused && document.getElementById(focused)) document.getElementById(focused).focus({ preventScroll: true });
  }
  function add(rest) {
    edit((pattern) =>
      pattern.steps.splice(selected + 1, 0, {
        ticks: pattern.steps[selected]?.ticks || 12,
        presses: rest ? [] : [{ root: 0, kind: "bass", finger: null }],
      })
    );
    select(Math.min(selected + 1, notebook.draft.steps.length - 1));
  }
  M.durations.forEach(([ticks, name]) => $("duration").append(option(ticks, name)));
  $("repeat").addEventListener("change", () =>
    edit((p) => {
      p.version = 2;
      p.repeat = $("repeat").checked;
    })
  );
  $("title").addEventListener("input", () =>
    edit((p) => {
      p.title = $("title").value;
    })
  );
  ["meter-top", "meter-bottom"].forEach((id) =>
    $(id).addEventListener("change", () => {
      edit((p) => {
        p.meter = [Number($("meter-top").value), Number($("meter-bottom").value)];
      });
      $("meter-top").value = notebook.draft.meter[0];
      $("meter-bottom").value = notebook.draft.meter[1];
    })
  );
  $("duration").addEventListener("change", () => {
    entryTicks = Number($("duration").value);
    if (notebook.draft.steps[selected])
      edit((p) => {
        p.steps[selected].ticks = entryTicks;
      });
    else render();
  });
  ["note", "rest", "chord"].forEach((name) => $(name + "-mode").addEventListener("click", () => chooseMode(name)));
  $("pin").addEventListener("click", togglePinned);
  $("accidental").addEventListener("change", () => {
    accidental = Number($("accidental").value);
    const note = notebook.draft.steps[selected] && M.pitches(notebook.draft.steps[selected])[selectedNote];
    if (note) writeNote(selected, M.staffPosition(note), selectedNote, "note");
    else render();
  });
  $("steps").addEventListener("click", (e) => {
    const button = e.target.closest("[data-step]");
    if (button) select(Number(button.dataset.step));
  });
  $("presses").addEventListener("change", (e) => {
    const row = e.target.closest("[data-press]");
    if (!row) return;
    const i = Number(row.dataset.press);
    edit((p) => {
      p.steps[selected].presses[i] = {
        root: Number($("root-" + i).value),
        kind: $("kind-" + i).value,
        finger: $("finger-" + i).value === "" ? null : Number($("finger-" + i).value),
      };
      delete p.steps[selected].notes;
      delete p.steps[selected].chord;
    });
    render();
  });
  $("presses").addEventListener("click", (e) => {
    const button = e.target.closest("[data-remove]");
    if (button)
      edit((p) => {
        p.steps[selected].presses.splice(Number(button.dataset.remove), 1);
        delete p.steps[selected].chord;
      });
  });
  $("add-button").addEventListener("click", () =>
    edit((p) => {
      const step = p.steps[selected],
        used = step.presses.map((b) => M.button(b).id);
      const candidate = [0, 7, 5, 2, 9, 4, 11, 6, 1, 8, 3, 10]
        .flatMap((root) => ["M", "bass", "counter", "m", "7", "d7"].map((kind) => ({ root, kind, finger: null })))
        .find((b) => !used.includes(M.button(b).id));
      step.presses.push(candidate);
      delete step.notes;
      delete step.chord;
    })
  );
  $("add").addEventListener("click", () => add(false));
  $("add-rest").addEventListener("click", () => add(true));
  $("duplicate").addEventListener("click", () => {
    edit((p) => p.steps.splice(selected + 1, 0, M.clone(p.steps[selected])));
    select(selected + 1);
  });
  $("remove").addEventListener("click", removeNote);
  [
    ["earlier", -1],
    ["later", 1],
  ].forEach(([id, delta]) =>
    $(id).addEventListener("click", () => {
      edit((p) => {
        const step = p.steps.splice(selected, 1)[0];
        p.steps.splice(selected + delta, 0, step);
      });
      select(selected + delta);
    })
  );
  $("undo").addEventListener("click", () => restore("undo"));
  $("redo").addEventListener("click", () => restore("redo"));
  $("new").addEventListener("click", () => {
    if (window.confirm("Start a new pattern? Save or Copy this one first. Undo can also restore it.")) {
      load(M.empty());
      openEditor();
    }
  });
  $("library").addEventListener("change", () => {
    const value = $("library").value;
    const pattern = value.startsWith("example:") ? M.examples[Number(value.slice(8))] : notebook.saved.find((entry) => entry.id === value)?.pattern;
    if (pattern && window.confirm("Load this pattern? Unsaved changes remain available through Undo."))
      load(pattern, value.startsWith("example:") ? null : value);
    else library();
  });
  $("save").addEventListener("click", () => {
    let entry = notebook.saved.find((candidate) => candidate.id === notebook.active);
    if (!entry) {
      if (notebook.saved.length >= 64) {
        announce("Browser library is full. Use Copy.");
        return;
      }
      entry = { id: crypto.randomUUID(), pattern: M.clone(notebook.draft) };
      notebook.saved.push(entry);
      notebook.active = entry.id;
    } else entry.pattern = M.clone(notebook.draft);
    library();
    collection();
    announce(persist() ? "Saved in this browser. Copy keeps a portable pattern code." : "Kept in this tab only. Use Copy.");
  });
  $("copy").addEventListener("click", () => copyPattern(notebook.draft));
  $("play-draft").addEventListener("click", () => play(notebook.draft, $("play-draft"), $("score")));
  $("tempo").addEventListener("change", () => {
    $("tempo").value = Math.max(40, Math.min(240, Number($("tempo").value) || 96));
    Player.stop();
  });
  $("workspace").addEventListener("toggle", renderScore);
  $("load").addEventListener("click", () => {
    $("code-form").hidden = false;
    $("code-error").hidden = true;
    $("code").focus();
    $("code").select();
  });
  $("code-close").addEventListener("click", () => {
    $("code-form").hidden = true;
    $("load").focus();
  });
  $("code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const pattern = M.decode($("code").value);
      if (!window.confirm("Load this pattern? Undo can restore your current pattern.")) return;
      load(pattern);
      $("code-form").hidden = true;
      $("load").focus();
    } catch (error) {
      $("code-error").textContent = error.message;
      $("code-error").hidden = false;
    }
  });
  $("replace-save").addEventListener("click", () => {
    if (window.confirm("Replace the browser notebook with this tab’s patterns? Copy any patterns you need to keep first.")) persist(true);
  });
  window.addEventListener("storage", (e) => {
    if (e.key === window.BassPatternStorage.key || e.key === null) {
      store.changed(e.newValue);
      storageStatus();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (!lastWritten) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderScore();
      collection();
    }, 120);
  });
  storageStatus();
  render();
  collection();
})();
