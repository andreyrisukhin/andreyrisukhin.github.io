// node _scripts/theme-test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const listeners = {};
const attributes = {};
const settings = new Map([["theme", "light"]]);
const writes = [];
const localStorage = {
  getItem: (key) => settings.get(key) ?? null,
  setItem: (key, value) => {
    writes.push([key, value]);
    settings.set(key, value);
  },
};
const context = {
  localStorage,
  document: { documentElement: { setAttribute: (key, value) => (attributes[key] = value) }, addEventListener() {} },
  window: {
    addEventListener: (name, fn) => (listeners[name] = fn),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js/theme.js"), "utf8"), context);
// Keep this suite focused on preference reconciliation, not chart rendering.
vm.runInContext(
  'applyTheme = (animate) => { document.documentElement.setAttribute("data-theme", determineComputedTheme()); document.documentElement.setAttribute("animated", animate); }; initTheme();',
  context
);
assert.equal(attributes["data-theme"], "light");
const initialWrites = writes.length;
settings.set("theme", "dark");
listeners.pageshow({ persisted: false });
assert.equal(attributes["data-theme"], "light");
listeners.pageshow({ persisted: true });
assert.equal(attributes["data-theme"], "dark");
assert.equal(attributes["data-theme-setting"], "dark");
assert.equal(attributes.animated, false, "History restores do not animate from the stale theme");
assert.equal(writes.length, initialWrites, "Restoring never overwrites the newer saved choice");
settings.set("theme", "light");
listeners.storage({ key: "theme", storageArea: {} });
assert.equal(attributes["data-theme"], "dark", "Ignore session storage");
listeners.storage({ key: "site-palette-v1", storageArea: localStorage });
assert.equal(attributes["data-theme"], "dark", "Ignore unrelated keys");
listeners.storage({ key: "theme", storageArea: localStorage });
assert.equal(attributes["data-theme"], "light");
settings.clear();
listeners.storage({ key: null, storageArea: localStorage });
assert.equal(attributes["data-theme-setting"], "system");
assert.equal(attributes["data-theme"], "light");
console.log("Theme tests passed: Back/Forward restoration, cross-tab updates, storage isolation, and reset.");
