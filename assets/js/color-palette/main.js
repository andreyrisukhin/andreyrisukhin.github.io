(function () {
  const tool = document.querySelector("[data-palette-tool]");
  if (!tool) return;
  const M = window.SitePaletteModel;
  const S = window.SitePalette;
  const el = (id) => document.getElementById("palette-" + id);
  const saved = S.get();
  const signature = (palette) => palette && `${palette.seed}/${palette.scheme}/${palette.turn}`;
  let appliedSignature = signature(saved);
  let seed = saved ? saved.seed : "#80533f";
  let scheme = saved ? saved.scheme : "analogous";
  let turn = saved ? saved.turn : 0;
  const names = ["Original hue", "Hue +15°", "Hue +30°", "Hue +45°"];
  const dark = () => document.documentElement.dataset.theme === "dark";
  function render() {
    const palette = M.make(seed, scheme, turn);
    const tokens = palette[dark() ? "dark" : "light"];
    el("seed").value = seed;
    el("hex").value = seed;
    el("hex").setCustomValidity("");
    el("harmony").value = scheme;
    el("explanation").textContent = M.schemes[scheme].note;
    el("strip").replaceChildren();
    el("values").replaceChildren();
    for (const [label, color] of [
      ["Paper", tokens.canvas],
      ["Ink", tokens.text],
      ["Accent", tokens.accent],
      ["Companion", palette.colors[1]],
      ["Highlight", palette.colors[2]],
    ]) {
      const swatch = document.createElement("div");
      swatch.style.backgroundColor = color;
      swatch.style.color = M.contrast(color, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";
      swatch.textContent = label;
      swatch.title = `${label}: ${color}`;
      el("strip").append(swatch);
      const item = document.createElement("li");
      item.textContent = `${label}: ${color}`;
      el("values").append(item);
    }
    for (const [role, value] of Object.entries(tokens)) el("sample").style.setProperty("--preview-" + role, value);
    el("ideas").replaceChildren();
    for (let i = 0; i < 4; i++) {
      const suggestion = M.make(seed, scheme, i);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(i === turn));
      button.setAttribute("aria-label", names[i]);
      const strip = document.createElement("span");
      strip.className = "palette-mini";
      strip.setAttribute("aria-hidden", "true");
      for (const color of [suggestion.light.canvas, suggestion.light.text, suggestion.light.accent, ...suggestion.colors.slice(1)]) {
        const swatch = document.createElement("span");
        swatch.style.backgroundColor = color;
        strip.append(swatch);
      }
      const name = document.createElement("span");
      name.textContent = names[i];
      button.append(strip, name);
      button.addEventListener("click", () => {
        turn = i;
        render();
        el("ideas").children[i].focus();
      });
      el("ideas").append(button);
    }
    el("contrast").textContent = `Text on paper: ${M.contrast(tokens.text, tokens.canvas).toFixed(1)}:1. Accent on paper: ${M.contrast(
      tokens.accent,
      tokens.canvas
    ).toFixed(1)}:1. Both meet WCAG AA for normal text.`;
    el("reset").disabled = !S.get();
  }
  el("controls").addEventListener("submit", (event) => event.preventDefault());
  el("seed").addEventListener("input", () => {
    seed = el("seed").value;
    turn = 0;
    render();
  });
  el("hex").addEventListener("input", () => {
    el("hex").setCustomValidity(M.normalize(el("hex").value) ? "" : "Enter a hex color such as #80533f.");
  });
  el("hex").addEventListener("change", () => {
    const value = M.normalize(el("hex").value);
    if (!value) return el("hex").reportValidity();
    seed = value;
    turn = 0;
    render();
  });
  el("harmony").addEventListener("change", () => {
    scheme = el("harmony").value;
    turn = 0;
    render();
  });
  el("apply").addEventListener("click", () => {
    if (!el("hex").reportValidity()) return;
    const persisted = S.apply(seed, scheme, turn);
    el("status").textContent = persisted
      ? "Palette applied. It stays with you across this website in this browser."
      : "Palette applied for this page. Browser storage is unavailable.";
    render();
  });
  el("reset").addEventListener("click", () => {
    const persisted = S.reset();
    el("status").textContent = persisted
      ? "Original website colors restored."
      : "Original colors restored for this page. The saved choice could not be cleared.";
    render();
  });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("site-palette-change", () => {
    const applied = S.get();
    const nextSignature = signature(applied);
    if (nextSignature !== appliedSignature) {
      if (applied) ({ seed, scheme, turn } = applied);
      appliedSignature = nextSignature;
      el("status").textContent = applied ? "Website palette updated to your saved choice." : "Original website colors restored.";
    }
    render();
  });
  render();
})();
