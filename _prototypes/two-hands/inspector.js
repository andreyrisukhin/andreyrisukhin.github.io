/* Shared hand diagrams and button inspection. The page owns chord selection and audio. */
window.PrototypeHandInspector = (function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const Left = window.PrototypeStradella;
  const Inspector = window.PrototypeChordInspector;
  const Voicings = window.PrototypeVoicings;
  const $ = (id) => document.getElementById(id);
  const pretty = (name) => name.replace(/b/g, "♭").replace(/#/g, "♯");
  let model, cells, baseLabels, choice;
  let leftRoots = Left.roots;
  let initialized = false;
  let hover = null,
    focus = null,
    pinned = null;

  function inspectionModel(cell) {
    return {
      name: cell.name,
      root: cell.root,
      notes: cell.notes,
      detail: { notes: cell.spellings, intervals: cell.intervals },
    };
  }

  function performance(chord, visibleRoots = Left.roots, selectedChoice = {}) {
    const voicing = Voicings.resolve(chord, visibleRoots, selectedChoice);
    if (!voicing) return { midis: [], leftIds: [], rightMidis: [] };
    const rightMidis = Model.voices(chord).map((voice) => voice.midi);
    return { midis: [...voicing.midis, ...rightMidis], leftIds: voicing.leftIds, rightMidis };
  }

  function link() {
    const cell = hover || focus || pinned;
    const notes = cell?.notes || [];
    document.querySelectorAll(".hand-key").forEach((button) => button.classList.toggle("is-linked", button.dataset.leftId === cell?.id));
    document.querySelectorAll("#keyboard [data-pc], #staff [data-pc]").forEach((note) => {
      note.classList.toggle("is-linked", notes.includes(+note.dataset.pc));
    });
    document.querySelectorAll("#staff .tone").forEach((tone, i) => {
      tone.classList.toggle("is-linked", notes.includes(model.notes[i]));
    });
    document.querySelectorAll(".bayan-key").forEach((button) => {
      const midi = +button.dataset.midi;
      const index = notes.indexOf(midi % 12);
      let label = baseLabels.get(midi);
      // Selected voices retain their chord spelling; other keys can use the inspected spelling.
      if (index >= 0 && !button.classList.contains("is-selected")) {
        const name = cell.spellings[index];
        const octave = 4 + Math.round((midi - window.Tonal.Note.midi(name + "4")) / 12);
        label = pretty(name) + octave;
      }
      button.querySelector("span").textContent = label;
      button.setAttribute("aria-label", "Hear " + label);
    });
    $("clear-inspection").disabled = !cell;
    if (cell) {
      const names = cell.spellings.map(pretty);
      const outside = names.filter((_, i) => !model.notes.includes(cell.notes[i]));
      $("button-name").textContent = cell.name;
      Inspector.renderNotation($("button-staff"), inspectionModel(cell), {
        interactive: false,
        label: cell.name + ": " + names.join(", ") + ". Pitch reference, not sounding octaves.",
      });
      $("button-detail").textContent = outside.length
        ? "Outside " + pretty(model.name) + ": " + outside.join(", ") + "."
        : "All tones belong to " + pretty(model.name) + ".";
      return cell.name + ": " + names.join(", ") + ". " + $("button-detail").textContent;
    }
    $("button-name").textContent = "Nothing inspected";
    $("button-staff").textContent = "Hover, focus, or tap a left-hand button to see every tone.";
    $("button-detail").textContent = "The selected chord stays unchanged.";
    return "Button inspection cleared.";
  }

  function clearInspection() {
    const restoreFocus = document.activeElement === $("clear-inspection");
    hover = focus = pinned = null;
    $("button-status").textContent = link();
    if (restoreFocus) $("left-scroll").focus({ preventScroll: true });
  }

  function render(next, range = {}, selectedChoice = {}) {
    model = next;
    leftRoots = range.left || Left.roots;
    cells = Left.layout(leftRoots);
    hover = focus = pinned = null;
    Inspector.render(model, range.right);
    baseLabels = new Map(
      [...document.querySelectorAll(".bayan-key")].map((button) => [+button.dataset.midi, button.querySelector("span").textContent])
    );
    const scroll = $("left-scroll").scrollLeft;
    const voicing = Voicings.resolve(model, leftRoots, selectedChoice);
    choice = voicing?.choice || selectedChoice;
    Left.mount($("left-keyboard"), model, leftRoots, choice);
    $("left-scroll").scrollLeft = initialized ? scroll : $("left-scroll").scrollWidth;
    initialized = true;
    const escape = window.Music.esc;
    $("voicing").innerHTML = Voicings.options(model, leftRoots, choice.bass)
      .map(
        (item) =>
          '<option value="' +
          escape(item.id) +
          '"' +
          (item.available ? "" : " disabled") +
          ">" +
          escape(item.label + (item.available ? "" : " (outside excerpt)")) +
          "</option>"
      )
      .join("");
    $("bass-choice").innerHTML = Voicings.basses(model, leftRoots)
      .map(
        (item) =>
          '<option value="' +
          item.pc +
          '"' +
          (item.available ? "" : " disabled") +
          ">" +
          escape(item.label + (item.available ? "" : " (outside excerpt)")) +
          "</option>"
      )
      .join("");
    $("voicing").value = choice.voicing || "";
    $("bass-choice").value = String(choice.bass ?? model.notes[0]);
    $("play").disabled = $("hear-left").disabled = !voicing;
    $("recipe").textContent = voicing?.recipe || "No playable voicing in this excerpt.";
    $("recipe-detail").textContent = voicing?.detail || "Choose an available button combination and bass.";
    $("change-status").textContent += " Left hand: " + $("recipe").textContent + ".";
    link();
    $("button-status").textContent = "";
  }

  function markSounding(sound = {}) {
    Inspector.markSounding(sound.rightMidis || []);
    document.querySelectorAll(".hand-key").forEach((button) => {
      button.classList.toggle("is-sounding", (sound.leftIds || []).includes(button.dataset.leftId));
    });
  }

  function bind(onAudition, onVoicingChange) {
    function leftCell(target) {
      const button = target.closest("[data-left-id]");
      return button && $("left-keyboard").contains(button) ? cells.find((cell) => cell.id === button.dataset.leftId) : null;
    }
    $("left-keyboard").addEventListener("pointerover", (event) => {
      hover = leftCell(event.target);
      link();
    });
    $("left-keyboard").addEventListener("pointerleave", () => {
      hover = null;
      link();
    });
    $("left-keyboard").addEventListener("focusin", (event) => {
      hover = null;
      focus = leftCell(event.target);
      $("button-status").textContent = link();
    });
    $("left-keyboard").addEventListener("focusout", (event) => {
      if (event.relatedTarget === $("clear-inspection")) return;
      focus = event.relatedTarget ? leftCell(event.relatedTarget) : null;
      link();
    });
    Left.bind(
      $("left-keyboard"),
      {
        onActivate: (cell) => {
          pinned = focus = cell;
          hover = null;
          $("button-status").textContent = link();
          onAudition({ midis: cell.midis, leftIds: [cell.id], rightMidis: [] });
        },
      },
      leftRoots
    );
    Inspector.bind((midi) => {
      clearInspection();
      onAudition({ midis: [midi], leftIds: [], rightMidis: [midi] });
    });
    $("clear-inspection").addEventListener("click", clearInspection);
    ["voicing", "bass-choice"].forEach((id) => {
      $(id).addEventListener("change", () =>
        onVoicingChange({
          voicing: $("voicing").value,
          bass: Number($("bass-choice").value),
        })
      );
    });
    $("hear-left").addEventListener("click", () => {
      clearInspection();
      const voicing = Voicings.resolve(model, leftRoots, choice);
      if (voicing) onAudition({ midis: voicing.midis, leftIds: voicing.leftIds, rightMidis: [] });
    });
  }

  return { inspectionModel, performance, render, markSounding, clearInspection, bind };
})();
