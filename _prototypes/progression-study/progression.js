/* Read-only ii–V–I study. No editor, storage, or workbench session state. */
(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const M = window.Music;
  const Player = window.WorkbenchPlayer;
  const Hands = window.PrototypeHandInspector;
  const $ = (id) => document.getElementById(id);
  const chords = ["Am7", "D7", "Gmaj7"].map(Model.fromName);
  const allVoices = chords.flatMap((chord) => Model.voices(chord).map((voice) => voice.midi));
  const range = {
    low: Math.floor((Math.min(...allVoices) - 1) / 3) * 3,
    high: Math.ceil((Math.max(...allVoices) + 2) / 3) * 3 - 1,
  };
  // Extend the A/D/G/C excerpt through E and B to include Gmaj7's B minor button.
  const leftRoots = [11, 4, 9, 2, 7, 0];
  const choices = chords.map(() => ({}));
  const performance = (i) => Hands.performance(chords[i], leftRoots, choices[i]);
  const key = 7;
  const steps = [...document.querySelectorAll("[data-step]")];
  let index = 0;
  let playback = null;
  let generation = 0;

  function render() {
    Hands.render(chords[index], { right: range, left: leftRoots }, choices[index]);
    steps.forEach((step, i) => {
      if (i === index) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      step.querySelector(".step-function").textContent = Model.functionInKey(chords[i], key);
      step.setAttribute("aria-label", chords[i].name + ", " + Model.functionInKey(chords[i], key) + ", step " + (i + 1) + " of 3");
    });
    $("previous").disabled = index === 0;
    $("next").disabled = index === chords.length - 1;
    $("step-position").textContent = index + 1 + " of " + chords.length;

    const from = chords[Math.min(index, chords.length - 2)];
    const to = chords[Math.min(index + 1, chords.length - 1)];
    const common = from.notes.filter((pc) => to.notes.includes(pc));
    $("transition-heading").textContent = index === chords.length - 1 ? "Arrival" : "Next change";
    $("transition-route").textContent = from.name + " → " + to.name;
    $("common-tones").textContent = common.map(M.noteName).join(" · ") || "None";
    // Both roots move upward by a perfect fourth in this fixed example.
    const semitones = Model.mod(to.root - from.root);
    $("root-movement").innerHTML =
      M.esc(M.noteName(from.root) + " → " + M.noteName(to.root)) +
      "<small>" +
      (semitones === 5 ? "Up a fourth" : semitones + " semitones up") +
      "</small>";
    $("transition-note").textContent =
      index === 2
        ? "Gmaj7 is the tonic: the progression arrives home."
        : index === 1
          ? "The dominant moves to the tonic."
          : "The ii chord leads to the dominant.";
    $("change-status").textContent = "Step " + (index + 1) + " of 3. " + $("change-status").textContent;
  }

  function select(next) {
    if (next < 0 || next >= chords.length) return;
    const focused = document.activeElement;
    Player.stop();
    index = next;
    render();
    if (focused.disabled) steps[index].focus();
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
    const performances = chords.map((_, i) => performance(i));
    start(
      "sequence",
      performances.map((sound) => sound.midis),
      {
        progression: true,
        bpm: 96,
        onStep: (next) => {
          playback = "sequence";
          index = next;
          render();
          steps.forEach((step, i) => step.classList.toggle("is-playing", i === index));
          Hands.markSounding(performances[index]);
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
      hear(performance(index));
    }
  });
  $("previous").addEventListener("click", () => select(index - 1));
  $("next").addEventListener("click", () => select(index + 1));
  steps.forEach((step, i) => {
    step.addEventListener("click", () => select(i));
    step.addEventListener("keydown", (event) => {
      const target =
        event.key === "ArrowRight"
          ? i + 1
          : event.key === "ArrowLeft"
            ? i - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? chords.length - 1
                : null;
      if (target === null || target < 0 || target >= chords.length) return;
      event.preventDefault();
      steps[target].focus();
      select(target);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    Player.stop();
    Hands.clearInspection();
  });
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme").setAttribute("aria-pressed", String(dark));
  });
  render();
  Hands.bind(hear, (next) => {
    Player.stop();
    choices[index] = next;
    render();
  });
})();
