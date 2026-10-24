// Run with agent-browser eval --stdin on any of the four built sheet pages.
(async () => {
  const page = document.querySelector(".sheet-reader");
  const playable = page.dataset.playback === "true";
  for (let i = 0; i < 100 && (!window.__sheetMusic?.osmd || (playable && !window.SheetReader)); i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const player = window.SheetReader?.player;
  const state = () => player.snapshot();
  assert(document.querySelectorAll(".sheet-music-controls").length === 1, "One score display toolbar");
  assert(document.querySelector(".sheet-downloads"), "Common files and credits disclosure");
  assert(document.querySelector("#sheet-inspector"), "Common note inspector");
  assert(document.documentElement.scrollWidth <= innerWidth, "Page stays within the viewport");
  assert(document.querySelector(".vf-notehead").getBoundingClientRect().height >= 8, "Notes stay readable");
  if (playable) {
    assert(state().state === "paused", "No autoplay");
    assert(document.querySelectorAll("[data-sheet-playback]").length === 1, "One shared playback transport");
    assert(document.querySelector(".practice-settings"), "Shared practice settings");
    player.setLoop(1, state().count, false);
    player.restart();
    const track = document.querySelector("[data-pb-seek]");
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    assert(state().measure === state().count, "Keyboard seeks to the final measure");
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    assert(state().measure === 1, "Keyboard seeks to the opening measure");
    player.restart();
    player.setTranspose(0);
    const firstPitch = () => {
      const head = document.querySelector(".vf-notehead");
      const rect = head.getBoundingClientRect();
      return __sheetMusic.resolveNoteAt(rect.left + rect.width / 2 + scrollX, rect.top + rect.height / 2 + scrollY, 80, head).clickedPitch;
    };
    const pitch = firstPitch();
    document.querySelector('[data-pb-transpose="1"]').click();
    assert(state().transpose === 1 && __sheetMusic.osmd.Sheet.Transpose === 1, "Key controls transpose the shared player and notation");
    assert(Tonal.Note.midi(firstPitch()) === Tonal.Note.midi(pitch) + 1, "Rendered pitches match the transposed sound");
    assert(state().mode === "live", "Transposition selects live sound");
    document.querySelector("[data-pb-key-reset]").click();
    assert(state().transpose === 0 && firstPitch() === pitch, "Reset restores the written pitches");
    const clickSeek = document.querySelector("[data-pb-click-seek]");
    if (clickSeek.getAttribute("aria-pressed") !== "true") clickSeek.click();
    const head = document.querySelector(".vf-notehead");
    const headRect = head.getBoundingClientRect();
    head.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: headRect.left + headRect.width / 2, clientY: headRect.top + headRect.height / 2 })
    );
    assert(state().measure === 1 && !document.querySelector("#sheet-inspector").open, "Click-to-jump does not also open inspection");
    clickSeek.click();
    const rate = document.querySelector("[data-practice-rate]");
    rate.value = "0.5";
    rate.dispatchEvent(new Event("change"));
    assert(state().rate === 0.5, "Common speed setting");
    const stored = JSON.parse(localStorage.getItem("sheet-reader:" + location.pathname));
    assert(stored.rate === 0.5 && stored.transpose === 0, "Settings save per piece");
    const transport = document.querySelector("[data-sheet-playback]");
    assert(getComputedStyle(transport).position === (innerWidth <= 768 ? "fixed" : "sticky"), "Transport docks on mobile and sticks on desktop");
    if (innerWidth <= 768) {
      await frame();
      const devToggle = document.querySelector(".sheet-dev-toggle");
      assert(
        !devToggle || devToggle.getBoundingClientRect().bottom < transport.getBoundingClientRect().top,
        "Floating controls stay clear of the mobile transport"
      );
    }
    rate.value = "1";
    rate.dispatchEvent(new Event("change"));
    const mode = document.querySelector("[data-pb-mode]");
    if (mode) {
      mode.value = "recording";
      mode.dispatchEvent(new Event("change"));
    }
  } else {
    assert(!player && !document.querySelector("[data-sheet-playback]"), "Read-only page has no player");
    assert(!document.querySelector(".practice-settings"), "Read-only page has no playback settings");
  }
  const zoom = __sheetMusic.osmd.Zoom;
  document.getElementById("osmd-zoom-in").click();
  assert(__sheetMusic.osmd.Zoom > zoom, "Common zoom control");
  document.getElementById("osmd-zoom-reset").click();
  document.getElementById("osmd-focus-toggle").click();
  await frame();
  assert(document.documentElement.classList.contains("sheet-music-focus-open"), "Common focus mode");
  const note = document.querySelector('.vf-stavenote[tabindex="0"]');
  note.focus();
  note.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const dialog = document.getElementById("sheet-inspector");
  assert(dialog.open, "Keyboard opens the shared inspector");
  assert(dialog.scrollWidth <= dialog.clientWidth, "Inspector stays within its own viewport");
  assert(!playable || state().state === "paused", "Inspection never autoplays");
  assert(document.querySelector("[data-inspect-seek]").disabled === !playable, "Practice actions follow the page capability");
  document.querySelector("[data-inspect-close]").click();
  await frame();
  assert(document.activeElement.classList.contains("vf-stavenote"), "Inspector restores score focus");
  document.getElementById("osmd-focus-toggle").click();
  if (player) {
    player.setLoop(1, Math.min(4, state().count), false);
    player.restart();
  }
  scrollTo(0, 0);
  return { page: location.pathname, width: innerWidth, checks: checks.length, result: "passed" };
})();
