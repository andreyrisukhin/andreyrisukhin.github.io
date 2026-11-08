/* Local-only correction UI. No score, filename, or history is persisted or sent. */
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
  let history = [],
    cursor = -1,
    sequence = 0,
    saved = 0,
    busy = false,
    generation = 0;
  let selected,
    selectedElement,
    rhythmChanged = false;
  const downloads = new Set();
  const active = () => page.dataset.correctionMode === "true";
  const current = () => history[cursor];
  const dirty = () => !!current() && current().id !== saved;
  function refresh() {
    tools.hidden = !current();
    $("toggle").disabled = !current() || busy;
    $("toggle").setAttribute("aria-pressed", String(active()));
    $("undo").disabled = busy || cursor <= 0;
    $("redo").disabled = busy || cursor + 1 >= history.length;
    $("download").disabled = busy || !current();
    page.querySelectorAll("[data-pb-transpose], [data-pb-key-reset]").forEach((button) => {
      button.disabled = active() || busy;
    });
    container.querySelectorAll(".vf-stavenote[aria-label]").forEach((note) => {
      note.setAttribute("aria-label", note.getAttribute("aria-label").replace(/^(Inspect|Correct)/, active() ? "Correct" : "Inspect"));
    });
  }
  function stopSelection() {
    if (dialog.open) dialog.close();
    selectedElement?.classList.remove("is-inspected");
    selected = selectedElement = null;
    $("member").replaceChildren();
    $("location").textContent = $("error").textContent = "";
  }
  function reset() {
    generation++;
    history = [];
    cursor = -1;
    sequence = saved = 0;
    busy = false;
    stopSelection();
    $("step").value = "C";
    $("alter").value = "0";
    $("octave").value = "";
    $("type").value = "";
    $("dots").value = "0";
    $("pitch-help").textContent = $("rhythm-help").textContent = "";
    page.dataset.correctionMode = "false";
    $("status").textContent = "Corrections stay in memory. Download a copy to keep them.";
    downloads.forEach((url) => URL.revokeObjectURL(url));
    downloads.clear();
    refresh();
  }
  function entry(doc) {
    return { doc, size: serialize(doc).length * 2, id: sequence++ };
  }
  function record(doc) {
    history.splice(cursor + 1);
    history.push(entry(doc));
    cursor = history.length - 1;
    // Bound both large-score memory and the number of retained revisions.
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
  $("toggle").addEventListener("click", () => {
    const enabled = !active();
    stopSelection();
    window.SheetReader?.player?.pause();
    window.WorkbenchPlayer?.stop();
    if (enabled) window.SheetReader?.player?.setTranspose(0);
    page.dataset.correctionMode = String(enabled);
    $("status").textContent = enabled
      ? "Tap a note to correct it, or focus a note and press Enter. Editing uses the written key."
      : dirty()
        ? "Changes are not downloaded. Download edited MusicXML to keep them."
        : "Corrections stay in memory. Download a copy to keep them.";
    refresh();
  });
  function fill() {
    rhythmChanged = false;
    const info = Model.describe(current().doc, selected);
    $("location").textContent = "Measure " + (info.measureIndex + 1) + " · Staff " + info.staff + " · Voice " + info.voice;
    $("pitch").disabled = !info.pitch || !Number.isInteger(info.pitch.alter) || Math.abs(info.pitch.alter) > 2;
    if (info.pitch) {
      $("step").value = info.pitch.step;
      $("alter").value = String(info.pitch.alter);
      $("octave").value = info.pitch.octave;
    }
    $("pitch-help").textContent = info.tied
      ? "Pitch changes apply to the whole linked tie."
      : info.pitch
        ? $("pitch").disabled
          ? "Microtonal pitch corrections need a notation editor."
          : "Correct the written pitch, not a playback transposition."
        : "Rests have no pitch. You can correct an untied, non-tuplet rhythm below.";
    $("rhythm").disabled = !!info.rhythmReason;
    $("type").value = info.type in Model.types ? info.type : "";
    $("dots").value = info.dots <= 2 ? String(info.dots) : "0";
    $("rhythm-help").textContent =
      info.rhythmReason ||
      "Duration applies to the whole chord. Later notes shift in this voice; trailing rests keep its span unchanged. Longer notes need spare trailing rest.";
    $("error").textContent = "";
  }
  function open(hit, element) {
    // Resolve against the current model, including after undo, zoom, or re-layout.
    const mapping = Model.mapNotes(bridge.osmd, bridge.xml);
    const note = hit?.graphicalNote?.sourceNote || hit?.graphicalNote?.SourceNote;
    const at = note && mapping.get(note);
    if (!at) {
      $("status").textContent = "This note cannot be matched safely to MusicXML. No correction was made.";
      return;
    }
    stopSelection();
    selected = at;
    selectedElement = element;
    element.classList.add("is-inspected");
    window.SheetReader?.player?.pause();
    window.WorkbenchPlayer?.stop();
    const info = Model.describe(current().doc, at);
    info.members.forEach((member) => $("member").add(new Option(member.label, member.noteIndex)));
    $("member").value = String(at.noteIndex);
    $("member").disabled = info.members.length < 2;
    fill();
    dialog.showModal();
  }
  container.addEventListener(
    "click",
    (event) => {
      if (!active() && !busy) return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target.closest(".vf-stavenote");
      if (!element) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;
      open(bridge.resolveNoteAt(event.pageX, event.pageY, 80, event.target), element);
    },
    true
  );
  container.addEventListener(
    "keydown",
    (event) => {
      if ((!active() && !busy) || !["Enter", " "].includes(event.key)) return;
      const element = event.target.closest(".vf-stavenote");
      if (!element) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;
      const rect = element.getBoundingClientRect();
      open(bridge.resolveNoteAt(rect.left + rect.width / 2 + scrollX, rect.top + rect.height / 2 + scrollY, 80, element), element);
    },
    true
  );
  $("member").addEventListener("change", () => {
    selected = { ...selected, noteIndex: Number($("member").value) };
    fill();
  });
  ["type", "dots"].forEach((name) =>
    $(name).addEventListener("change", () => {
      rhythmChanged = true;
    })
  );
  $("close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => selectedElement?.focus({ preventScroll: true }));
  async function replace(doc, after, measure) {
    const request = generation;
    busy = true;
    refresh();
    try {
      const applied = await bridge.replaceLocalXML(doc);
      if (!applied || request !== generation) return;
      after();
      stopSelection();
      if (measure) window.SheetReader?.player?.seek(measure);
      $("status").textContent = dirty() ? "Correction applied. Download edited MusicXML to keep your changes." : "Back to the downloaded version.";
      container.focus({ preventScroll: true });
    } catch (error) {
      if (request === generation) $("status").textContent = "Correction not applied: " + error.message;
    } finally {
      if (request === generation) {
        busy = false;
        refresh();
      }
    }
  }
  $("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !selected) return;
    try {
      const changes = {};
      if (!$("pitch").disabled) changes.pitch = { step: $("step").value, alter: Number($("alter").value), octave: Number($("octave").value) };
      if (rhythmChanged && !$("rhythm").disabled && $("type").value) {
        changes.type = $("type").value;
        changes.dots = Number($("dots").value);
      }
      const doc = Model.apply(current().doc, selected, changes);
      if (!doc) {
        dialog.close();
        return;
      }
      const measure = selected.measureIndex + 1;
      dialog.close();
      await replace(doc, () => record(doc), measure);
    } catch (error) {
      $("error").textContent = error.message;
    }
  });
  const travel = (delta) => {
    if (busy || !history[cursor + delta]) return;
    const target = cursor + delta;
    stopSelection();
    return replace(history[target].doc, () => {
      cursor = target;
    });
  };
  $("undo").addEventListener("click", () => travel(-1));
  $("redo").addEventListener("click", () => travel(1));
  document.addEventListener("keydown", (event) => {
    if (
      !active() ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.defaultPrevented ||
      event.target.closest("input, select, textarea, [contenteditable]")
    )
      return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    event.preventDefault();
    travel(key === "y" || event.shiftKey ? 1 : -1);
  });
  $("download").addEventListener("click", () => {
    if (!current() || busy) return;
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', serialize(current().doc)], {
      type: "application/vnd.recordare.musicxml+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    downloads.add(url);
    const anchor = document.createElement("a");
    const name = (bridge.localFileName || "score").replace(/\.(musicxml|xml)$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
    anchor.href = url;
    anchor.download = name + "-edited.musicxml";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    saved = current().id;
    $("status").textContent = "MusicXML download started. Your original file is unchanged.";
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.delete(url);
    }, 1000);
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  window.SheetCorrections = {
    hasUnsavedChanges: dirty,
    confirmDiscard: () => !dirty() || window.confirm("These corrections have not been downloaded. Discard them?"),
  };
  reset();
})();
