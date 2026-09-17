/* Shared notation and chord rendering; no selection or playback ownership. */
window.WorkbenchNotation = (function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const M = window.Music;
  const $ = (id) => document.getElementById(id);
  const pretty = (name) => name.replace(/b/g, "♭").replace(/#/g, "♯");

  function renderNotation(container, model, { interactive = true, label, voices = Model.voices(model) } = {}) {
    container.innerHTML = window.WorkbenchDiagrams.staff(model, voices);
    const svg = container.querySelector("svg");
    if (label) svg.setAttribute("aria-label", label);
    if (!interactive) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", label);
      svg.querySelectorAll('[role="button"]').forEach((note) => {
        note.removeAttribute("role");
        note.removeAttribute("tabindex");
        note.removeAttribute("aria-label");
      });
    }
    const width = svg.viewBox.baseVal.width;
    const positions = [...svg.querySelectorAll("ellipse")].map((note) => Number(note.getAttribute("cx")));
    const notation = document.createElement("div");
    notation.className = "notation";
    notation.style.minWidth = width + "px";
    const tones = document.createElement("div");
    tones.className = "tones";
    const detail = model.detail || { notes: voices.map((v) => v.name), intervals: voices.map((_, i) => (i ? "Note " + (i + 1) : "Bass")) };
    tones.innerHTML = voices
      .map((v) => {
        const index = detail.notes.findIndex((n) => window.Tonal.Note.chroma(n) === v.pc);
        const degree = index < 0 ? "Bass" : detail.intervals[index];
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
    container.append(notation);
  }

  function render(model, range = {}) {
    $("chord-name").textContent = pretty(model.name);
    const chord = window.Tonal.Chord.get(model.name.split("/")[0]);
    $("chord-description").textContent = chord.type ? pretty(chord.tonic) + " " + chord.type : model.notes.length + " selected notes";
    const voices = Model.voices(model);
    renderNotation($("staff"), model);
    window.BayanKeyboard.mount($("keyboard"), {
      low: range.low ?? Math.max(0, voices[0].midi - 3),
      high: range.high ?? Math.min(127, Math.max(voices[0].midi + 11, ...voices.map((v) => v.midi + 1))),
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
    document.querySelectorAll("#staff [data-midi], #keyboard [data-midi]").forEach((el) => {
      el.classList.toggle("is-sounding", midis.includes(Number(el.dataset.midi)));
    });
  }

  function bind(onActivate) {
    window.BayanKeyboard.bind($("keyboard"), { onActivate });
    function playStaff(event) {
      const note = event.target.closest("[data-midi]");
      if (note) onActivate(Number(note.dataset.midi));
    }
    $("staff").addEventListener("click", playStaff);
    $("staff").addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-midi]")) {
        event.preventDefault();
        playStaff(event);
      }
    });
  }

  return { render, renderNotation, markSounding, bind };
})();
