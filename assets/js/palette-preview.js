// Development-only palette comparison. Add ?palette=paper or ?palette=violet
// to any URL (or use the switcher in the corner); the choice persists across
// pages until ?palette=current.
(function () {
  const KEY = "palette-preview";
  const NAMES = ["current", "paper", "violet"];
  const root = document.documentElement;

  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch (err) {
      return null;
    }
  };
  const apply = (name) => {
    if (name === "current" || !NAMES.includes(name)) {
      delete root.dataset.palettePreview;
    } else {
      root.dataset.palettePreview = name;
    }
    try {
      localStorage.setItem(KEY, name);
    } catch (err) {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  };

  const fromUrl = new URLSearchParams(location.search).get("palette");
  apply(NAMES.includes(fromUrl) ? fromUrl : read() || "current");

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.className = "palette-preview-switch";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Palette preview");
    const current = () => root.dataset.palettePreview || "current";
    NAMES.forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.dataset.palette = name;
      button.addEventListener("click", () => {
        apply(name);
        sync();
      });
      bar.append(button);
    });
    const sync = () => bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.palette === current())));
    sync();
    document.body.append(bar);
  });
})();
