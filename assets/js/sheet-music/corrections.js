/* Local-only correction UI. Source, filenames, and history never leave memory. */
(function () {
  "use strict";
  const page = document.querySelector('.sheet-reader[data-local-file="true"]');
  if (!page) return;
  const bridge = window.__sheetMusic,
    Model = window.SheetCorrectionModel;
  const container = document.getElementById("osmd-container");
  const tools = page.querySelector(".sheet-correction-tools");
  const dialog = document.getElementById("sheet-correction-dialog");
  const $ = (name) => page.querySelector("[data-correction-" + name + "]");
  const serialize = (doc) => new XMLSerializer().serializeToString(doc);
  const key = (at) => JSON.stringify([at.partIndex, at.measureIndex, at.noteIndex]);
  let history = [],
    cursor = -1,
    sequence = 0,
    saved = 0,
    downloaded = -1;
  let busy = false,
    rendering = false,
    generation = 0,
    selected,
    selectedElement,
    rhythmChanged = false;
  let mapping,
    visuals = new Map(),
    mappedOsmd,
    mappedXML,
    pendingSteps = [];
  const drafts = new Map(),
    downloads = new Set();
  const active = () => page.dataset.correctionMode === "true";
  const current = () => history[cursor];
  const dirty = () => !!current() && (current().id !== saved || drafts.size > 0);
  const message = (text) => {
    $("status").textContent = text;
  };
  function refresh() {
    tools.hidden = !current();
    $("toggle").disabled = !current() || busy;
    $("toggle").setAttribute("aria-pressed", String(active()));
    $("toggle").textContent = active() ? "Inspect / play" : "Edit notes";
    $("undo").disabled = busy || cursor <= 0;
    $("redo").disabled = busy || cursor + 1 >= history.length;
    $("undo").title = cursor > 0 ? "Undo: " + history[cursor].label : "Nothing to undo";
    $("redo").title = history[cursor + 1] ? "Redo: " + history[cursor + 1].label : "Nothing to redo";
    $("download").disabled = busy || !current() || drafts.size > 0;
    $("save").hidden = typeof window.showSaveFilePicker !== "function";
    $("save").disabled = $("download").disabled;
    $("confirm-save").hidden = !current() || downloaded !== current().id || !dirty();
    $("file").textContent = bridge.localFileName || "";
    $("file").title = bridge.localFileName || "";
    $("state").textContent = drafts.size ? drafts.size + " unapplied draft(s)" : dirty() ? "Unsaved changes" : "Local copy";
    $("selection").hidden = !selected || !active();
    for (const name of ["up", "down", "hear", "details", "pick"]) $(name).disabled = busy || !selected;
    if (selected) {
      const info = Model.describe(current().doc, selected);
      const pitched = !!info.pitch;
      $("up").disabled ||= !pitched;
      $("down").disabled ||= !pitched;
      $("hear").disabled ||= !pitched;
      $("member").disabled = busy || info.members.length < 2;
      $("pitch").disabled = busy || !pitched || !Number.isInteger(info.pitch.alter) || Math.abs(info.pitch.alter) > 2;
      $("rhythm").disabled = busy || !!info.rhythmReason;
    }
    $("close").disabled = busy;
    $("apply").disabled ||= busy;
    $("hear-draft").disabled ||= busy;
    tools.setAttribute("aria-busy", String(busy));
    page.querySelectorAll("[data-pb-transpose], [data-pb-key-reset]").forEach((button) => {
      button.disabled = active() || busy;
      button.title = active() ? "Editing uses written pitch. Switch to Inspect / play to transpose." : "";
    });
    const help = page.querySelector(".practice-score-help");
    help.textContent = active()
      ? "Select a note. ↑/↓ changes pitch; ←/→ moves between groups. Alt: semitone. Shift: octave. Enter: details."
      : "Tap a note to inspect it. Keyboard: Tab to the score, then use arrow keys and Enter.";
    container.querySelectorAll(".vf-stavenote[aria-label]").forEach((note) => {
      note.setAttribute("aria-label", note.getAttribute("aria-label").replace(/^(Inspect|Correct)/, active() ? "Correct" : "Inspect"));
    });
  }
  function clearHighlight() {
    container.querySelectorAll(".is-correction-note, .is-correction-target, .is-inspected").forEach((el) => {
      el.classList.remove("is-correction-note", "is-correction-target", "is-inspected");
    });
  }
  function stopSelection() {
    if (dialog.open) dialog.close();
    clearHighlight();
    selected = selectedElement = null;
    drafts.clear();
    for (const name of ["member", "pick"]) $(name).replaceChildren();
    for (const name of ["location", "error", "selected", "preview", "impact"]) $(name).textContent = "";
  }
  function rebuildMap() {
    if (!bridge.osmd || !bridge.xml) return;
    if (mappedOsmd === bridge.osmd && mappedXML === bridge.xml) return;
    mappedOsmd = bridge.osmd;
    mappedXML = bridge.xml;
    mapping = Model.mapNotes(bridge.osmd, bridge.xml);
    visuals = new Map();
    for (const musicPage of bridge.osmd.GraphicSheet?.MusicPages || [])
      for (const system of musicPage.MusicSystems || [])
        for (const line of system.StaffLines || [])
          for (const measure of line.Measures || [])
            for (const staff of measure.staffEntries || [])
              for (const voice of staff.graphicalVoiceEntries || [])
                for (const note of voice.notes || []) {
                  const at = mapping.get(note.sourceNote || note.SourceNote);
                  const vf = Array.isArray(note.vfnote) ? note.vfnote[0] : note.vfnote;
                  const id = vf?.attrs?.id;
                  const element = id && (document.getElementById("vf-" + id) || document.getElementById(id));
                  if (at && element) visuals.set(key(at), { at, element, head: element.querySelectorAll(".vf-notehead")[note.vfnoteIndex || 0] });
                }
  }
  function context(info) {
    const clef = { G: "Treble", F: "Bass", C: "C clef" }[info.clef] || "Staff " + info.staff;
    return "m. " + (info.measureIndex + 1) + " · beat " + Number(info.beat.toFixed(2)) + " · " + clef;
  }
  function paint(focus = false) {
    if (!selected || !current()) return;
    rebuildMap();
    const visual = visuals.get(key(selected));
    clearHighlight();
    selectedElement = visual?.element;
    if (visual) {
      visual.element.classList.add("is-correction-target");
      (visual.head || visual.element).classList.add("is-correction-note");
      container.querySelectorAll(".vf-stavenote").forEach((el) => el.setAttribute("tabindex", el === visual.element ? "0" : "-1"));
      const info = Model.describe(current().doc, selected);
      visual.element.setAttribute("aria-label", "Correct " + Model.label(info.pitch) + ", " + context(info));
      if (focus) {
        const r = visual.element.getBoundingClientRect(),
          top = tools.getBoundingClientRect().bottom + 12;
        if (r.top < top || r.bottom > innerHeight - 20) visual.element.scrollIntoView({ block: "center" });
        visual.element.focus({ preventScroll: true });
      }
    }
    const info = Model.describe(current().doc, selected);
    $("selected").textContent = context(info) + " · " + Model.label(info.pitch);
    $("pick").replaceChildren(...info.members.map((m) => new Option(m.label, m.noteIndex)));
    $("pick").value = String(selected.noteIndex);
    $("pick").hidden = info.members.length < 2;
    refresh();
  }
  function reset() {
    generation++;
    history = [];
    cursor = -1;
    sequence = saved = 0;
    downloaded = -1;
    busy = rendering = false;
    pendingSteps = [];
    stopSelection();
    mappedOsmd = mappedXML = null;
    visuals.clear();
    for (const [name, value] of [
      ["step", "C"],
      ["alter", "0"],
      ["octave", ""],
      ["type", ""],
      ["dots", "0"],
      ["display", "auto"],
    ])
      $(name).value = value;
    $("pitch-help").textContent = $("rhythm-help").textContent = "";
    page.dataset.correctionMode = "false";
    downloads.forEach((url) => URL.revokeObjectURL(url));
    downloads.clear();
    message("Browser only. Save a copy to keep edits.");
    refresh();
  }
  function record(doc, label = "Open score") {
    history.splice(cursor + 1);
    history.push({ doc, label, size: serialize(doc).length * 2, id: sequence++ });
    cursor = history.length - 1;
    let size = history.reduce((sum, item) => sum + item.size, 0);
    while (history.length > 1 && (history.length > 21 || size > 32 * 1024 * 1024)) {
      size -= history.shift().size;
      cursor--;
    }
  }
  page.addEventListener("sheet-score-ready", (event) => {
    if (!event.detail?.correction) {
      reset();
      record(bridge.xml);
      saved = current().id;
    }
    refresh();
  });
  container.addEventListener("sheet-clear", reset);
  container.addEventListener("sheet-render", () => {
    mappedOsmd = null;
    if (active() && selected && !busy) requestAnimationFrame(() => paint());
  });
  $("toggle").addEventListener("click", () => {
    const enabled = !active();
    stopSelection();
    window.SheetReader?.player?.pause();
    window.WorkbenchPlayer?.stop();
    if (enabled) window.SheetReader?.player?.setTranspose(0);
    page.dataset.correctionMode = String(enabled);
    container.dispatchEvent(new CustomEvent("sheet-render"));
    message(enabled ? "Editing written pitch." : "Inspect and play. Undo still works; save a separate copy to keep corrections.");
    refresh();
  });
  function select(hit, element) {
    rebuildMap();
    const at = mapping?.get(hit?.graphicalNote?.sourceNote || hit?.graphicalNote?.SourceNote);
    if (!at) {
      message("This note cannot be matched safely to MusicXML. No correction was made.");
      return;
    }
    selected = at;
    selectedElement = element;
    window.SheetReader?.player?.pause();
    window.WorkbenchPlayer?.stop();
    paint();
  }
  function hitFor(element) {
    const r = element.getBoundingClientRect();
    return bridge.resolveNoteAt(r.left + r.width / 2 + scrollX, r.top + r.height / 2 + scrollY, 80, element);
  }
  container.addEventListener(
    "click",
    (event) => {
      if (!active() && !busy) return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const el = event.target.closest(".vf-stavenote");
      if (!el) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) {
        select(bridge.resolveNoteAt(event.pageX, event.pageY, 80, event.target), el);
        selectedElement?.focus({ preventScroll: true });
      }
    },
    true
  );
  container.addEventListener(
    "focusin",
    (event) => {
      if (!active() || busy) return;
      const el = event.target.closest(".vf-stavenote");
      if (!el) return;
      if (el !== selectedElement) select(hitFor(el), el);
      event.stopImmediatePropagation();
    },
    true
  );
  function readChanges() {
    const changes = {};
    if (!$("pitch").disabled) {
      changes.pitch = { step: $("step").value, alter: Number($("alter").value), octave: Number($("octave").value) };
      changes.accidental = $("display").value;
    }
    if (rhythmChanged && !$("rhythm").disabled && $("type").value) {
      changes.type = $("type").value;
      changes.dots = Number($("dots").value);
    }
    return changes;
  }
  function preview() {
    if (!selected || !dialog.open) return;
    const info = Model.describe(current().doc, selected),
      changes = readChanges();
    const proposedMidi = Model.midi(changes.pitch);
    $("hear-draft").disabled =
      $("pitch").disabled || !$("form").checkValidity() || !Number.isFinite(proposedMidi) || proposedMidi < 0 || proposedMidi > 127;
    $("preview").textContent = Model.label(info.pitch) + " → " + Model.label(changes.pitch || info.pitch);
    $("impact").textContent = changes.type ? Model.rhythmImpact(current().doc, selected, changes.type, changes.dots) : "";
    try {
      const changed = Model.apply(current().doc, selected, changes);
      $("apply").disabled = !changed || !$("form").checkValidity() || busy;
      if (changed) drafts.set(selected.noteIndex, changes);
      else drafts.delete(selected.noteIndex);
      $("error").textContent = "";
    } catch (error) {
      drafts.set(selected.noteIndex, changes);
      $("apply").disabled = true;
      $("error").textContent = error.message;
    }
    $("apply").textContent = "Apply " + (changes.type ? "group rhythm / pitch" : Model.label(changes.pitch || info.pitch));
    refresh();
  }
  function fill() {
    const info = Model.describe(current().doc, selected),
      draft = drafts.get(selected.noteIndex);
    const pitch = draft?.pitch || info.pitch;
    rhythmChanged = !!draft?.type;
    $("location").textContent = context(info) + " · voice " + info.voice;
    $("pitch").disabled = !info.pitch || !Number.isInteger(info.pitch.alter) || Math.abs(info.pitch.alter) > 2;
    if (pitch) {
      $("step").value = pitch.step;
      $("alter").value = pitch.alter;
      $("octave").value = pitch.octave;
    }
    $("display").value = draft?.accidental || info.accidental;
    $("pitch-help").textContent = info.tied
      ? "Pitch changes apply to the whole linked tie."
      : info.pitch
        ? $("pitch").disabled
          ? "Microtonal pitch corrections need a notation editor."
          : "Correct written pitch. Automatic display follows the key and measure; pitch alteration still determines the sound."
        : "Rests have no pitch. Their rhythm can be edited below when safe.";
    $("rhythm").disabled = !!info.rhythmReason;
    $("type").value = draft?.type || (info.type in Model.types ? info.type : "");
    $("dots").value = draft?.dots ?? (info.dots <= 2 ? info.dots : "0");
    $("rhythm-help").textContent =
      info.rhythmReason || "Duration affects this whole chord and later groups in this voice. Review the timing preview before applying.";
    $("member").replaceChildren(...info.members.map((m) => new Option(m.label, m.noteIndex)));
    $("member").value = selected.noteIndex;
    $("member").disabled = info.members.length < 2;
    preview();
  }
  function details() {
    if (busy || !selected) return;
    window.WorkbenchPlayer?.stop();
    dialog.showModal();
    fill();
    if (!$("pitch").disabled) $("step").focus();
    else {
      dialog.querySelector("details").open = true;
      $("type").focus();
    }
  }
  async function replace(doc, after, label) {
    const request = generation,
      at = selected && { ...selected };
    const oldTop = selectedElement?.getBoundingClientRect().top;
    busy = rendering = true;
    refresh();
    message("Applying correction…");
    try {
      const applied = await bridge.replaceLocalXML(doc);
      if (!applied || request !== generation) return false;
      after();
      selected = at;
      mappedOsmd = null;
      if (selected) {
        try {
          paint(true);
        } catch (_) {
          selected = selectedElement = null;
        }
      }
      if (oldTop != null && selectedElement) {
        const delta = selectedElement.getBoundingClientRect().top - oldTop;
        if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
      }
      message(label + (dirty() ? ". Unsaved changes." : ". Back to the saved version."));
      return true;
    } catch (error) {
      if (request === generation) {
        mappedOsmd = null;
        paint(true);
        message("Correction not applied: " + error.message);
      }
      return false;
    } finally {
      if (request === generation) {
        busy = rendering = false;
        refresh();
        if (dialog.open) preview();
        const next = pendingSteps.shift();
        if (next) queueMicrotask(() => nudge(...next));
      }
    }
  }
  async function nudge(direction, mode = "scale") {
    if (!selected || !active()) return;
    if (busy) {
      if (rendering && pendingSteps.length < 16) pendingSteps.push([direction, mode]);
      return;
    }
    try {
      const old = Model.describe(current().doc, selected).pitch;
      const pitch = Model.stepPitch(current().doc, selected, direction, mode);
      const doc = Model.apply(current().doc, selected, { pitch });
      const label = Model.label(old) + " → " + Model.label(pitch);
      if (doc) await replace(doc, () => record(doc, label), label);
    } catch (error) {
      pendingSteps = [];
      message(error.message);
    }
  }
  container.addEventListener(
    "keydown",
    (event) => {
      if (!active() || event.ctrlKey || event.metaKey) return;
      const el = event.target.closest(".vf-stavenote");
      if (!el) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!selected) select(hitFor(el), el);
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        nudge(event.key === "ArrowUp" ? 1 : -1, event.altKey ? "chromatic" : event.shiftKey ? "octave" : "scale");
      } else if (!busy && (event.key === "Enter" || event.key === " ")) details();
      else if (!busy) {
        const groups = [...container.querySelectorAll(".vf-stavenote")];
        groups[groups.indexOf(el) + (event.key === "ArrowRight" ? 1 : -1)]?.focus();
      }
    },
    true
  );
  $("pick").addEventListener("change", () => {
    selected = { ...selected, noteIndex: Number($("pick").value) };
    paint(true);
  });
  $("member").addEventListener("change", () => {
    selected = { ...selected, noteIndex: Number($("member").value) };
    fill();
    paint();
  });
  for (const name of ["step", "alter", "octave"])
    $(name).addEventListener("input", () => {
      $("display").value = "auto";
    });
  for (const name of ["type", "dots"])
    $(name).addEventListener("change", () => {
      rhythmChanged = true;
    });
  $("form").addEventListener("input", preview);
  $("form").addEventListener("change", preview);
  $("close").addEventListener("click", () => {
    if (!drafts.size || window.confirm("Discard the unapplied form changes? Applied corrections remain in the score.")) {
      drafts.clear();
      dialog.close();
      refresh();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    $("close").click();
  });
  dialog.addEventListener("close", () => {
    window.WorkbenchPlayer?.stop();
    selectedElement?.focus({ preventScroll: true });
  });
  $("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !selected) return;
    try {
      const doc = Model.apply(current().doc, selected, readChanges());
      if (!doc) return;
      const noteIndex = selected.noteIndex,
        label = $("preview").textContent;
      const applied = await replace(
        doc,
        () => {
          record(doc, label);
          drafts.delete(noteIndex);
        },
        label
      );
      if (applied) {
        if (drafts.size) {
          selected = { ...selected, noteIndex: drafts.keys().next().value };
          fill();
          paint();
        } else dialog.close();
      }
    } catch (error) {
      $("error").textContent = error.message;
    }
  });
  async function hear(draft = false) {
    if (!selected || busy) return;
    const pitch = draft && !$("pitch").disabled ? readChanges().pitch : Model.describe(current().doc, selected).pitch;
    if (!pitch || Model.midi(pitch) < 0 || Model.midi(pitch) > 127) {
      message("Choose a playable pitched note to hear.");
      return;
    }
    window.SheetReader?.player?.pause();
    await window.WorkbenchPlayer.play([[Model.midi(pitch)]], { onError: message });
  }
  $("up").addEventListener("click", () => nudge(1));
  $("down").addEventListener("click", () => nudge(-1));
  $("details").addEventListener("click", details);
  $("hear").addEventListener("click", () => hear());
  $("hear-draft").addEventListener("click", () => hear(true));
  function travel(delta) {
    if (busy || !history[cursor + delta]) return;
    if (drafts.size && !window.confirm("Discard unapplied form changes before undo or redo?")) return;
    drafts.clear();
    if (dialog.open) dialog.close();
    const target = cursor + delta;
    return replace(
      history[target].doc,
      () => {
        cursor = target;
      },
      delta < 0 ? "Undone" : "Redone"
    );
  }
  $("undo").addEventListener("click", () => travel(-1));
  $("redo").addEventListener("click", () => travel(1));
  document.addEventListener("keydown", (event) => {
    if (
      !current() ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.defaultPrevented ||
      event.target.closest("input, select, textarea, [contenteditable]")
    )
      return;
    const name = event.key.toLowerCase();
    if (name !== "z" && name !== "y") return;
    event.preventDefault();
    travel(name === "y" || event.shiftKey ? 1 : -1);
  });
  function exportFile() {
    const name = (bridge.localFileName || "score")
      .replace(/\.(musicxml|xml)$/i, "")
      .replace(/(?:-edited)+$/i, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
    return {
      name: name + "-edited.musicxml",
      blob: new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', serialize(current().doc)], {
        type: "application/vnd.recordare.musicxml+xml;charset=utf-8",
      }),
    };
  }
  $("download").addEventListener("click", () => {
    if (!current() || busy || drafts.size) return;
    const file = exportFile(),
      url = URL.createObjectURL(file.blob);
    downloads.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    downloaded = current().id;
    message("Download requested, not confirmed saved. Check the file on your device, then choose “I saved this copy”. Your original is unchanged.");
    refresh();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.delete(url);
    }, 1000);
  });
  $("confirm-save").addEventListener("click", () => {
    if (!current() || downloaded !== current().id || drafts.size) return;
    saved = current().id;
    message("You confirmed this copy is saved. Your original file is unchanged.");
    refresh();
  });
  $("save").addEventListener("click", async () => {
    if (!current() || busy || drafts.size || !window.showSaveFilePicker) return;
    const request = generation,
      id = current().id,
      file = exportFile();
    busy = true;
    refresh();
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: file.name,
        types: [{ description: "MusicXML score", accept: { "application/vnd.recordare.musicxml+xml": [".musicxml"] } }],
      });
      if (request !== generation) return;
      const stream = await handle.createWritable();
      try {
        await stream.write(file.blob);
        await stream.close();
      } catch (error) {
        try {
          await stream.abort();
        } catch (_) {
          /* Preserve the write error. */
        }
        throw error;
      }
      if (request === generation) {
        saved = id;
        message("MusicXML saved to your chosen file.");
      }
    } catch (error) {
      if (request === generation)
        message(
          error.name === "AbortError"
            ? "Save cancelled. Changes remain unsaved."
            : "Save failed. Changes remain unsaved; you can request a download instead."
        );
    } finally {
      if (request === generation) {
        busy = false;
        refresh();
      }
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  window.SheetCorrections = {
    hasUnsavedChanges: dirty,
    confirmDiscard: () => !dirty() || window.confirm("This score has changes without a confirmed saved copy. Discard them?"),
  };
  reset();
})();
