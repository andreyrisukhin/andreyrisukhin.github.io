#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const stores = new Map();
let quota = false;
let writes = 0;
const sandbox = {
  console,
  localStorage: {
    getItem(key) {
      return stores.get(key) ?? null;
    },
    setItem(key, value) {
      if (quota) throw new Error("Quota exceeded");
      stores.set(key, value);
      writes++;
    },
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of [
  "vendor/tonal.min.js",
  "music/common.js",
  "music/chord-name.js",
  "music/stradella-data.js",
  "workbench/model.js",
  "music-songs/library.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, "assets/js", file), "utf8"), sandbox);
}
const Library = sandbox.MusicLibrary;
const plain = (value) => JSON.parse(JSON.stringify(value));
const study = {
  name: "Ordered study",
  chords: [{ name: "C/E", notes: [4, 0, 7], voicing: "bass-octave", gridCell: 5, handChoice: { voicing: "test", bass: 4 } }],
  mode: "progression",
  bpm: 123,
  loop: true,
  sound: "hands",
  key: 9,
  keyMode: "minor",
  index: 0,
  gap: 1,
  customMetadata: { keep: true },
};
const snapshot = {
  tool: "stradella",
  selected: [{ id: "maj", key: 0, bass: 4, beats: 3, label: "Verse" }],
  catalogKey: 9,
  meter: 3,
  bpm: 137,
  voice: "guitar",
  hasDim7: false,
};
const song = { id: "old-song", name: "Existing song", snapshot, syncSha: "keep-sha", syncedAt: "2026-01-01" };
stores.set("musicWorkbenchSetlist", JSON.stringify([study]));
stores.set("stradella-songs", JSON.stringify([song]));
const originalStudy = stores.get("musicWorkbenchSetlist");
const originalSongs = stores.get("stradella-songs");
assert.deepEqual(plain(Library.read("study").entries), [study]);
assert.deepEqual(plain(Library.read("setlist").entries), [song]);
assert.deepEqual(plain(Library.stradellaSnapshot(snapshot)), snapshot);
assert.equal(writes, 0, "Reading both formats never migrates or rewrites them");

Library.changeStudy(0, originalStudy, "Renamed");
assert.deepEqual(
  JSON.parse(stores.get("musicWorkbenchSetlist")),
  [{ ...study, name: "Renamed" }],
  "Rename preserves all settings and unknown metadata"
);
assert.equal(stores.get("stradella-songs"), originalSongs, "Editing a study does not touch set lists or sync metadata");
assert.throws(() => Library.changeStudy(0, originalStudy, null), /another tab/);
quota = true;
const renamed = stores.get("musicWorkbenchSetlist");
assert.throws(() => Library.changeStudy(0, renamed, null), /Quota/);
assert.equal(stores.get("musicWorkbenchSetlist"), renamed);
quota = false;
Library.changeStudy(0, renamed, null);
assert.deepEqual(JSON.parse(stores.get("musicWorkbenchSetlist")), []);

for (const bad of ["{invalid", "{}", '[{"name":"bad","chords":[]}]']) {
  stores.set("musicWorkbenchSetlist", bad);
  assert.ok(Library.read("study").error);
  assert.deepEqual(plain(Library.read("setlist").entries), [song], "Broken studies do not hide set lists");
  assert.throws(() => Library.changeStudy(0, bad, "No"), /Could not read/);
  assert.equal(stores.get("musicWorkbenchSetlist"), bad, "Corrupt sources remain intact");
}
stores.set("musicWorkbenchSetlist", originalStudy);
stores.set("stradella-songs", "{broken");
assert.ok(Library.read("setlist").error);
assert.equal(Library.read("study").entries[0].name, study.name);
assert.deepEqual(
  plain(Library.stradellaSnapshot({ key: 9, selected: ["m7"] })).selected,
  [{ id: "m7", key: 9 }],
  "Original string-ID songs load without rewriting their source"
);
for (const selected of [[{ id: "missing", key: 0 }], [{ id: "maj", key: 12 }], [{ id: "maj", key: 0, beats: 0 }], [null]]) {
  assert.throws(() => Library.stradellaSnapshot({ selected }), /invalid chords/);
}
stores.set("stradella-songs", JSON.stringify([{ id: "bad-date", updatedAt: 42 }]));
assert.ok(Library.read("setlist").error, "Malformed display metadata cannot break the unified library");
assert.equal(Library.read("study").entries[0].name, study.name);
sandbox.document = {
  readyState: "loading",
  addEventListener() {},
  getElementById() {
    return null;
  },
};
sandbox.StradellaTool = {
  getSnapshot() {
    return snapshot;
  },
};
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/music-songs/main.js"), "utf8"), sandbox);
const corruptSongs = stores.get("stradella-songs");
assert.equal(sandbox.MusicSongs.saveCurrentStradellaAs("Do not overwrite", ""), null);
assert.equal(stores.get("stradella-songs"), corruptSongs, "Saving cannot overwrite an unreadable song store");
stores.set("stradella-songs", originalSongs);
quota = true;
assert.equal(sandbox.MusicSongs.saveCurrentStradellaAs("Quota", ""), null);
assert.equal(stores.get("stradella-songs"), originalSongs);
quota = false;
assert.ok(sandbox.MusicSongs.saveCurrentStradellaAs("New song", ""));
const savedSongs = JSON.parse(stores.get("stradella-songs"));
assert.equal(savedSongs.length, 2);
assert.deepEqual(savedSongs[0], song, "Adding a song preserves older records and sync metadata");
console.log("Music library: read-only compatibility, exact metadata, corrupt stores, stale edits, quota failures, and legacy snapshots passed");
