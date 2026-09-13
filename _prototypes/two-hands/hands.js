(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const Hands = window.PrototypeHandInspector;
  const Player = window.WorkbenchPlayer;
  const $ = (id) => document.getElementById(id);
  const model = Model.fromName("Am7");
  let choice = {};
  let playing = false,
    generation = 0;

  Player.onStop(() => {
    generation++;
    playing = false;
    Hands.markSounding();
    $("play-label").textContent = "Hear both hands";
    $("play").removeAttribute("aria-label");
  });

  async function play(sound) {
    $("audio-status").hidden = true;
    const result = Player.play([sound.midis], {
      onStep: () => Hands.markSounding(sound),
      onError: (message) => {
        $("audio-status").textContent = message;
        $("audio-status").hidden = false;
      },
    });
    const ticket = ++generation;
    playing = true;
    $("play-label").textContent = "Stop";
    $("play").setAttribute("aria-label", "Stop playback");
    if (!(await result) && ticket === generation) Player.stop();
  }

  $("play").addEventListener("click", () => {
    if (playing) return Player.stop();
    Hands.clearInspection();
    play(Hands.performance(model, undefined, choice));
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
  Hands.render(model);
  Hands.bind(play, (next) => {
    Player.stop();
    choice = next;
    Hands.render(model, {}, choice);
  });
})();
