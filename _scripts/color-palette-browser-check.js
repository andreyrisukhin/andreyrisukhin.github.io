// On /color/palette/: agent-browser eval --stdin < _scripts/color-palette-browser-check.js
(async () => {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const el = (id) => document.getElementById("palette-" + id);
  const change = (id, value) => {
    el(id).value = value;
    el(id).dispatchEvent(new Event("change"));
  };
  const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  check(!!el("apply"), "Palette page loaded");
  SitePalette.reset();
  change("hex", "#217aab");
  for (const scheme of Object.keys(SitePaletteModel.schemes)) {
    change("harmony", scheme);
    check(el("ideas").children.length === 4, "Four palette suggestions");
    el("ideas").children[2].click();
    check(el("ideas").children[2].getAttribute("aria-pressed") === "true", "Selected suggestion is announced");
    check(document.activeElement === el("ideas").children[2], "Selection preserves keyboard focus");
    el("apply").click();
    check(SitePalette.get().scheme === scheme && SitePalette.get().turn === 2, "Selected palette applied");
    for (const mode of ["light", "dark"]) {
      document.documentElement.dataset.theme = mode;
      await settle();
      const expected = SitePalette.get()[mode];
      check(
        getComputedStyle(document.body).getPropertyValue("--global-bg-color").trim() === expected.canvas,
        "Creative paper follows palette in " + mode
      );
      check(
        getComputedStyle(document.body).getPropertyValue("--global-theme-color").trim() === expected.accent,
        "Creative accent follows palette in " + mode
      );
      check(el("strip").children.length === 5, "Five labeled color roles");
      check(SitePaletteModel.contrast(expected.text, expected.canvas) >= 4.5, "Readable text");
    }
  }
  const previous = SitePalette.get().seed;
  el("hex").value = "invalid";
  el("hex").dispatchEvent(new Event("input"));
  check(!el("hex").checkValidity(), "Invalid hex rejected");
  check(SitePalette.get().seed === previous, "Invalid hex does not change applied palette");
  change("hex", "#abc");
  check(el("hex").value === "#aabbcc", "Short hex normalized");
  el("reset").click();
  check(!SitePalette.get() && !document.documentElement.hasAttribute("data-site-palette"), "Reset restores identity palette");
  check(localStorage.getItem("site-palette-v1") === null, "Reset clears persistence");
  check(el("reset").disabled, "Reset unavailable when no palette applied");
  check(document.documentElement.scrollWidth <= innerWidth, "No horizontal scrolling");
  // Leave a known choice for cross-page and reload checks.
  change("hex", "#217aab");
  change("harmony", "triadic");
  el("ideas").children[2].click();
  el("apply").click();
  return "PASS: all harmonies, selection, focus, application, both themes, invalid/short hex, reset, storage, and responsive width.";
})();
