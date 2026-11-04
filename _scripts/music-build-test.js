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
  "bass-patterns/",
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
  "sheet/senorita/",
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
const legacyRoutes = ["build/", "stradella/", "chord-recognizer/"];
const sections = [
  ["tools", "Chords", ["workbench/", "songs/"]],
  ["practice", "Practice", ["exercises/", "bass-patterns/", "blues/", "bayan-simulator/"]],
  ["sheets", "Sheets", routes.filter((route) => route.startsWith("sheet/"))],
  ["field-notes", "References", ["scales/", "chords/", "intervals/"]],
];
const hubRoutes = [];
for (const [id, title, members] of sections) {
  const section = hub.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(section, title + " has a hub section");
  assert.ok(section[1].includes(`>${title}</h2>`), title + " uses the navigation label");
  const urls = [...section[1].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(
    urls,
    members.map((route) => "/music/" + route),
    title + " groups its tools once"
  );
  hubRoutes.push(...urls);
}
assert.equal(new Set(hubRoutes).size, hubRoutes.length, "Hub lists each destination only once");
assert.deepEqual(
  [...hubRoutes].sort(),
  routes
    .filter((route) => route && !legacyRoutes.includes(route))
    .map((route) => "/music/" + route)
    .sort(),
  "Hub covers every music tool"
);
for (const route of routes) {
  const page = fs.readFileSync(path.join(site, "music", route, "index.html"), "utf8");
  const nav = page.match(/<nav\b[^>]*class="music-section-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const anchors = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(
    anchors.map((match) => match[2].trim()),
    ["Music", ...sections.map((section) => section[1])],
    route + " has consistent navigation"
  );
  assert.deepEqual(
    anchors.map((match) => match[1].match(/href="([^"]+)"/)[1]),
    ["/music/", ...sections.map((section) => "/music/#" + section[0])],
    route + " links to hub sections"
  );
  const current = anchors.filter((match) => match[1].includes("aria-current="));
  assert.equal(current.length, 1, route + " has one current navigation item");
  const expected = legacyRoutes.includes(route) ? "Chords" : route ? sections.find((section) => section[2].includes(route))[1] : "Music";
  assert.equal(current[0][2].trim(), expected, route + " marks its own group");
  assert.ok(current[0][1].includes(`aria-current="${route ? "location" : "page"}"`), route + " uses the correct current scope");
}
for (const tool of ["/music/workbench/", "/music/songs/", "/music/sheet/reconstructing-more-science/"]) {
  assert.ok(hub.includes(`href="${tool}"`), "Tools hub links to " + tool);
}
for (const route of legacyRoutes) {
  assert.ok(!hub.includes(`href="/music/${route}"`), "Hub omits retired tool " + route);
  const page = fs.readFileSync(path.join(site, "music", route, "index.html"), "utf8");
  assert.ok(page.includes("target.search = location.search") && page.includes("location.hash ||"), route + " preserves shared link state");
  assert.ok(page.includes("location.replace(target.href)"), route + " redirects into Workbench");
  assert.ok(!page.includes('id="stradella-setlist"'), route + " no longer has a duplicate interface");
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
  .map((match) => match[1].split("?")[0])
  .filter((url) => /^\/assets\/js\/(workbench|music|music-songs|music-build|stradella|chord-recognizer|tactus|vendor)\//.test(url));
for (const dependency of dependencies) {
  assert.ok(precache.includes(dependency), "Offline cache includes " + dependency);
}
for (const route of [
  "music/workbench",
  "music/bass-patterns",
  "music/blues",
  "music/exercises",
  "music/bayan-simulator",
  "music/sheet/cogwork-dancers",
  "music/sheet/reconstructing-more-science",
  "music/sheet/senorita",
]) {
  const page = fs.readFileSync(path.join(site, route, "index.html"), "utf8");
  assert.ok(/<script[^>]*\ssrc="\/assets\/js\/tactus\/audio\.js/.test(page), route + " loads the shared audio engine");
  assert.ok(!page.includes("/assets/js/music/audio.js"), route + " no longer loads the retired audio helper");
  assert.ok(!/cdn\.jsdelivr\.net\/npm\/soundfont-player/.test(page), route + " uses the vendored soundfont player");
}
for (const dependency of ["/assets/js/theme.js", "/assets/js/vanilla-back-to-top.min.js", "/assets/css/bootstrap.min.css"]) {
  assert.ok(precache.includes(dependency), "Offline page shell includes " + dependency);
}
const senorita = fs.readFileSync(path.join(site, "music/sheet/senorita/index.html"), "utf8");
assert.ok(senorita.includes('data-playback-instrument="accordion"'), "Señorita plays on accordion");
assert.ok(senorita.includes("/sheet-music/playback.js"), "Señorita has sheet playback");
assert.ok(
  /data-musicxml-url="\/assets\/music\/sheet-music\/senorita\/senorita\.musicxml\?v=\d+"/.test(senorita),
  "Señorita's score URL changes with each build so cached copies of an old score are skipped"
);
assert.ok(
  /startsWith\('\/assets\/music\/sheet-music\/'\)\)\s*\{\s*event\.respondWith\(networkFirst\(new Request\(req, \{ cache: 'no-cache' \}\)\)\)/.test(
    fs.readFileSync(path.join(site, "sw.js"), "utf8")
  ),
  "Offline cache fetches score files fresh when online"
);
assert.ok(senorita.includes('data-playback-stradella="true"'), "Señorita plays left-hand chord buttons as chords");
const senoritaXml = fs.readFileSync(path.join(site, "assets/music/sheet-music/senorita/senorita.musicxml"), "utf8");
assert.equal((senoritaXml.match(/<measure /g) || []).length, 16, "Señorita stops before rehearsal mark B");
assert.ok(!/>B<\/rehearsal>/.test(senoritaXml) && /light-heavy/.test(senoritaXml), "Señorita ends with a final barline");
const senoritaM3 = senoritaXml.slice(senoritaXml.indexOf('<measure number="3"'), senoritaXml.indexOf('<measure number="5"'));
assert.ok(
  !/<step>C<\/step>\s*<octave>3<\/octave>/.test(senoritaM3) && /<step>C<\/step>\s*<octave>4<\/octave>/.test(senoritaM3),
  "Señorita v1.1 writes the C chord cues in the chord register"
);
assert.ok(html.includes('id="song-charts"') && html.includes('id="stradella-play"'), "Workbench contains song charts and the timed player");
assert.ok(/window\.SongChartData = \[\{/.test(html), "Workbench inlines the song chart data");
for (const id of ["workspace-study", "workspace-setlist", "recognize", "recipes", "recognizer-text-input", "stradella-catalog"]) {
  assert.ok(html.includes(`id="${id}"`), "Workbench includes " + id);
}
const scriptUrls = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
assert.equal(new Set(scriptUrls).size, scriptUrls.length, "Consolidated tools load each script once");
const songs = fs.readFileSync(path.join(site, "music/songs/index.html"), "utf8");
assert.ok(songs.includes("Song library") && songs.includes("/music-songs/library.js"), "Song library reads both original stores");
const scales = fs.readFileSync(path.join(site, "music/scales/index.html"), "utf8");
const sheet = fs.readFileSync(path.join(site, "music/sheet/cogwork-dancers/index.html"), "utf8");
assert.ok(sheet.includes('class="practice-settings"'), "Cogwork Dancers includes shared practice settings");
assert.ok(sheet.includes('id="sheet-inspector"'), "Cogwork Dancers includes accessible note inspection");
assert.ok(sheet.includes("/sheet-music/playback.js"), "Cogwork Dancers mounts the shared reader");
assert.ok(!sheet.includes("/sheet-music/chord-inspector.js"), "Practice page does not mount the legacy click handler");
const played = fs.readFileSync(path.join(site, "music/sheet/reconstructing-more-science/index.html"), "utf8");
assert.ok(played.includes('data-playback-instrument="drawbar_organ"'), "Reconstructing More Science defaults to drawbar organ");
const playheadAt = played.indexOf("/sheet-music/playhead.js");
assert.ok(playheadAt > 0 && playheadAt < played.indexOf("/sheet-music/playback.js"), "Playback page loads the playhead before the transport");
const transposeAt = played.indexOf("/sheet-music/transpose.js");
assert.ok(transposeAt > 0 && transposeAt < played.indexOf("/sheet-music/playback.js"), "Playback page loads key names before the transport");
assert.ok(played.includes('data-key-mode="minor"'), "Reconstructing More Science names its key as F minor");
const sheetIds = [...sheet.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(sheetIds).size, sheetIds.length, "Sheet practice has no duplicate IDs");
for (const file of [
  "practice-timeline.js",
  "practice-player.js",
  "score.js",
  "transport.js",
  "playback.js",
  "playhead.js",
  "transpose.js",
  "page.js",
  "practice-inspector.js",
]) {
  assert.ok(precache.includes("/assets/js/sheet-music/" + file), "Offline cache includes " + file);
}
const otherSheet = fs.readFileSync(path.join(site, "music/sheet/reclaiming-entropy/index.html"), "utf8");
assert.ok(otherSheet.includes("/sheet-music/practice-inspector.js"), "Read-only sheet uses shared inspection");
assert.ok(!otherSheet.includes("/sheet-music/playback.js"), "Read-only sheet has no player");
assert.ok(!otherSheet.includes('class="practice-settings"'), "Read-only sheet hides playback settings");
for (const name of ["senorita", "reconstructing-more-science", "cogwork-dancers", "reclaiming-entropy"]) {
  const content = fs.readFileSync(path.join(site, "music/sheet", name, "index.html"), "utf8");
  assert.ok(content.includes("sheet-reader"), name + " uses the common reader shell");
  assert.ok(content.includes('class="sheet-downloads"'), name + " has common downloads");
  assert.ok(content.includes('id="sheet-inspector"'), name + " has common inspection");
  assert.ok(!content.includes("/sheet-music/practice.js"), name + " does not load the retired player controller");
  assert.ok(!content.includes("/sheet-music/chord-inspector.js"), name + " has only one note click handler");
  const scriptUrls = [...content.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
  for (const url of scriptUrls.filter((url) => /^\/assets\/js\/(sheet-music|workbench|music|tactus|vendor)\//.test(url))) {
    if (url.endsWith("/dev-annotator.js")) continue;
    assert.ok(precache.includes(url), name + " caches " + url);
  }
}
assert.equal((scales.match(/class="music-table-scroll"/g) || []).length, 4, "All scale tables have scroll regions");
assert.equal((scales.match(/<table[\s>]/g) || []).length, 4, "Markdown tables render inside their wrappers");
assert.ok(!html.includes("site-dev-annotator.js"), "Production omits development controls");
assert.equal(JSON.parse(fs.readFileSync(path.join(site, "manifest.webmanifest"), "utf8")).start_url, "/music/");
console.log(`${routes.length} music routes, ${links} local links/assets, and ${dependencies.length} offline dependencies passed`);
