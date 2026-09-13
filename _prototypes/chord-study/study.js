/* A visual prototype, not another workbench controller. No persistence or PWA. */
(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const Player = window.WorkbenchPlayer;
  const Inspector = window.PrototypeChordInspector;
  const $ = (id) => document.getElementById(id);
  let model;

  function render(name) {
    const next = Model.fromName(name);
    if (!next) {
      $("input-error").textContent = "Use one chord name, such as Am7 or Cmaj7.";
      $("input-error").hidden = false;
      $("chord-input").setAttribute("aria-invalid", "true");
      return;
    }
    Player.stop();
    model = next;
    $("input-error").hidden = true;
    $("chord-input").removeAttribute("aria-invalid");
    $("chord-input").value = name;
    Inspector.render(model);
  }

  function markSounding(midis) {
    Inspector.markSounding(midis);
  }
  function play(midis, wholeChord) {
    $("audio-status").hidden = true;
    Player.play([midis], {
      onStep: () => {
        markSounding(midis);
        $("play-label").textContent = "Stop";
        $("play").setAttribute("aria-label", wholeChord ? "Stop chord playback" : "Stop note playback");
      },
      onError: (message) => {
        $("audio-status").textContent = message;
        $("audio-status").hidden = false;
      },
    });
  }
  Player.onStop(() => {
    markSounding([]);
    $("play-label").textContent = "Hear chord";
    $("play").removeAttribute("aria-label");
  });
  $("play").addEventListener("click", () => {
    if (Player.isPlaying()) Player.stop();
    else
      play(
        Model.voices(model).map((v) => v.midi),
        true
      );
  });
  $("chord-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render($("chord-input").value.trim());
  });
  document.querySelectorAll("[data-chord]").forEach((button) => {
    button.addEventListener("click", () => render(button.dataset.chord));
  });
  Inspector.bind((midi) => play([midi], false));
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme").setAttribute("aria-pressed", String(dark));
  });
  render("Am7");
})();
