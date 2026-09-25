// Run with agent-browser eval --stdin on the generated Cogwork Dancers page.
// Uses the real score, DOM controls, and production model.
(async () => {
  for (let attempt = 0; attempt < 100 && !window.SheetPractice; attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  if (!window.SheetPractice) throw new Error("Practice failed to initialize");
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const $ = (name) => document.querySelector("[data-practice-" + name + "]");
  const state = () => window.SheetPractice.player.snapshot();
  const change = (name, value) => {
    const element = $(name);
    if (element.type === "checkbox") element.checked = value;
    else element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const score = SheetPractice.score;
  assert(state().state === "paused", "Page never autoplays");
  change("loop", false);
  $("restart").click();
  assert(score.starts.length === 79 && Math.abs(score.duration - 137.9) < 0.00001, "MusicXML gives all 79 measures and correct total time");
  assert(score.starts[19] === 38 && score.starts[68] === 111.5, "Written tempo changes match the recording");
  assert(score.events.length === 1229, "Tied notes are merged in the actual score");
  assert(document.querySelector("h1").textContent === "Cogwork Dancers", "Correct page title");
  assert(!document.querySelector("#osmd-container").textContent.includes("未命名"), "Imported placeholder title is not displayed");
  assert(!document.querySelector("[data-sheet-playback]"), "Legacy player is not mounted");
  assert(document.documentElement.scrollWidth <= innerWidth, "Page has no horizontal overflow");
  assert(document.querySelector(".vf-notehead").getBoundingClientRect().height >= 8, "Default notes are readable");
  document.querySelector(".practice-settings").open = true;
  change("rate", "0.5");
  assert(state().rate === 0.5, "Speed control applies without playback");
  change("end", "22");
  change("start", "20");
  change("loop", true);
  assert(state().loop.start === 20 && state().loop.end === 22 && state().measure === 20, "Range loop seeks to its start");
  change("start", "23");
  assert(state().loop.start === 20, "Invalid reversed range is rejected");
  assert($("status").textContent.includes("start first"), "Invalid loop has a visible explanation");
  change("start", "20");
  $("measure").value = "69";
  $("jump").requestSubmit();
  assert(state().measure === 69 && !state().loop.enabled, "Jumping outside the passage turns the loop off");
  change("mode", "live");
  assert(state().measure === 69 && state().state === "paused", "Sound switch preserves measure and stays paused");
  assert(!$("instrument-label").hidden, "Live instruments are available in live mode");
  change("mode", "recording");
  assert($("instrument-label").hidden, "Recording does not show an unusable instrument selector");
  $("restart").click();
  assert(state().measure === 1, "Restart returns to score start when loop is off");
  document.querySelector(".practice-settings").open = false;
  const display = document.querySelector(".practice-view-controls details");
  display.open = true;
  const zoom = __sheetMusic.osmd.Zoom;
  document.getElementById("osmd-zoom-in").click();
  assert(__sheetMusic.osmd.Zoom > zoom, "Notes can be enlarged");
  document.getElementById("osmd-zoom-reset").click();
  assert(__sheetMusic.osmd.Zoom === zoom, "Reset restores reading size");
  document.getElementById("osmd-stradella-toggle").click();
  assert(document.getElementById("osmd-stradella-toggle").getAttribute("aria-pressed") === "true", "Stradella state is accessible");
  document.getElementById("osmd-stradella-toggle").click();
  display.open = false;
  document.getElementById("osmd-focus-toggle").click();
  await frame();
  assert(document.documentElement.classList.contains("sheet-music-focus-open"), "Focus mode opens");
  assert(document.documentElement.scrollWidth <= innerWidth, "Focus mode contains horizontal scrolling");
  const element = document.querySelector('.vf-stavenote[tabindex="0"]');
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const dialog = document.getElementById("sheet-inspector");
  assert(dialog.open, "One keyboard activation opens full inspection");
  assert(document.getElementById("sheet-note-pitches").textContent.includes("G5"), "Inspector reports the exact first written octave");
  assert(document.querySelector('#sheet-right-keyboard [data-midi="79"].is-selected'), "B-system highlights the same written MIDI pitch");
  assert(document.querySelectorAll("#sheet-left-keyboard .hand-key").length === 36, "Shared Stradella geometry renders six columns");
  assert(dialog.scrollWidth <= dialog.clientWidth, "Inspector has no page-level horizontal overflow");
  assert(state().state === "paused", "Opening inspection does not play any sound");
  assert(dialog.contains(document.activeElement), "Native dialog receives keyboard focus");
  dialog.querySelector("[data-inspect-close]").click();
  await frame();
  assert(!dialog.open && document.activeElement.classList.contains("vf-stavenote"), "Closing inspection restores score focus");
  const restored = document.activeElement;
  restored.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert(document.activeElement !== restored && document.activeElement.classList.contains("vf-stavenote"), "Arrow keys navigate score notes");
  document.getElementById("osmd-focus-toggle").click();
  const chord = [...document.querySelectorAll(".vf-stavenote")].find((node) => node.querySelectorAll(".vf-notehead").length >= 3);
  const rect = chord.getBoundingClientRect();
  chord.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
  assert(dialog.open, "One tap opens a chord inspector");
  assert(document.querySelectorAll("#sheet-right-keyboard .is-selected").length >= 3, "Written chord tones stay distinct from suggested bass");
  dialog.querySelector("[data-inspect-loop]").click();
  assert(!dialog.open && state().loop.enabled && state().loop.start === state().loop.end, "Loop this measure sets a single-measure passage");
  assert(document.querySelector(".practice-settings").open, "New loop is visible in the controls");
  change("rate", "0.75");
  const stored = JSON.parse(localStorage.getItem("sheet-practice:" + location.pathname));
  assert(stored.rate === 0.75 && stored.loop.enabled, "Practice settings are saved per piece");
  assert(!document.querySelector("#osmd-container img:not([alt])"), "Playback cursor is decorative for screen readers");
  change("loop", false);
  $("restart").click();
  document.querySelector(".practice-settings").open = false;
  scrollTo(0, 0);
  await frame();
  return {
    checks: checks.length,
    result: "passed",
    width: innerWidth,
    theme: document.documentElement.dataset.theme,
    firstNoteTop: document.querySelector(".vf-notehead").getBoundingClientRect().top,
  };
})();
