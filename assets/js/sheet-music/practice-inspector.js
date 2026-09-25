/* The score supplies written pitches; Stradella supplies suggestions, never a rewrite. */
(function () {
  "use strict";
  const page = document.querySelector(".sheet-practice");
  if (!page) return;
  const bridge = window.__sheetMusic;
  const dialog = document.getElementById("sheet-inspector");
  const $ = (id) => document.getElementById(id);
  const action = (name) => dialog.querySelector("[data-inspect-" + name + "]");
  const T = window.Tonal;
  const Left = window.WorkbenchStradella;
  const Voicings = window.WorkbenchVoicings;
  let selection,
    recipe,
    cells = [],
    notes = [];
  let selectedElement;
  const pretty = (value) => value.replace(/#/g, "♯").replace(/b/g, "♭");
  const status = dialog.querySelector("[data-inspect-status]");
  let audition = 0;
  function hear(midis) {
    const request = ++audition;
    window.SheetPractice?.player.pause();
    const playing = window.WorkbenchPlayer.play([midis], {
      onError: (message) => {
        status.textContent = message;
      },
    });
    action("stop").disabled = false;
    playing.then((started) => {
      if (!started && request === audition) action("stop").disabled = true;
    });
  }
  window.WorkbenchPlayer.subscribeStop(() => {
    action("stop").disabled = true;
  });
  action("stop").addEventListener("click", () => window.WorkbenchPlayer.stop());
  action("close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    window.WorkbenchPlayer.stop();
    selectedElement?.focus({ preventScroll: true });
  });
  action("hear").addEventListener("click", () => hear(selection.pitches.map(T.Note.midi)));
  action("left").addEventListener("click", () => {
    if (recipe) hear(recipe.midis);
  });
  action("seek").addEventListener("click", () => {
    window.SheetPractice?.player.seek(selection.measureNumber);
    dialog.close();
  });
  action("loop").addEventListener("click", () => {
    window.SheetPractice?.player.setLoop(selection.measureNumber, selection.measureNumber, true);
    window.SheetPractice?.player.seek(selection.measureNumber);
    dialog.close();
    page.querySelector(".practice-settings").open = true;
  });
  window.BayanKeyboard.bind($("sheet-right-keyboard"), { onActivate: (midi) => hear([midi]) });
  function leftCell(target) {
    const button = target.closest("[data-left-id]");
    return button ? cells.find((cell) => cell.id === button.dataset.leftId) : null;
  }
  function inspectCell(cell) {
    if (!cell) return;
    const outside = cell.notes.filter((pc) => !selection.pitches.some((pitch) => T.Note.chroma(pitch) === pc));
    $("sheet-button-detail").textContent =
      cell.name +
      ": " +
      cell.spellings.map(pretty).join(" · ") +
      (outside.length ? ". Includes tones outside the written selection." : ". All tones are in the written selection.");
    $("sheet-right-keyboard")
      .querySelectorAll("[data-pc]")
      .forEach((button) => {
        button.classList.toggle("is-linked", cell.notes.includes(Number(button.dataset.pc)));
      });
  }
  const leftHost = $("sheet-left-keyboard");
  leftHost.addEventListener("focusin", (event) => inspectCell(leftCell(event.target)));
  leftHost.addEventListener("pointerover", (event) => inspectCell(leftCell(event.target)));
  leftHost.addEventListener("click", (event) => {
    const cell = leftCell(event.target);
    if (cell) {
      inspectCell(cell);
      hear(cell.midis);
    }
  });
  leftHost.addEventListener("keydown", (event) => {
    const cell = leftCell(event.target);
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (!cell || !delta) return;
    event.preventDefault();
    const next = cells.find((other) => other.row === cell.row + delta[0] && other.column === cell.column + delta[1]);
    if (next) leftHost.querySelector('[data-left-id="' + next.id + '"]').focus();
  });
  function open(hit, element) {
    if (!hit || hit.isRest || !hit.pitches.length) return;
    window.SheetPractice?.player.pause();
    window.WorkbenchPlayer.stop();
    selectedElement?.classList.remove("is-inspected");
    selectedElement = element;
    selectedElement?.classList.add("is-inspected");
    selection = hit;
    const pitches = hit.pitches.slice().sort((a, b) => T.Note.midi(a) - T.Note.midi(b));
    const midis = pitches.map(T.Note.midi);
    const name = hit.chordName || (pitches.length === 1 ? pitches[0] : "Selected notes");
    $("sheet-note-title").textContent = pretty(name);
    $("sheet-note-location").textContent = "Measure " + hit.measureNumber + (hit.staffIndex != null ? " · Staff " + (hit.staffIndex + 1) : "");
    $("sheet-note-pitches").textContent = "Written: " + pitches.map(pretty).join(" · ");
    $("sheet-note-context").textContent = hit.harmony
      ? "Possible harmony: " + pretty(hit.harmony) + ". The bass is inferred from other notes in this measure, not this simultaneous stack."
      : "The diagrams show this selected note group, not every voice sounding in the measure.";
    const model = window.WorkbenchModel.fromName(hit.harmony || hit.chordName || "") || window.WorkbenchModel.fromNotes(pitches.map(T.Note.chroma));
    const roots = [3, 2, 1, 0, -1, -2].map((step) => window.WorkbenchModel.mod(model.root + step * 7));
    cells = Left.layout(roots);
    recipe = Voicings.resolve(model, roots);
    Left.mount(leftHost, model, roots);
    if (pitches.length === 1) {
      const bass = cells.find((cell) => cell.kind === "bass" && cell.root === T.Note.chroma(pitches[0]));
      if (bass) {
        recipe = { midis: bass.midis, recipe: bass.name, detail: "Single bass button, not a chord. Demonstration octave only." };
        leftHost.querySelector('[data-left-id="' + bass.id + '"]').classList.add("is-selected");
      }
    }
    $("sheet-left-recipe").textContent = recipe?.recipe || "No matching button combination in this excerpt.";
    $("sheet-left-detail").textContent = recipe?.detail || "Study the written pitches on the B-system map. No left-hand substitute is assumed.";
    $("sheet-button-detail").textContent = "Focus or tap any button to inspect its tones. Audio uses demonstration registers.";
    action("left").disabled = !recipe;
    window.BayanKeyboard.mount($("sheet-right-keyboard"), {
      low: Math.max(0, Math.min(...midis) - 2),
      high: Math.min(127, Math.max(...midis) + 2),
      selected: midis,
      root: midis.find((midi) => midi % 12 === model.root),
      labels: Object.fromEntries(pitches.map((pitch) => [T.Note.midi(pitch), pretty(pitch)])),
    });
    action("seek").disabled = action("loop").disabled = !window.SheetPractice;
    status.textContent = "";
    if (!dialog.open) dialog.showModal();
  }
  function hitFor(element) {
    const rect = element.getBoundingClientRect();
    return bridge.resolveNoteAt(rect.left + rect.width / 2 + window.scrollX, rect.top + rect.height / 2 + window.scrollY, 80, element);
  }
  let focusIndex = -1;
  function bindScore() {
    const selectedIndex = notes.indexOf(selectedElement);
    notes = [...bridge.container.querySelectorAll(".vf-stavenote")].filter((note) => note.querySelector(".vf-notehead"));
    notes.forEach((note, index) => {
      note.setAttribute("tabindex", index === 0 ? "0" : "-1");
      note.setAttribute("role", "button");
      note.setAttribute("aria-haspopup", "dialog");
      note.setAttribute("aria-label", "Inspect note group " + (index + 1));
    });
    if (selectedIndex >= 0) {
      selectedElement = notes[selectedIndex];
      selectedElement?.classList.add("is-inspected");
    }
    const restore = notes[focusIndex];
    if (restore && !dialog.open) {
      notes.forEach((note) => note.setAttribute("tabindex", note === restore ? "0" : "-1"));
      restore.focus({ preventScroll: true });
    }
    focusIndex = -1;
  }
  bridge.readyPromise.then(() => {
    bindScore();
    bridge.container.addEventListener("sheet-before-render", () => {
      focusIndex = notes.indexOf(document.activeElement);
    });
    bridge.container.addEventListener("sheet-render", bindScore);
    bridge.container.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target.closest(".vf-stavenote");
      if (!element) return;
      notes.forEach((note) => note.setAttribute("tabindex", note === element ? "0" : "-1"));
      open(bridge.resolveNoteAt(event.pageX, event.pageY, 80, event.target), element);
    });
    bridge.container.addEventListener("focusin", (event) => {
      const element = event.target.closest(".vf-stavenote");
      if (!element) return;
      const hit = hitFor(element);
      if (hit?.pitches.length) element.setAttribute("aria-label", "Inspect " + hit.pitches.map(pretty).join(", ") + ", measure " + hit.measureNumber);
    });
    bridge.container.addEventListener("keydown", (event) => {
      const element = event.target.closest(".vf-stavenote");
      if (!element) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(hitFor(element), element);
        return;
      }
      const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = notes[notes.indexOf(element) + delta];
      if (next) {
        element.setAttribute("tabindex", "-1");
        next.setAttribute("tabindex", "0");
        next.focus();
      }
    });
  });
})();
