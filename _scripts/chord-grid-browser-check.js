// Run in the production Explore page with an isolated, fresh browser profile.
(async () => {
  for (let i = 0; i < 100 && !document.querySelector(".sequence-card"); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const $ = (id) => document.getElementById(id);
  const tile = (cell) => document.querySelector('[data-grid-cell="' + cell + '"]');
  const chord = (cell) => tile(cell)?.querySelector(".name")?.textContent;
  const names = () => [...document.querySelectorAll(".sequence-card .name")].map((element) => element.textContent).join(",");
  const click = (selector) => document.querySelector(selector).click();
  const key = (element, value, extras = {}) =>
    element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...extras }));
  const type = (value) => {
    $("grid-chord-input").value = value;
    $("grid-chord-input").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const submit = () => document.querySelector(".grid-draft").requestSubmit();
  const cancelled = () => {
    if ($("grid-chord-input")) click("[data-grid-cancel]");
  };
  const inputCell = () => Number($("grid-chord-input")?.closest("[data-grid-cell]").dataset.gridCell);
  assert(names() === "Am7,D7,Gmaj7", "Existing progression appears as tiles");
  assert(document.querySelectorAll(".grid-beats").length === 3, "Every tile displays four beats");
  assert(getComputedStyle($("sequence")).gridTemplateColumns.split(" ").length === 4, "Grid has four stable columns");
  assert(document.documentElement.scrollWidth <= innerWidth, "Grid does not overflow the page");
  click('[data-grid-open="7"]');
  assert(document.activeElement === $("grid-chord-input"), "Clicking empty space focuses inline typing");
  type("Fm7");
  submit();
  assert(chord(7) === "Fm7" && !chord(3), "Tile snaps to the chosen space without collapsing gaps");
  assert(inputCell() === 8, "Enter continues in the next empty cell");
  key($("grid-chord-input"), "z", { ctrlKey: true });
  assert(!chord(7) && !$("grid-chord-input"), "Keyboard undo reverses the last tile from an empty continuation");
  $("redo").click();
  click('[data-grid-open="8"]');
  type("Bb7");
  key($("grid-chord-input"), "Tab");
  assert(chord(8) === "B♭7" && inputCell() === 9, "Tab creates a tile and keeps typing");
  type("nonsense");
  submit();
  assert(!$("grid-error").hidden && $("grid-chord-input").getAttribute("aria-invalid") === "true", "Invalid chords show an inline error");
  assert(!chord(9) && names() === "Am7,D7,Gmaj7,Fm7,B♭7", "Invalid input cannot change the progression");
  $("key-tonic").value = "C";
  $("key-tonic").dispatchEvent(new Event("change", { bubbles: true }));
  assert($("grid-chord-input").value === "nonsense", "Rendering theory does not lose the typing draft");
  assert($("grid-chord-input").getAttribute("aria-invalid") === "true", "Validation survives a redraw");
  key($("grid-chord-input"), "Escape");
  assert(!$("grid-chord-input") && !chord(9), "Escape cancels without creating an empty chord");
  click('[data-grid-edit="7"]');
  type("F#7/C#");
  submit();
  assert(chord(7) === "F♯7/C♯", "Inline editing accepts slash bass and accidentals");
  $("undo").click();
  assert(chord(7) === "Fm7", "Undo from the empty continuation editor undoes the tile edit");
  $("redo").click();
  assert(chord(7) === "F♯7/C♯", "Redo restores the edited tile in place");
  const moving = tile(7).querySelector(".sequence-card");
  moving.focus();
  key(moving, "ArrowLeft", { shiftKey: true });
  assert(chord(6) === "F♯7/C♯" && !chord(7), "Shift-arrow moves a tile by exactly one grid cell");
  assert(document.activeElement.closest("[data-grid-cell]").dataset.gridCell === "6", "Moving a tile preserves keyboard focus");
  const data = new DataTransfer();
  tile(6)
    .querySelector(".sequence-card")
    .dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
  tile(1).dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
  assert(tile(1).classList.contains("is-drop-target"), "Dragging previews the snapped destination");
  tile(1).dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
  assert(chord(1) === "F♯7/C♯" && chord(6) === "D7", "Dropping onto an occupied cell swaps whole chords");
  assert(names() === "Am7,F♯7/C♯,Gmaj7,D7,B♭7", "Playback order follows left-to-right, top-to-bottom cell order");
  $("undo").click();
  assert(chord(1) === "D7" && chord(6) === "F♯7/C♯", "Drag moves are undoable");
  click('[data-grid-open="3"]');
  type('"><img src=x onerror=alert(1)>');
  $("key-mode").value = "minor";
  $("key-mode").dispatchEvent(new Event("change", { bubbles: true }));
  assert(!$("sequence").querySelector("img"), "Draft text cannot become HTML on redraw");
  cancelled();
  click('[data-grid-open="3"]');
  type("C/E");
  submit();
  assert(chord(3) === "C/E", "Typing between existing tiles inserts the intended chord");
  type("Abmaj7");
  click('[data-grid-cell="8"] .sequence-card');
  assert(chord(4) === "A♭maj7", "Selecting another tile commits a valid draft");
  assert(
    tile(8).querySelector(".sequence-card").getAttribute("aria-current") === "step",
    "Selection follows the clicked cell after a preceding insertion"
  );
  click('[data-grid-edit="8"]');
  type("oops");
  $("undo").click();
  assert(chord(8) === "B♭7" && !$("grid-chord-input"), "Undo cancels dirty typing without altering the progression");
  click('[data-grid-cell="6"] .sequence-card');
  $("remove").click();
  assert(!chord(6) && chord(8), "Removing a tile keeps later spatial positions");
  $("undo").click();
  assert(chord(6), "Undo restores a removed tile at its old position");
  $("grid-more").click();
  const newCell = inputCell();
  type("E7");
  submit();
  assert(chord(newCell) === "E7", "More space creates an editable row");
  cancelled();
  key(tile(newCell).querySelector(".sequence-card"), "Delete");
  assert(!chord(newCell), "Delete removes a focused tile without moving other cells");
  $("undo").click();
  assert(chord(newCell) === "E7", "Undo restores keyboard deletion");
  const saved = JSON.parse(localStorage.getItem("musicWorkbenchDraft"));
  const positions = saved.documents.progression.items.map((item) => item.gridCell);
  assert(new Set(positions).size === positions.length, "Saved practice has unique grid positions");
  assert(positions.includes(newCell), "Sparse layout is saved with the progression");
  assert(
    positions.every((cell, index) => index === 0 || positions[index - 1] < cell),
    "Saved order matches reading order"
  );
  assert(document.documentElement.scrollWidth <= innerWidth, "Editing and moving never overflow the page");
  window.gridExpected = { names: names(), cells: positions };
  return { result: "passed", checks: checks.length, width: innerWidth, theme: document.documentElement.dataset.theme, expected: window.gridExpected };
})();
