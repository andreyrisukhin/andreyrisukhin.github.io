// node _scripts/color-palette-test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..", "assets/js/color-palette");
const context = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "model.js"), "utf8"), context);
const M = context.SitePaletteModel;
assert.equal(M.normalize("#AbC"), "#aabbcc");
for (const value of ["", null, "red", "#ffff", "</style>", "#123456;"]) assert.equal(M.normalize(value), null);
for (const [seed, scheme, turn] of [
  ["bad", "analogous", 0],
  ["#ffffff", "toString", 0],
  ["#ffffff", "triadic", -1],
  ["#ffffff", "triadic", 0.5],
  ["#ffffff", "triadic", 4],
])
  assert.equal(M.make(seed, scheme, turn), null);
assert.equal(M.contrast("#ffffff", "#000000"), 21);
let count = 0;
for (let color = 0; color <= 0xffffff; color += 104729) {
  const seed = "#" + color.toString(16).padStart(6, "0");
  for (const scheme of Object.keys(M.schemes)) {
    for (let turn = 0; turn < 4; turn++) {
      const palette = M.make(seed, scheme, turn);
      for (const tokens of [palette.light, palette.dark]) {
        for (const value of Object.values(tokens)) assert.match(value, /^#[0-9a-f]{6}$/);
        for (const surface of [tokens.canvas, tokens.surface, tokens["code-bg"]]) {
          assert.ok(M.contrast(tokens.text, surface) >= 4.5, `${seed} text ${scheme}`);
          assert.ok(M.contrast(tokens["text-muted"], surface) >= 4.5, `${seed} muted ${scheme}`);
        }
        for (const surface of [tokens.canvas, tokens.surface]) {
          assert.ok(M.contrast(tokens.accent, surface) >= 4.5);
          assert.ok(M.contrast(tokens["accent-hover"], surface) >= 4.5);
        }
        assert.ok(M.contrast(tokens.accent, tokens["on-accent"]) >= 4.5);
        assert.ok(M.contrast(tokens["accent-hover"], tokens["on-accent"]) >= 4.5);
      }
      count++;
    }
  }
}
// Initialization, persistence, reset, corrupt storage, and storage failures.
function browser(initial, blocked = false) {
  let stored = initial;
  const attributes = new Set();
  const style = {};
  const listeners = {};
  const window = { SitePaletteModel: M, addEventListener: (name, fn) => (listeners[name] = fn) };
  const document = {
    createElement: () => style,
    head: { append() {} },
    documentElement: { toggleAttribute: (name, on) => (on ? attributes.add(name) : attributes.delete(name)) },
    dispatchEvent() {},
  };
  const localStorage = {
    getItem() {
      if (blocked) throw Error("blocked");
      return stored;
    },
    setItem(key, value) {
      if (blocked) throw Error("blocked");
      stored = value;
    },
    removeItem() {
      if (blocked) throw Error("blocked");
      stored = null;
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "site.js"), "utf8"), { window, document, localStorage, CustomEvent: function () {} });
  return { api: window.SitePalette, style, attributes, listeners, stored: () => stored };
}
for (const initial of [null, "{", "{}", '{"seed":"#fff","scheme":"__proto__","turn":0}']) {
  assert.equal(browser(initial).api.get(), null);
}
const b = browser(null);
assert.equal(b.api.apply("#80533f", "triadic", 1), true);
assert.equal(b.api.get().scheme, "triadic");
assert.ok(b.style.textContent.includes('data-theme="dark"'));
assert.ok(b.attributes.has("data-site-palette"));
assert.equal(browser(b.stored()).api.get().turn, 1);
assert.equal(b.api.apply("invalid", "triadic", 0), false);
assert.equal(b.api.get().turn, 1);
assert.equal(b.api.reset(), true);
assert.equal(b.api.get(), null);
assert.equal(b.style.textContent, "");
assert.equal(b.attributes.size, 0);
const denied = browser(null, true);
assert.equal(denied.api.apply("#00ff00", "analogous", 0), false);
assert.ok(denied.api.get());
assert.equal(denied.api.reset(), false);
assert.equal(denied.api.get(), null);
console.log(`Palette tests passed: ${count} palettes, both themes, persistence, reset, invalid data, and blocked storage.`);
