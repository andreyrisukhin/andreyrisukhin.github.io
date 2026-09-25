#!/usr/bin/env node
// Run after JEKYLL_ENV=production bundle exec jekyll build.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const site = path.resolve(__dirname, "../_site");
const routes = [
  "",
  "workbench/",
  "exercises/",
  "stradella/",
  "build/",
  "scales/",
  "chords/",
  "intervals/",
  "songs/",
  "blues/",
  "bayan-simulator/",
  "chord-recognizer/",
  "sheet/cogwork-dancers/",
  "sheet/reclaiming-entropy/",
  "sheet/reconstructing-more-science/",
];
let links = 0;
for (const route of routes) {
  const html = fs.readFileSync(path.join(site, "music", route, "index.html"), "utf8");
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, route + " has one title");
  assert.ok(html.includes("music-notebook"), route + " uses the music theme");
  assert.ok(!html.includes("fixed-bottom-footer"), route + " has no fixed footer");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1], "https://example.test/music/" + route);
    if (url.origin !== "https://example.test") continue;
    if (!url.pathname.startsWith("/music/") && !url.pathname.startsWith("/assets/")) continue;
    const target = path.join(site, decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
    assert.ok(fs.existsSync(target), route + " links to missing " + url.pathname);
    links++;
  }
}
const hub = fs.readFileSync(path.join(site, "music/index.html"), "utf8");
for (const tool of ["/music/workbench/", "/music/chord-recognizer/", "/music/build/", "/music/songs/", "/music/sheet/reconstructing-more-science/"]) {
  assert.ok(hub.includes(`href="${tool}"`), "Tools hub links to " + tool);
}
assert.ok(!hub.includes('id="workbench-composer"'), "Tools hub stays compact without the workbench");
assert.ok(hub.includes('id="field-notes"'), "Tools hub keeps the #field-notes anchor");
assert.ok(hub.includes('"/music/workbench/" + location.search'), "Tools hub forwards old share links to the workbench");
const html = fs.readFileSync(path.join(site, "music/workbench/index.html"), "utf8");
assert.ok(html.includes('id="workbench-composer"'), "Production includes the progression composer");
assert.ok(html.includes('id="left-keyboard"'), "Production includes the approved hand view");
assert.ok(!/src="[^"]*_prototypes\//.test(html), "Production has no prototype script dependencies");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Integrated page has no duplicate element IDs");
const precache = vm.runInNewContext(fs.readFileSync(path.join(site, "sw.js"), "utf8") + "\nPRECACHE_URLS;", {
  self: { addEventListener() {} },
});
const dependencies = [...html.matchAll(/<script src="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => /^\/assets\/js\/(workbench|music|vendor)\//.test(url));
for (const dependency of dependencies) {
  assert.ok(precache.includes(dependency), "Offline cache includes " + dependency);
}
for (const dependency of ["/assets/js/theme.js", "/assets/js/vanilla-back-to-top.min.js", "/assets/css/bootstrap.min.css"]) {
  assert.ok(precache.includes(dependency), "Offline page shell includes " + dependency);
}
const scales = fs.readFileSync(path.join(site, "music/scales/index.html"), "utf8");
const sheet = fs.readFileSync(path.join(site, "music/sheet/cogwork-dancers/index.html"), "utf8");
assert.ok(sheet.includes('class="practice-transport"'), "Cogwork Dancers includes practice controls");
assert.ok(sheet.includes('id="sheet-inspector"'), "Cogwork Dancers includes accessible note inspection");
assert.ok(!sheet.includes("/sheet-music/playback.js"), "Practice page does not mount the legacy transport");
assert.ok(!sheet.includes("/sheet-music/chord-inspector.js"), "Practice page does not mount the legacy click handler");
const sheetIds = [...sheet.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(sheetIds).size, sheetIds.length, "Sheet practice has no duplicate IDs");
for (const file of ["practice-timeline.js", "practice-player.js", "practice.js", "practice-inspector.js"]) {
  assert.ok(precache.includes("/assets/js/sheet-music/" + file), "Offline cache includes " + file);
}
const otherSheet = fs.readFileSync(path.join(site, "music/sheet/reclaiming-entropy/index.html"), "utf8");
assert.ok(otherSheet.includes("/sheet-music/chord-inspector.js"), "Other sheet retains its existing inspector");
assert.equal((scales.match(/class="music-table-scroll"/g) || []).length, 4, "All scale tables have scroll regions");
assert.equal((scales.match(/<table[\s>]/g) || []).length, 4, "Markdown tables render inside their wrappers");
assert.ok(!html.includes("site-dev-annotator.js"), "Production omits development controls");
assert.equal(JSON.parse(fs.readFileSync(path.join(site, "manifest.webmanifest"), "utf8")).start_url, "/music/");
console.log(`${routes.length} music routes, ${links} local links/assets, and ${dependencies.length} offline dependencies passed`);
