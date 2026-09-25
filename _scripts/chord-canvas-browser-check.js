(function () {
  const $ = (id) => document.getElementById(id);
  const tiles = () => Array.from(document.querySelectorAll(".tile"));
  const chordName = (el) => el.querySelector(".chord-name").textContent;
  const key = (name, options = {}) =>
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options }));
  const type = (value) => {
    $("chord-input").value = value;
    $("chord-input").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const submit = () => $("editor").requestSubmit();
  const select = (tile) => {
    tile.click();
    key("Escape");
  };
  const split = (value) => {
    $("split-toggle").click();
    $("split-value").value = value;
    $("split-form").requestSubmit();
  };
  let checks = 0;
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks++;
  };
  assert(document.documentElement.dataset.revision === "saving-2", "The versioned saving prototype is loaded");
  assert(tiles().length === 0 && $("tools").hidden, "Starts blank without a toolbar");
  const rect = $("editor").getBoundingClientRect();
  assert(Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 1, "Seed is horizontally centered");
  assert(Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 1, "Seed is vertically centered");
  assert(getComputedStyle($("editor")).animationDuration === "3.6s", "Seed gently pulses");
  type("bad chord");
  submit();
  assert($("chord-input").getAttribute("aria-invalid") === "true" && !tiles().length, "Invalid chord keeps the draft");
  key("Escape");
  assert(!$("editor").hidden && !$("chord-input").value, "Escape restores the seed");
  type("Am7");
  submit();
  const first = tiles()[0];
  assert(first.dataset.duration === "1" && chordName(first) === "Am7", "New chord occupies a whole measure");
  split("3");
  assert(tiles().length === 3 && tiles().every((el) => el.dataset.duration === "1/3"), "Split into thirds uses exact fractions");
  assert(tiles().filter((el) => el.classList.contains("empty")).length === 2, "New split spans start empty");
  const second = tiles()[1],
    third = tiles()[2];
  second.focus();
  key("Enter");
  type("D7");
  submit();
  assert(chordName(second) === "D7" && second.dataset.duration === "1/3", "Typing in an empty span preserves its duration");
  select(first);
  split("2:1");
  assert(first.dataset.duration === "2/9", "Weighted split scales the target span only");
  assert(
    second.dataset.duration === "1/3" && second.dataset.start === "1/3" && third.dataset.start === "2/3",
    "Neighbor durations and starts are unchanged"
  );
  const count = tiles().length;
  split("0:1");
  assert(!$("split-error").hidden && tiles().length === count, "Invalid ratios reject atomically");
  key("Escape");
  first.focus();
  key("z", { ctrlKey: true });
  assert(first.dataset.duration === "1/3" && tiles().length === 3, "Undo restores the unsplit target");
  key("z", { ctrlKey: true, shiftKey: true });
  assert(first.dataset.duration === "2/9" && tiles().length === 4, "Redo restores weighted subdivision");
  select(second);
  key("Delete");
  assert(second.classList.contains("empty") && second.dataset.duration === "1/3", "Delete leaves an empty timed span");
  key("z", { ctrlKey: true });
  assert(chordName(second) === "D7", "Undo restores a cleared chord");
  select(first);
  $("zoom-fit").click();
  assert(Number($("zoom-fit").textContent.replace("×", "")) >= 4, "Zoom to span makes small subdivisions editable");
  assert(document.querySelectorAll(".divider:not([hidden])").length >= 1, "Zoom reveals duration dividers");
  const divider = document.querySelector('.divider[data-left="' + first.dataset.id + '"]:not([hidden])');
  const beforeSecondStart = second.dataset.start,
    beforeThirdStart = third.dataset.start;
  divider.focus();
  key("ArrowRight");
  assert(first.dataset.duration !== "2/9", "Keyboard divider adjustment changes the adjacent pair");
  assert(second.dataset.start === beforeSecondStart && third.dataset.start === beforeThirdStart, "Divider resizing does not shift later spans");
  key("z", { ctrlKey: true });
  assert(first.dataset.duration === "2/9", "Divider resize is one undo step");
  $("settings-toggle").click();
  $("meter-top").value = "6";
  $("meter-bottom").value = "8";
  $("meter-form").requestSubmit();
  assert(first.dataset.duration === "2/9" && second.dataset.label === "2 eighth-notes", "Meter changes duration labels but not fractions");
  key("Escape");
  select(first);
  key("Enter");
  type('"><img src=x onerror=alert(1)>');
  submit();
  assert(!document.querySelector("img") && $("chord-input").getAttribute("aria-invalid") === "true", "Draft cannot create markup");
  key("Escape");
  assert(chordName(first) === "Am7", "Cancelling preserves the chord identity");
  $("help-toggle").click();
  assert(!$("help").hidden, "Help remains available");
  key("Escape");
  assert(document.documentElement.scrollWidth === innerWidth, "No horizontal document overflow");
  assert(document.documentElement.scrollHeight <= innerHeight, "No vertical document overflow");
  return { result: "passed", checks, width: innerWidth };
})();
