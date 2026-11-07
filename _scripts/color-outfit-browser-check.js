// Run with agent-browser eval --stdin on a freshly loaded /color/outfit/ page, at desktop and mobile widths.
(async () => {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  for (let i = 0; i < 100 && !document.querySelector(".outfit-piece"); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  const pieces = [...document.querySelectorAll(".outfit-piece")];
  assert(pieces.length > 0, "Pieces render");
  assert(document.querySelectorAll(".outfit-bar__seg").length === pieces.length, "The look bar has one segment per piece");
  assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal page overflow");

  for (const input of document.querySelectorAll(".outfit-piece__share input")) {
    const original = input.value;
    input.value = "99";
    assert(input.scrollWidth <= input.clientWidth, "A two-digit share is not clipped");
    input.value = original;
  }

  const why = document.querySelector(".outfit-why");
  assert(why && !why.open, "Analysis notes start collapsed");
  assert(document.querySelectorAll("#outfit-notes .outfit-note").length > 0, "Analysis notes are still available");
  const flag = document.getElementById("outfit-why-flag").textContent;
  const warnings = document.querySelectorAll("#outfit-notes .outfit-note--warn").length;
  assert(warnings ? flag.includes(String(warnings)) : flag === "", "The summary flags notes that need checking");
  assert(!document.querySelector(".tool-footnote").open, "How-to copy starts collapsed");

  const ideas = document.querySelectorAll(".outfit-idea");
  assert(ideas.length > 0, "Ideas render");
  const before = location.hash;
  ideas[1].click();
  assert(document.getElementById("outfit-status").textContent.startsWith("Applied"), "Clicking an idea applies it");
  assert(location.hash !== before, "Applying an idea changes the look");
  history.replaceState(null, "", before);

  const square = [...document.querySelectorAll(".outfit-panel select, .outfit-section button:not(.outfit-swatch):not(.outfit-owned__pick)")].every(
    (el) => getComputedStyle(el).borderTopLeftRadius === "0px"
  );
  assert(square, "Tool controls are square");
  return checks;
})();
