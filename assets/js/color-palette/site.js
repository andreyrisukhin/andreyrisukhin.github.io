// Loaded before styles so a saved palette is present on the first paint.
(function () {
  const M = window.SitePaletteModel;
  const key = "site-palette-v1";
  let active = null;
  const style = document.createElement("style");
  style.id = "site-palette-theme";
  document.head.append(style);

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved && M.make(saved.seed, saved.scheme, saved.turn);
    } catch (_) {
      return null;
    }
  }
  function render(palette) {
    active = palette;
    document.documentElement.toggleAttribute("data-site-palette", !!palette);
    style.textContent = palette
      ? ["light", "dark"]
          .map((mode) => {
            const selector = mode === "dark" ? 'html[data-site-palette][data-theme="dark"]' : "html[data-site-palette]";
            return `${selector}{${Object.entries(palette[mode])
              .map(([role, value]) => `--color-${role}:${value};`)
              .join("")}background-color:var(--color-canvas);}`;
          })
          .join("\n")
      : "";
    document.dispatchEvent(new CustomEvent("site-palette-change"));
  }
  function save(palette) {
    let persisted = true;
    try {
      if (palette) localStorage.setItem(key, JSON.stringify({ seed: palette.seed, scheme: palette.scheme, turn: palette.turn }));
      else localStorage.removeItem(key);
    } catch (_) {
      persisted = false;
    }
    render(palette);
    return persisted;
  }
  window.SitePalette = {
    get: () => active,
    apply: (seed, scheme, turn) => {
      const palette = M.make(seed, scheme, turn);
      return palette ? save(palette) : false;
    },
    reset: () => save(null),
  };
  render(read());
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) render(read());
  });
})();
