(function () {
  const $ = (id) => document.getElementById(id);
  const tiles = () => Array.from(document.querySelectorAll(".tile"));
  const key = (name, options = {}) =>
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options }));
  const type = (value) => {
    $("chord-input").value = value;
    $("chord-input").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const submit = () => $("editor").requestSubmit();
  let checks = 0;
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks++;
  };
  assert(document.documentElement.dataset.revision === "half-cells-2", "The fresh half-cell prototype is loaded");
  assert(
    Array.from(document.querySelectorAll('script[src^="board.js"], script[src^="canvas.js"], link[href^="style.css"]')).every(
      (el) => new URL(el.src || el.href).searchParams.get("v") === document.documentElement.dataset.revision
    ),
    "Drag logic and styles use the same cache-busting revision"
  );
  assert(tiles().length === 0 && $("tools").hidden, "The canvas starts blank with no toolbar or example chords");
  const rect = $("editor").getBoundingClientRect();
  assert(Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 1, "Initial cell is horizontally centered");
  assert(Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 1, "Initial cell is vertically centered");
  assert(getComputedStyle($("editor")).animationDuration === "3.6s", "Initial cell slowly pulses");
  submit();
  assert(!$("editor").hidden && tiles().length === 0, "Empty Enter keeps the seed available");
  type("nonsense");
  submit();
  assert(tiles().length === 0 && $("chord-input").getAttribute("aria-invalid") === "true", "Invalid text stays editable, never creates a tile");
  key("Escape");
  assert(!$("editor").hidden && !$("chord-input").value && $("error").hidden, "Escape returns to the empty seed");
  type("Am7");
  submit();
  const first = tiles()[0];
  assert(first.textContent === "Am7" && $("editor").hidden, "Enter replaces the editor with a chord tile");
  assert(!!first.style.getPropertyValue("--fill"), "The committed tile has chord-based color");
  assert(document.activeElement === first && !$("tools").hidden, "Commit selects the tile and reveals minimal controls");
  key("ArrowRight");
  assert(!$("editor").hidden && $("editor").style.left === "160px", "Arrow key opens a neighboring empty cell");
  type("D7");
  submit();
  const second = tiles()[1];
  assert(
    tiles().length === 2 && first.style.getPropertyValue("--fill") !== second.style.getPropertyValue("--fill"),
    "Different roots get different colors"
  );
  key("Enter");
  assert($("chord-input").value === "D7", "Enter edits the selected tile");
  type("F#7/C#");
  submit();
  assert(second.textContent === "F#7/C#" && tiles().length === 2, "Editing replaces rather than duplicates");
  key("ArrowDown", { shiftKey: true });
  assert(second.style.top === "120px" && second.style.left === "160px", "Shift-arrow moves a whole tile");
  key("z", { ctrlKey: true });
  assert(second.style.top === "0px", "Keyboard undo restores a moved tile");
  key("z", { ctrlKey: true, shiftKey: true });
  assert(second.style.top === "120px", "Keyboard redo restores the move");
  second.focus();
  key("Enter");
  type("Em7");
  key("Escape");
  assert(second.textContent === "F#7/C#" && !second.hidden, "Cancelling an edit leaves the original visible");
  key("Delete");
  assert(tiles().length === 1, "Delete removes a selected chord");
  $("undo").click();
  assert(tiles().length === 2 && tiles()[1].textContent === "F#7/C#", "Undo restores deleted content");
  tiles()[1].focus();
  key("ArrowLeft");
  type('"><img src=x onerror=alert(1)>');
  submit();
  assert(!document.querySelector("img") && tiles().length === 2, "Untrusted input cannot create HTML or a tile");
  key("Escape");
  $("help-toggle").click();
  assert(!$("help").hidden && $("help-toggle").getAttribute("aria-expanded") === "true", "Help is available without filling the canvas");
  key("Escape");
  assert($("help").hidden, "Escape closes help");
  const restored = tiles()[1];
  restored.focus();
  key("ArrowUp", { shiftKey: true });
  key("ArrowLeft", { shiftKey: true });
  assert(tiles().length === 2 && tiles().every((t) => t.classList.contains("half")), "Moving onto a chord squeezes both into halves");
  assert(first.style.left === "-38px" && restored.style.left === "38px" && restored.style.top === "0px", "Halves occupy one grid space in order");
  assert(
    tiles().every((t) => t.dataset.beats === "2" && t.getAttribute("aria-label").includes("2 beats")),
    "Both halves represent two beats"
  );
  key("z", { ctrlKey: true });
  assert(
    tiles().every((t) => t.dataset.beats === "4"),
    "Undo restores separate four-beat cells"
  );
  key("z", { ctrlKey: true, shiftKey: true });
  assert(
    tiles().every((t) => t.dataset.beats === "2"),
    "Redo restores the subdivision"
  );
  restored.focus();
  key("Enter");
  assert($("chord-input").value === "F#7/C#" && !first.hidden, "Editing a half targets only that chord");
  type("F#maj7/C#");
  submit();
  assert(
    restored.textContent === "F#maj7/C#" && restored.dataset.beats === "2" && first.textContent === "Am7",
    "Half edits retain their duration and neighbor"
  );
  key("ArrowLeft");
  assert(document.activeElement === first, "Left arrow navigates to the other half");
  key("ArrowRight");
  assert(document.activeElement === restored, "Right arrow returns to the second half");
  key("ArrowDown", { shiftKey: true });
  assert(tiles().every((t) => t.dataset.beats === "4") && restored.style.top === "120px", "Pulling a half out expands both chords");
  key("z", { ctrlKey: true });
  restored.focus();
  key("Delete");
  assert(tiles().length === 1 && first.dataset.beats === "4", "Deleting a half expands its remaining partner");
  $("undo").click();
  assert(tiles().length === 2 && tiles().every((t) => t.dataset.beats === "2"), "Undo restores the deleted half and the subdivision");
  assert(document.documentElement.scrollWidth === innerWidth, "The canvas does not overflow horizontally");
  assert(document.documentElement.scrollHeight <= innerHeight, "The canvas does not add document scrolling");
  return { result: "passed", checks, width: innerWidth };
})();
