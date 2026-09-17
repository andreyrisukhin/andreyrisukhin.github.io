/* Prototype progression editor. Reuses session edits without storage or production UI. */
(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const M = window.Music;
  const Player = window.WorkbenchPlayer;
  const Hands = window.PrototypeHandInspector;
  const $ = (id) => document.getElementById(id);
  const session = window.WorkbenchSession.create();
  session.set(["Am7", "D7", "Gmaj7"].map(Model.fromName), { mode: "progression", key: 7 });
  const state = session.state;
  // Extend the A/D/G/C excerpt through E and B to include Gmaj7's B minor button.
  const leftRoots = [11, 4, 9, 2, 7, 0];
  // Session moves preserve model identity; new/replaced chords get fresh choices.
  const choices = new WeakMap();
  const performance = (i) => Hands.performance(state.items[i], leftRoots, choices.get(state.items[i]));
  const spell = (chord, pc) =>
    Model.voices(chord)
      .find((voice) => voice.pc === pc)
      .name.replace(/b/g, "♭")
      .replace(/#/g, "♯");
  let steps = [];
  let playback = null;
  let generation = 0;

  function rebuildSteps() {
    $("sequence-steps").innerHTML = state.items
      .map(
        (chord, i) =>
          '<li><button type="button" class="sequence-step" data-step="' +
          i +
          '"><span class="step-name">' +
          M.esc(chord.name) +
          '</span><span class="step-function"></span></button></li>'
      )
      .join("");
    steps = [...document.querySelectorAll("[data-step]")];
  }

  function render() {
    const { items: chords, index, key } = state;
    const empty = !chords.length;
    $("chord-inspector").hidden = empty;
    $("empty-sequence").hidden = !empty;
    $("sequence-steps").hidden = empty;
    $("sequence-name").textContent = chords.map((chord) => chord.name).join() === "Am7,D7,Gmaj7" ? "ii–V–I" : "Progression";
    if (!empty) {
      const allVoices = chords.flatMap((chord) => Model.voices(chord).map((voice) => voice.midi));
      const range = {
        low: Math.floor((Math.min(...allVoices) - 1) / 3) * 3,
        high: Math.ceil((Math.max(...allVoices) + 2) / 3) * 3 - 1,
      };
      Hands.render(chords[index], { right: range, left: leftRoots }, choices.get(chords[index]));
      $("change-status").textContent = "Step " + (index + 1) + " of " + chords.length + ". " + $("change-status").textContent;
    }
    steps.forEach((step, i) => {
      if (i === index) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      step.querySelector(".step-function").textContent = Model.functionInKey(chords[i], key);
      step.setAttribute("aria-label", chords[i].name + ", " + Model.functionInKey(chords[i], key) + ", step " + (i + 1) + " of " + chords.length);
    });
    $("previous").disabled = empty || index === 0;
    $("next").disabled = empty || index === chords.length - 1;
    $("step-position").textContent = empty ? "No chords" : index + 1 + " of " + chords.length;
    $("replace-chord").disabled = $("remove-chord").disabled = empty;
    $("move-earlier").disabled = empty || index === 0;
    $("move-later").disabled = empty || index === chords.length - 1;
    $("edit-target").textContent = empty ? "No chord selected." : "Selected: step " + (index + 1) + " · " + chords[index].name;

    const unavailable = chords.flatMap((chord, i) => (performance(i).midis.length ? [] : ["step " + (i + 1) + " (" + chord.name + ")"]));
    $("play-sequence").disabled = empty || unavailable.length > 0;
    $("sequence-warning").hidden = !unavailable.length;
    $("sequence-warning").textContent = unavailable.length
      ? "Two-hand playback unavailable for " +
        unavailable.join(", ") +
        ". No playable left-hand voicing in this excerpt. You can still inspect the chord."
      : "";

    $("transition-facts").hidden = chords.length < 2;
    if (chords.length < 2) {
      $("transition-heading").textContent = empty ? "Next change" : "One chord";
      $("transition-route").textContent = empty ? "" : chords[0].name;
      $("transition-note").textContent = "Add another chord to compare common tones and root movement.";
      return;
    }

    const from = chords[Math.min(index, chords.length - 2)];
    const to = chords[Math.min(index + 1, chords.length - 1)];
    const common = from.notes.filter((pc) => to.notes.includes(pc));
    $("transition-heading").textContent = index === chords.length - 1 ? "Arrival" : "Next change";
    $("transition-route").textContent = from.name + " → " + to.name;
    $("common-tones").textContent = common.map((pc) => spell(from, pc)).join(" · ") || "None";
    const semitones = Model.mod(to.root - from.root);
    const intervals = [
      "Same root",
      "Up a minor second",
      "Up a major second",
      "Up a minor third",
      "Up a major third",
      "Up a fourth",
      "Up a tritone",
      "Up a fifth",
      "Up a minor sixth",
      "Up a major sixth",
      "Up a minor seventh",
      "Up a major seventh",
    ];
    $("root-movement").innerHTML = M.esc(spell(from, from.root) + " → " + spell(to, to.root)) + "<small>" + intervals[semitones] + "</small>";
    $("transition-note").textContent =
      Model.functionInKey(from, key) + " → " + Model.functionInKey(to, key) + " in G major. Common tones compare pitch classes, not octaves.";
  }

  function clearError() {
    $("input-error").hidden = true;
    $("chord-input").removeAttribute("aria-invalid");
  }

  function syncInput() {
    clearError();
    $("chord-input").value = state.items[state.index]?.name || "";
  }

  function finishEdit(message) {
    const focused = document.activeElement;
    rebuildSteps();
    render();
    syncInput();
    $("edit-status").textContent = message;
    if (focused.disabled) $("chord-input").focus();
  }

  function insert(replace) {
    const chord = Model.fromName($("chord-input").value);
    if (!chord) {
      $("input-error").textContent = "Use one chord name, such as Am7 or Cmaj7.";
      $("input-error").hidden = false;
      $("chord-input").setAttribute("aria-invalid", "true");
      $("chord-input").focus();
      return;
    }
    if (replace && !state.items.length) return;
    Player.stop();
    if (!session.insert([chord], replace)) {
      $("input-error").textContent = "This prototype supports up to 128 chords. Remove a step before adding another.";
      $("input-error").hidden = false;
      return;
    }
    finishEdit(chord.name + (replace ? " replaced the selected chord." : " added at step " + (state.index + 1) + "."));
    $("chord-input").focus();
    $("chord-input").select();
  }

  function select(next) {
    if (next < 0 || next >= state.items.length) return;
    const focused = document.activeElement;
    Player.stop();
    state.index = next;
    render();
    if (!$("progression-editor").hidden) syncInput();
    if (focused.disabled) steps[state.index].focus();
  }

  function audioError(message) {
    $("audio-status").textContent = message;
    $("audio-status").hidden = false;
  }

  Player.onStop(() => {
    generation++;
    playback = null;
    Hands.markSounding();
    steps.forEach((step) => step.classList.remove("is-playing"));
    $("sequence-play-label").textContent = "Play all";
    $("play-sequence").setAttribute("aria-label", "Play both hands from the beginning");
    $("play-label").textContent = "Hear both hands";
    $("play").removeAttribute("aria-label");
    $("play").disabled = !state.items.length || !performance(state.index).midis.length;
  });

  async function start(kind, pitches, options) {
    $("audio-status").hidden = true;
    const result = Player.play(pitches, options);
    const ticket = ++generation;
    playback = kind;
    if (kind === "sequence") {
      $("sequence-play-label").textContent = "Stop";
      $("play-sequence").setAttribute("aria-label", "Stop progression playback");
    } else {
      $("play").disabled = false;
      $("play-label").textContent = "Stop";
      $("play").setAttribute("aria-label", "Stop note or chord playback");
    }
    if (!(await result) && ticket === generation) Player.stop();
  }

  function hear(sound) {
    start("note", [sound.midis], {
      onStep: () => {
        playback = "note";
        Hands.markSounding(sound);
        $("play-label").textContent = "Stop";
        $("play").setAttribute("aria-label", "Stop playback");
      },
      onError: audioError,
    });
  }

  $("play-sequence").addEventListener("click", () => {
    if (playback === "sequence") {
      Player.stop();
      return;
    }
    Hands.clearInspection();
    const performances = state.items.map((_, i) => performance(i));
    if (!performances.length || performances.some((sound) => !sound.midis.length)) return;
    start(
      "sequence",
      performances.map((sound) => sound.midis),
      {
        progression: true,
        bpm: 96,
        onStep: (next) => {
          playback = "sequence";
          state.index = next;
          render();
          if (!$("progression-editor").hidden) syncInput();
          steps.forEach((step, i) => step.classList.toggle("is-playing", i === state.index));
          Hands.markSounding(performances[state.index]);
          $("sequence-play-label").textContent = "Stop";
          $("play-sequence").setAttribute("aria-label", "Stop progression playback");
        },
        onError: audioError,
      }
    );
  });
  $("play").addEventListener("click", () => {
    if (playback === "note") Player.stop();
    else {
      Hands.clearInspection();
      hear(performance(state.index));
    }
  });
  $("previous").addEventListener("click", () => select(state.index - 1));
  $("next").addEventListener("click", () => select(state.index + 1));
  $("sequence-steps").addEventListener("click", (event) => {
    const step = event.target.closest("[data-step]");
    if (step) select(Number(step.dataset.step));
  });
  $("sequence-steps").addEventListener("keydown", (event) => {
    const step = event.target.closest("[data-step]");
    if (!step) return;
    const i = Number(step.dataset.step);
    const target =
      event.key === "ArrowRight"
        ? i + 1
        : event.key === "ArrowLeft"
          ? i - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? state.items.length - 1
              : null;
    if (target === null || target < 0 || target >= state.items.length) return;
    event.preventDefault();
    steps[target].focus();
    select(target);
  });
  $("edit-toggle").addEventListener("click", () => {
    Player.stop();
    const open = $("progression-editor").hidden;
    $("progression-editor").hidden = !open;
    $("edit-toggle").setAttribute("aria-expanded", String(open));
    $("edit-toggle").textContent = open ? "Done editing" : "Edit progression";
    if (open) {
      syncInput();
      $("chord-input").focus();
    }
  });
  $("chord-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insert(false);
  });
  $("replace-chord").addEventListener("click", () => insert(true));
  $("chord-input").addEventListener("input", () => {
    Player.stop();
    clearError();
  });
  [
    ["move-earlier", -1],
    ["move-later", 1],
  ].forEach(([id, delta]) => {
    $(id).addEventListener("click", () => {
      Player.stop();
      session.move(delta);
      finishEdit("Selected chord moved to step " + (state.index + 1) + ".");
    });
  });
  $("remove-chord").addEventListener("click", () => {
    if (!state.items.length) return;
    const name = state.items[state.index].name;
    Player.stop();
    session.remove();
    finishEdit(name + " removed.");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    Player.stop();
    if (state.items.length) Hands.clearInspection();
    if (!$("progression-editor").hidden && $("progression-editor").contains(document.activeElement)) {
      $("edit-toggle").click();
      $("edit-toggle").focus();
    }
  });
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme").setAttribute("aria-pressed", String(dark));
  });
  rebuildSteps();
  render();
  Hands.bind(hear, (next) => {
    Player.stop();
    choices.set(state.items[state.index], next);
    render();
  });
})();
