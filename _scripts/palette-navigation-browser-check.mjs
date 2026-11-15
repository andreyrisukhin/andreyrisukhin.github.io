// node _scripts/palette-navigation-browser-check.mjs http://127.0.0.1:PORT [screenshots-dir]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = new URL(process.argv[2]).origin;
const output = process.argv[3] && path.resolve(process.argv[3]);
const session = `palette-navigation-${process.pid}`;
if (output) mkdirSync(output, { recursive: true });
function browser(...args) {
  const response = JSON.parse(execFileSync("agent-browser", ["--session", session, "--json", ...args], { encoding: "utf8" }));
  assert.equal(response.success, true, response.error);
  return response.data;
}
const evaluate = (source) => browser("eval", source).result;
const wait = (source) => browser("wait", "--fn", source);
const ready = () => wait('document.readyState === "complete"');
const capture = (name) => output && browser("screenshot", path.join(output, `${name}.png`));
const goBack = (route = "/") => {
  browser("back");
  browser("wait", "--url", `${base}${route}`);
  ready();
};
const openPaletteMenu = () => {
  browser("click", "#navbarDropdown-workshop");
  browser("click", 'a.dropdown-item[href="/color/palette/"]');
  wait('!!document.getElementById("palette-apply")');
  ready();
};
try {
  browser("set", "viewport", "1440", "900");
  browser("open", base);
  wait("!!window.SitePalette");
  ready();
  evaluate(`SitePalette.reset(); setThemeSetting("light",false);
    addEventListener("pageshow", e => { if (e.persisted) window.__paletteAtRestore = {seed:SitePalette.get()?.seed ?? null}; });`);
  browser("click", 'a.nav-link[href="/blog/"]');
  browser("wait", "--url", `${base}/blog/`);
  ready();
  browser("click", "#light-toggle");
  wait('document.documentElement.dataset.theme === "dark"');
  goBack();
  capture("theme-back");
  assert.equal(evaluate("document.documentElement.dataset.theme"), "dark", "Back restores the current saved theme, not the cached theme");
  assert.equal(evaluate("document.documentElement.dataset.themeSetting"), "dark");
  assert.ok(evaluate("!!window.__paletteAtRestore"), "This test exercised the browser's Back/Forward cache");
  browser("forward");
  browser("wait", "--url", `${base}/blog/`);
  ready();
  browser("click", "#light-toggle");
  wait('document.documentElement.dataset.themeSetting === "system"');
  goBack();
  assert.equal(evaluate("document.documentElement.dataset.themeSetting"), "system", "Forward then Back restores system mode too");

  openPaletteMenu();
  browser("fill", "#palette-hex", "#217aab");
  browser("click", "#palette-apply");
  goBack();
  assert.equal(evaluate("window.__paletteAtRestore.seed"), "#217aab", "Palette is reconciled during pageshow, before delayed storage events");
  capture("palette-back");
  browser("forward");
  browser("wait", "--url", `${base}/color/palette/`);
  browser("click", "#palette-reset");
  goBack();
  assert.equal(evaluate("window.__paletteAtRestore.seed"), null, "Reset also reconciles during pageshow");

  openPaletteMenu();
  const first = browser("tab").tabs.find((tab) => tab.active).tabId;
  const second = browser("tab", "new", `${base}/color/palette/`).tabId;
  wait("!!window.SitePalette");
  ready();
  browser("fill", "#palette-hex", "#31945b");
  browser("press", "Tab");
  browser("select", "#palette-harmony", "triadic");
  browser("click", "#palette-apply");
  assert.equal(evaluate("SitePalette.get()?.seed"), "#31945b", "Second tab applies its selected seed");
  browser("click", "#light-toggle");
  browser("tab", first);
  wait('SitePalette.get()?.seed === "#31945b"');
  assert.equal(evaluate('document.getElementById("palette-hex").value'), "#31945b", "The selector follows the applied palette from another tab");
  assert.equal(evaluate('document.getElementById("palette-harmony").value'), "triadic");
  assert.equal(
    evaluate("document.documentElement.dataset.themeSetting"),
    evaluate('localStorage.getItem("theme")'),
    "Theme changes synchronize across tabs"
  );
  capture("cross-tab");

  // A history restore with an unchanged saved palette must not discard a draft.
  browser("fill", "#palette-hex", "#b35664");
  browser("click", 'a.nav-link[href="/blog/"]');
  browser("wait", "--url", `${base}/blog/`);
  goBack("/color/palette/");
  assert.equal(evaluate('document.getElementById("palette-hex").value'), "#b35664", "Unapplied drafts survive Back");
  browser("tab", second);
  browser("click", "#palette-reset");
  browser("tab", first);
  wait("SitePalette.get() === null");
  assert.match(evaluate('document.getElementById("palette-status").textContent'), /restored/);
  assert.equal(evaluate("document.documentElement.hasAttribute('data-site-palette')"), false);
  console.log(
    "Browser navigation checks passed: real Back/Forward cache, theme/system/palette/reset, cross-tab editor and theme synchronization, and draft preservation."
  );
} finally {
  browser("close");
}
