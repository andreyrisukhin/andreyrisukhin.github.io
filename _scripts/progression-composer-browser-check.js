// Run in a freshly loaded composer with agent-browser eval --stdin.
// Exercises actual controls; does not replace the model, player, or browser APIs.
(() => {
  const $ = (id) => document.getElementById(id);
  const checks = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    checks.push(label);
  };
  const click = (id) => $(id).click();
  const names = () => [...document.querySelectorAll(".sequence-card .name")].map((el) => el.textContent).join(",");
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const choose = (selector) => {
    const button = document.querySelector(selector);
    if (!button) throw new Error("Missing control " + selector);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  const overflow = () =>
    assert(
      document.documentElement.scrollWidth <= innerWidth,
      "No page overflow in " + document.querySelector('[role="tab"][aria-selected="true"]').textContent
    );
  const type = (text) => {
    $("chord-text").value = text;
    $("chord-text").dispatchEvent(new Event("input", { bubbles: true }));
    $("type-form").requestSubmit();
  };
  const baseline = names();
  assert(baseline === "Am7,D7,Gmaj7", "Starting sequence");
  assert($("function-heading").textContent === "Dominant", "Selected D7 function");
  choose('#key-chords [data-chord="Em7"]');
  assert(names() === baseline, "In-key browsing is non-destructive");
  assert($("candidate-route").textContent === "D7 → Em7 → Gmaj7", "Insert context has both neighbors");
  choose('[data-gap="1"]');
  click("commit");
  assert(names() === "Am7,Em7,D7,Gmaj7", "Insert at a middle gap");
  click("undo");
  assert(names() === baseline, "Undo insert");
  click("redo");
  assert(names() === "Am7,Em7,D7,Gmaj7", "Redo insert");
  click("undo");
  change("intent", "replace");
  choose('#key-chords [data-chord="Cmaj7"]');
  assert($("candidate-route").textContent === "Am7 → Cmaj7 → Gmaj7", "Replace context omits old chord");
  click("commit");
  assert(names() === "Am7,Cmaj7,Gmaj7", "Replace selected step only");
  click("undo");
  choose('[data-step="0"]');
  assert($("function-heading").textContent === "Predominant", "Preparation explanation");
  choose('[data-prepare="C"]');
  assert($("candidate-heading").textContent === "C", "Prepare functional alternative");
  assert(names() === baseline, "Functional alternative is only a candidate");
  change("key-tonic", "C");
  assert(names() === baseline, "Analysis key does not transpose");
  assert($("function-chord").textContent.includes("vi7 in C major"), "Degree updates in new key");
  change("key-tonic", "A");
  change("key-mode", "minor");
  assert($("function-heading").textContent === "Tonic", "Am7 becomes a tonic in A minor");
  change("minor-collection", "harmonic");
  assert(!!document.querySelector('#key-chords [data-chord="E7"]'), "Harmonic minor offers major dominant");
  change("minor-collection", "melodic");
  assert(!!document.querySelector('#key-chords [data-chord="D7"]'), "Ascending melodic minor palette");
  click("undo");
  click("undo");
  click("undo");
  assert($("key-tonic").value === "G" && $("key-mode").value === "major", "Undo restores the analysis key");
  document.querySelector(".transpose-options").open = true;
  change("transpose-tonic", "A");
  click("transpose");
  assert(names() === "Bm7,E7,Amaj7", "Explicit transpose moves notes");
  click("undo");
  document.querySelector(".transpose-options").open = false;
  overflow();

  click("tab-matrix");
  change("matrix-root", "C");
  choose('#matrix [data-chord="C7b9"]');
  assert($("candidate-heading").textContent === "C7♭9", "Matrix chooses altered harmony");
  change("matrix-scope", "all");
  assert(document.querySelectorAll("#matrix [data-chord]").length >= 100, "Full catalog is not limited to Stradella");
  for (const button of document.querySelectorAll("#matrix [data-chord]")) {
    button.click();
    assert($("candidate-heading").textContent.length > 0 && !$("hear-candidate").disabled, "Catalog candidate " + button.dataset.chord);
  }
  assert(names() === baseline, "Full catalog browsing does not edit");
  overflow();

  click("tab-type");
  type("C F G");
  assert($("candidate-heading").textContent === "C → F → G", "Bare letters are a chord sequence");
  assert($("commit").disabled, "Phrase cannot replace a single step");
  change("intent", "insert");
  assert(!$("commit").disabled, "Phrase can insert at a gap");
  type("Am7 invalid G");
  assert($("chord-text").getAttribute("aria-invalid") === "true" && $("commit").disabled, "Invalid input cannot commit stale candidate");
  assert(names() === baseline, "Invalid input preserves progression");
  type("iiø7 V7 i in A minor");
  assert($("candidate-heading").textContent === "Bm7♭5 → E7 → Am", "Minor Roman phrase");
  assert($("key-tonic").value === "G", "Explicit typed key does not silently reanalyze progression");
  overflow();

  click("tab-notes");
  assert($("picked-staff").hidden && $("hear-picked").disabled, "Empty picker hides notation and disables audition");
  choose('#note-picker [data-pc="4"]');
  choose('#note-picker [data-pc="7"]');
  choose('#note-picker [data-pc="0"]');
  const staffMidis = () => [...$("picked-staff").querySelectorAll("[data-midi]")].map((el) => Number(el.dataset.midi)).join(",");
  const pickedOrder = () => [...$("picked-order").querySelectorAll("select")].map((el) => el.value).join(",");
  assert(staffMidis() === "64,67,72", "Staff shows actual selected pitches");
  assert(pickedOrder() === "4,7,0", "Editor shows selected order");
  assert(document.querySelector('[data-picked-action="earlier"][data-picked-index="0"]').disabled, "Cannot move first note earlier");
  [...document.querySelectorAll("[data-match]")].find((el) => el.textContent.includes("/E")).click();
  assert($("candidate-heading").textContent.includes("/E"), "Note picker preserves first-note bass");
  choose('[data-picked-action="earlier"][data-picked-index="2"]');
  assert(pickedOrder() === "4,0,7" && staffMidis() === "64,72,67", "Moving notes preserves bounded pitches and display order");
  assert(document.activeElement.id === "picked-note-1", "Reordering keeps focus with the moved note");
  assert($("commit").disabled, "Changing note order clears stale candidate");
  [...document.querySelectorAll("[data-match]")].find((el) => el.textContent.includes("/E")).click();
  assert($("candidate-notes").textContent === "E · C · G", "Interpretation preserves full chosen order");
  click("commit");
  assert(names().includes("C/E"), "Picked interpretation inserts");
  click("undo");
  assert(names() === baseline, "Undo picked insertion");
  choose('[data-picked-staff="1"]');
  assert(document.activeElement.id === "picked-note-1", "Click staff note to edit");
  document.querySelector('[data-picked-staff="2"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert(document.activeElement.id === "picked-note-2", "Keyboard staff activation edits corresponding note");
  change("picked-note-1", "2");
  assert(pickedOrder() === "4,2,7" && staffMidis() === "64,74,67", "Replacing a note updates staff and order");
  assert(document.activeElement.id === "picked-note-1", "Replacement retains focus");
  assert($("picked-note-1").querySelector('[value="4"]').disabled, "Replacement cannot duplicate a picked pitch");
  change("picked-note-1", "0");
  change("note-bass", "0");
  assert(pickedOrder() === "0,4,7" && staffMidis() === "60,64,67", "Bass selection changes first note and voiced octave");
  choose('[data-match="0"]');
  assert(!$("candidate-heading").textContent.includes("/E"), "Bass selector updates interpretation");
  choose('[data-picked-action="remove"][data-picked-index="1"]');
  assert(pickedOrder() === "0,7" && $("commit").disabled, "Removing a note refreshes notation and clears interpretation");
  click("clear-notes");
  assert($("picked-staff").hidden && !$("picked-order").children.length, "Clearing empties staff and editor");
  assert(document.activeElement.dataset.pc === "0", "Clear moves focus to first available pitch");
  for (let pc = 11; pc >= 0; pc--) choose('#note-picker [data-pc="' + pc + '"]');
  assert($("picked-order").children.length === 12, "Every pitch class is editable");
  assert(staffMidis() === "71,82,81,80,79,78,77,76,75,74,73,72", "Descending input never spirals into higher octaves");
  overflow();
  click("clear-notes");
  choose('#note-picker [data-pc="1"]');
  choose('[data-match="0"]');
  assert(!$("hear-candidate").disabled, "Unidentified note set remains audible");
  choose('[data-picked-action="remove"][data-picked-index="0"]');
  assert($("hear-picked").disabled && $("note-bass").disabled && $("commit").disabled, "Removing last note restores empty state");
  for (const name of ["C", "C/E", "D7", "C#maj7"]) {
    const chord = WorkbenchModel.fromName(name);
    assert(
      WorkbenchDiagrams.staff(chord) === WorkbenchDiagrams.staff(chord, WorkbenchModel.voices(chord)),
      "Default shared staff unchanged: " + name
    );
  }
  overflow();

  click("tab-transitions");
  choose('[data-step="1"]');
  assert(document.querySelectorAll("[data-circle]").length === 12, "Circle has twelve roots");
  const circle = document.querySelector('[data-circle="B"]');
  circle.focus();
  circle.click();
  assert(document.activeElement === circle, "Circle selection retains focus");
  assert($("candidate-heading").textContent === "B7", "Circle prepares the chosen root and quality");
  assert(names() === baseline && $("key-tonic").value === "G", "Circle does not transpose or edit");
  const relatedNames = () => [...$("related-chords").querySelectorAll("[data-chord]")].map((el) => el.dataset.chord).join(",");
  assert(relatedNames() === "E,Em,Emaj7,Em7", "B wheel selection immediately offers E targets");
  assert($("transition-anchor").textContent.includes("B7, chosen on the wheel"), "Comparison source names wheel selection");
  for (const kind of ["common", "bass", "color", "resolve"]) {
    change("relation", kind);
    assert(document.querySelectorAll("#related-chords button").length > 0, "Related choices: " + kind);
    const before = relatedNames();
    choose("#related-chords button");
    assert(
      relatedNames() === before && document.querySelector('[data-circle="B"]').getAttribute("aria-pressed") === "true",
      "Comparison candidates do not move the wheel anchor: " + kind
    );
  }
  choose('[data-circle="C"]');
  assert(relatedNames() === "F,Fm,Fmaj7,Fm7", "C wheel selection updates fourth-up targets");
  choose('[data-circle="G"]');
  assert(relatedNames() === "C,Cm,Cmaj7,Cm7", "G wheel selection updates fourth-up targets");
  change("relation", "bass");
  change("circle-quality", "m");
  assert(
    $("candidate-heading").textContent === "Gm" && relatedNames() === "Gm/F,Gm/F#,Gm/Ab,Gm/A",
    "Quality change refreshes comparisons and candidate on same root"
  );
  change("relation", "color");
  for (const root of ComposerHarmony.fifths) {
    choose('[data-circle="' + root + '"]');
    assert(
      [...$("related-chords").querySelectorAll("[data-chord]")].every(
        (el) => WorkbenchModel.fromName(el.dataset.chord).root === Tonal.Note.chroma(root)
      ),
      "Color comparisons follow wheel root " + root
    );
  }
  choose('[data-circle="C"]');
  choose('[data-gap="0"]');
  assert($("transition-anchor").textContent.includes("Cm, chosen on the wheel"), "Changing insertion gap preserves wheel comparisons");
  click("tab-notes");
  click("tab-transitions");
  assert($("transition-anchor").textContent.includes("Cm, chosen on the wheel"), "Changing sources preserves wheel selection");
  choose('[data-step="1"]');
  change("relation", "resolve");
  assert(
    relatedNames() === "G,Gm,Gmaj7,Gm7" && $("transition-anchor").textContent.includes("D7, the selected progression chord"),
    "Explicit progression selection resets comparisons to that chord"
  );
  assert(names() === baseline, "All wheel and relation choices leave progression unchanged");
  overflow();

  click("tab-patterns");
  assert(document.querySelectorAll("[data-pattern]").length === 6, "Six pattern choices");
  choose('[data-pattern="cadence"]');
  choose('[data-gap="0"]');
  click("commit");
  assert(names() === "Am7,D7,Gmaj7,Am7,D7,Gmaj7", "Pattern inserts without replacing current material");
  click("undo");
  overflow();
  $("tab-patterns").focus();
  $("tab-patterns").dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  assert(document.activeElement.id === "tab-key" && $("tab-key").getAttribute("aria-selected") === "true", "Tab keyboard navigation");

  while (document.querySelector("[data-step]")) click("remove");
  assert($("hear-progression").disabled && $("remove").disabled, "Empty state controls");
  assert($("function-heading").textContent.includes("first chord"), "Empty state teaching prompt");
  click("tab-transitions");
  choose('[data-circle="A"]');
  assert(relatedNames() === "D,Dm,Dmaj7,Dm7", "Wheel comparisons work with an empty progression");
  click("tab-key");
  choose('#key-chords [data-chord="Gmaj7"]');
  click("commit");
  assert(names() === "Gmaj7", "Empty state can start again");
  click("undo");
  click("undo");
  click("undo");
  click("undo");
  assert(names() === baseline, "Undo restores the complete removed progression");
  choose('[data-step="1"]');
  choose('#key-chords [data-chord="Em7"]');
  assert($("stop").disabled && $("candidate-stop").disabled, "No autoplay while browsing");
  assert(!WorkbenchPlayer.isPlaying(), "Audio stays silent without a Hear action");
  overflow();
  scrollTo(0, 0);
  return { width: innerWidth, theme: document.documentElement.dataset.theme || "light", checks: checks.length, result: "passed" };
})();
