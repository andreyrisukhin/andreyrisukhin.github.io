/* A visual prototype, not another workbench controller. No persistence or PWA. */
(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const Player = window.WorkbenchPlayer;
  const Diagrams = window.WorkbenchDiagrams;
  const M = window.Music;
  const $ = (id) => document.getElementById(id);
  const pretty = (name) => name.replace(/b/g, "♭").replace(/#/g, "♯");
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
    $("chord-name").textContent = pretty(model.name);
    const chord = window.Tonal.Chord.get(Model.normalize(name).split("/")[0]);
    $("chord-description").textContent = chord.type ? pretty(chord.tonic) + " " + chord.type : chord.notes.length + " chord tones";
    const voices = Model.voices(model);
    $("staff").innerHTML = Diagrams.staff(model);
    const svg = $("staff").querySelector("svg");
    const width = svg.viewBox.baseVal.width;
    const positions = [...svg.querySelectorAll("ellipse")].map((note) => Number(note.getAttribute("cx")));
    const notation = document.createElement("div");
    notation.className = "notation";
    notation.style.minWidth = width + "px";
    const tones = document.createElement("div");
    tones.className = "tones";
    tones.innerHTML = voices
      .map((v) => {
        const index = model.detail.notes.findIndex((n) => window.Tonal.Note.chroma(n) === v.pc);
        const degree = index < 0 ? "Bass" : model.detail.intervals[index];
        return (
          '<div class="tone"><span>' +
          M.esc(degree === "1" ? "Root" : degree) +
          '</span><span class="pitch">' +
          M.esc(pretty(v.name)) +
          "<sub>" +
          v.octave +
          "</sub></span></div>"
        );
      })
      .join("");
    [...tones.children].forEach((tone, i) => {
      tone.style.left = (positions[i] / width) * 100 + "%";
    });
    notation.append(svg, tones);
    $("staff").append(notation);
    window.BayanKeyboard.mount($("keyboard"), {
      low: Math.max(0, voices[0].midi - 3),
      high: Math.min(127, Math.max(voices[0].midi + 11, voices[voices.length - 1].midi + 1)),
      selected: voices.map((v) => v.midi),
      root: voices.find((v) => v.pc === model.root)?.midi,
      labels: Object.fromEntries(voices.map((v) => [v.midi, pretty(v.name) + v.octave])),
    });
    const recipes = Model.recipes(model);
    const recipe = recipes.find((r) => r.exact) || recipes[0];
    if (recipe) {
      $("recipe").textContent = [M.noteName(recipe.bass) + " bass", ...recipe.parts.map((p) => p.name)].join(" + ");
      const detail = [];
      if (recipe.rh != null) detail.push("Add " + M.noteName(recipe.rh) + " in the right hand.");
      if (recipe.exact) detail.push("All chord tones, no extra notes.");
      if (recipe.missing.length) detail.push("Missing: " + recipe.missing.map(M.noteName).join(", ") + ".");
      if (recipe.extra.length) detail.push("Adds: " + recipe.extra.map(M.noteName).join(", ") + ".");
      if (recipe.warning) detail.push(recipe.warning);
      $("recipe-detail").textContent = detail.join(" ");
    } else {
      $("recipe").textContent = "No bass recipe in the catalog.";
      $("recipe-detail").textContent = "Use the right-hand notes to study this chord.";
    }
    $("change-status").textContent = pretty(model.name) + ": " + voices.map((v) => pretty(v.name)).join(", ");
  }

  function markSounding(midis) {
    document.querySelectorAll("[data-midi]").forEach((el) => {
      el.classList.toggle("is-sounding", midis.includes(Number(el.dataset.midi)));
    });
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
  window.BayanKeyboard.bind($("keyboard"), { onActivate: (midi) => play([midi], false) });
  function playStaff(event) {
    const note = event.target.closest("[data-midi]");
    if (note) play([Number(note.dataset.midi)], false);
  }
  $("staff").addEventListener("click", playStaff);
  $("staff").addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-midi]")) {
      event.preventDefault();
      playStaff(event);
    }
  });
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme").setAttribute("aria-pressed", String(dark));
  });
  render("Am7");
})();
