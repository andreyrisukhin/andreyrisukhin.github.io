// Run in an isolated /music/ page. Set window.workbenchCheckStage = "reload"
// after reloading to verify the edits, saved copy and independent chord document.
(async () => {
  const $ = (id) => document.getElementById(id);
  const checks = [];
  const assert = (ok, label) => {
    if (!ok) throw new Error(label);
    checks.push(label);
  };
  const names = () => [...document.querySelectorAll("#sequence .name")].map((el) => el.textContent).join(",");
  const click = (selector) => {
    const element = document.querySelector(selector);
    if (!element || element.disabled) throw new Error("Unavailable control: " + selector);
    element.click();
  };
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const draft = () => JSON.parse(localStorage.getItem("musicWorkbenchDraft"));
  const midis = () => [...document.querySelectorAll("#staff [data-midi]")].map((el) => +el.dataset.midi).join(",");
  if (window.workbenchCheckStage === "reload") {
    assert(names() === "Am7,D7,CM/E,Gmaj7", "Reload restores edited progression");
    assert($("key-tonic").value === "A" && $("key-mode").value === "minor", "Reload restores analysis key and mode");
    assert($("composer-bpm").value === "123" && $("composer-loop").checked, "Reload restores tempo and loop");
    assert($("chord-name").textContent === "CM/E" && midis() === "64,72,67", "Restored hand inspector uses picked note order and octave");
    assert(!WorkbenchPlayer.isPlaying(), "Recovery never starts playback");
    assert(draft().documents.progression.items[1].handChoice.bass === 6, "Recovery preserves independent left-hand inversion");
    click('[data-view="chord"]');
    assert($("wb-chord-title").textContent === "Bmaj7", "Recovery preserves the separate chord view");
    click('[data-view="progression"]');
    assert(names() === "Am7,D7,CM/E,Gmaj7", "View switch preserves recovered progression");
    click("#remove");
    assert(names() === "Am7,D7,Gmaj7", "Recovered progression remains editable");
    $("wb-saved-drawer").open = true;
    click("[data-load]");
    assert(names() === "Am7,D7,CM/E,Gmaj7" && midis() === "64,72,67", "Named saved practice restores exact ordered notes");
    assert(
      $("key-mode").value === "minor" && $("composer-loop").checked && $("composer-bpm").value === "123",
      "Named practice restores playback and key settings"
    );
    return { stage: "reload", checks: checks.length, result: "passed" };
  }
  assert(names() === "Am7,D7,Gmaj7", "Integrated default progression");
  assert(document.querySelectorAll("h1").length === 1, "Site keeps one page title");
  assert(document.querySelectorAll("#left-keyboard button").length === 36, "Approved Stradella excerpt is integrated");
  assert($("chord-name").textContent === "D7", "Sequence and hand inspector select the same chord");
  change("bass-choice", "6");
  assert(draft().documents.progression.items[1].handChoice.bass === 6, "Left-hand inversion is persisted on the correct step");
  change("key-tonic", "A");
  change("key-mode", "minor");
  assert(names() === "Am7,D7,Gmaj7", "Analysis does not transpose the document");
  click("#tab-notes");
  for (const pc of [4, 0, 7]) click('#note-picker [data-pc="' + pc + '"]');
  const interpretation = [...document.querySelectorAll("[data-match]")].find((el) => el.textContent.includes("/E"));
  interpretation.click();
  click('[data-gap="2"]');
  click("#commit");
  assert(names() === "Am7,D7,CM/E,Gmaj7", "Picked chord enters the actual progression");
  assert($("chord-name").textContent === "CM/E" && midis() === "64,72,67", "Insertion updates the shared staff and hand inspector");
  assert(draft().documents.progression.items[2].voicing === "bass-octave", "Draft preserves the picked voicing marker");
  click('[data-view="chord"]');
  $("workbench-input").value = "Bmaj7";
  $("workbench-input").dispatchEvent(new Event("input", { bubbles: true }));
  assert($("wb-chord-title").textContent === "Bmaj7", "Existing chord entry still works");
  click('[data-view="progression"]');
  assert(names() === "Am7,D7,CM/E,Gmaj7", "Chord edits do not replace progression");
  click("#undo");
  assert(names() === "Am7,D7,Gmaj7", "Progression undo history survives independent chord edits");
  click("#redo");
  assert(names() === "Am7,D7,CM/E,Gmaj7", "Redo restores picked chord after view switch");
  change("composer-bpm", "123");
  $("composer-loop").checked = true;
  $("composer-loop").dispatchEvent(new Event("change", { bubbles: true }));
  $("workbench-save-options").open = true;
  $("workbench-save-name").value = "Integration QA";
  click("#workbench-save");
  const saved = JSON.parse(localStorage.getItem("musicWorkbenchSetlist"));
  assert(saved.length === 1 && saved[0].chords[2].notes.join() === "4,0,7", "Named practice uses the existing library and exact notes");
  assert(saved[0].keyMode === "minor" && saved[0].chords[1].handChoice.bass === 6, "Saved copy retains analysis mode and hand choice");
  click("#workbench-share");
  const url = new URL($("workbench-share-url").value);
  const shared = JSON.parse(url.searchParams.get("chords"));
  assert(shared[2].voicing === "bass-octave" && shared[2].notes.join() === "4,0,7", "Share link includes ordered pitches");
  assert(url.searchParams.get("keyMode") === "minor" && url.searchParams.get("bpm") === "123", "Share link includes analysis and tempo");
  assert(!url.href.includes("Integration"), "Share link excludes saved practice labels");
  sessionStorage.setItem("workbenchQaShare", url.href);
  assert(!WorkbenchPlayer.isPlaying(), "Browsing, editing and saving do not autoplay");
  assert(document.documentElement.scrollWidth <= innerWidth, "Integrated page has no horizontal overflow");
  return { stage: "edit", checks: checks.length, result: "passed" };
})();
