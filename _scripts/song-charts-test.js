#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
["vendor/tonal.min.js", "music/common.js", "music/chord-name.js", "music/stradella-data.js", "music-build/charts.js"].forEach((file) =>
  vm.runInContext(fs.readFileSync(path.join(root, "assets/js", file), "utf8"), sandbox)
);

const { charts } = JSON.parse(fs.readFileSync(path.join(root, "_data/music/song_charts.json"), "utf8"));
const { buildEntries } = sandbox.SongCharts;
const S = sandbox.StradellaData;
const plain = (value) => JSON.parse(JSON.stringify(value));

let checked = 0;
for (const chart of charts) {
  assert.ok(chart.id && chart.title && chart.bpm >= 40 && chart.bpm <= 200, chart.id + " has title and playable tempo");
  assert.ok(chart.keys.length >= 1, chart.id + " has a key");
  const beatsPerBar = chart.beats_per_bar || 4;
  for (const key of chart.keys) {
    for (const section of chart.sections) {
      const entries = buildEntries(chart, [section.id], key.offset);
      assert.equal(entries[0].label, section.label, section.id + " labels its first card");
      assert.equal(entries.filter((e) => e.label).length, 1, section.id + " labels only its first card");
      const beats = entries.reduce((sum, e) => sum + e.beats, 0);
      assert.equal(beats, section.bars.length * beatsPerBar, section.id + " fills every bar");
      for (const entry of entries) {
        assert.ok(S.chordById(entry.id), chart.id + " uses known chord " + entry.id);
        assert.ok(Number.isInteger(entry.key) && entry.key >= 0 && entry.key < 12);
        checked++;
      }
    }
    const whole = buildEntries(chart, null, key.offset);
    assert.equal(whole.filter((e) => e.label).length, chart.form.length, chart.id + " labels every section in the form");
  }
}

const fly = charts.find((c) => c.id === "fly-me-to-the-moon");
const rap = plain(buildEntries(fly, ["rap"], 0));
assert.deepEqual(rap[0], { id: "m7", key: 9, beats: 4, label: "Rap intro" });
assert.deepEqual(rap[10], { id: "maj", key: 0, bass: 4, beats: 4 }, "C/E keeps its E bass");
assert.deepEqual(rap.slice(11, 13), [
  { id: "7", key: 9, beats: 2 },
  { id: "dim7", key: 7, beats: 2 },
]);
assert.equal(rap[5].id, "hdim7", "Bm7b5 maps to the half-diminished recipe");

const rises = charts.find((c) => c.id === "rises-the-moon");
const concert = plain(buildEntries(rises, ["ending"], 1));
assert.deepEqual(concert, [
  { id: "maj7", key: 6, bass: 10, beats: 4, label: "Ending" },
  { id: "m9", key: 10, beats: 4 },
]);
assert.equal(buildEntries(rises, ["intro"], 0)[0].key, 9, "Am shapes stay in A");
assert.equal(buildEntries(rises, ["verse-alt"], 1)[7].id, "maj7s5");

console.log(`${charts.length} song charts, ${checked} chord cards resolved`);
