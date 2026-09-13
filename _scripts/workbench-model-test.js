#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const sandbox = {
  console,
  document: {
    createElement: () => ({
      set textContent(value) {
        this.innerHTML = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      },
    }),
  },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
[
  "vendor/tonal.min.js",
  "music/common.js",
  "music/chord-name.js",
  "music/stradella-data.js",
  "music/bayan-keyboard.js",
  "workbench/model.js",
  "workbench/diagrams.js",
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, "assets/js", file), "utf8"), sandbox));
const Model = sandbox.WorkbenchModel;
const json = (value) => JSON.parse(JSON.stringify(value));
let cases = 0;
function test(name, fn) {
  fn();
  cases++;
  console.log("PASS " + name);
}

test("jazz shorthand and lowercase normalize", () => {
  assert.equal(Model.fromName("a-7/G").name, "Am7/G");
  assert.equal(Model.fromName("f#-6/A").notes[0], 9);
});
test("invalid chords and slash bass fail closed", () => {
  ["Am7/banana", "Am7/C/D", "<script>", "Zm7"].forEach((n) => assert.equal(Model.fromName(n), null));
});
test("sharp spelling survives notation and playback", () => {
  const m = Model.fromName("Bmaj7");
  assert.deepEqual(json(m.detail.notes), ["B", "D#", "F#", "A#"]);
  assert.deepEqual(json(Model.voices(m).map((v) => v.midi)), [71, 75, 78, 82]);
  assert.ok(sandbox.WorkbenchDiagrams.staff(m).includes("D♯5"));
});
test("enharmonic octaves agree with MIDI", () => {
  ["Cbmaj7", "C#maj7", "B#maj7"].forEach((name) => {
    Model.voices(Model.fromName(name)).forEach((v) => {
      assert.equal(sandbox.Tonal.Note.midi(v.name + v.octave), v.midi);
      const label = v.name.replace(/b/g, "♭").replace(/#/g, "♯") + v.octave;
      assert.ok(sandbox.WorkbenchDiagrams.keyboard(Model.fromName(name)).includes('aria-label="Hear ' + label + '"'));
    });
  });
});
test("inversion retains exact notes after saving", () => {
  ["C/E", "Am7/G", "C/F#"].forEach((n) => {
    const m = Model.fromName(n),
      restored = Model.restore(Model.entry(m));
    assert.equal(restored.name, m.name);
    assert.deepEqual(json(restored.notes), json(m.notes));
  });
});
test("transpose preserves bass and all pitches", () => {
  const m = Model.fromName("Am7/G"),
    t = Model.transpose(m, 2);
  assert.equal(t.name, "Bm7/A");
  assert.deepEqual(json(t.notes), [9, 11, 2, 6]);
  assert.deepEqual(json(Model.transpose(t, 10).notes), json(m.notes));
});
test("degree progression follows the major key", () => {
  assert.deepEqual(
    ["2", "5", "1"].map((d) => Model.fromDegree(d, 7).name),
    ["Am7", "D7", "Gmaj7"]
  );
  assert.equal(Model.fromDegree("viiø", 0).name, "Bm7b5");
  assert.equal(Model.fromDegree("1", 11).detail.notes[1], "D#");
});
test("recipe roots disambiguate chord detection", () => {
  const notes = sandbox.Music.parseRecipeInput("GM / B");
  assert.equal(Model.fromNotes(notes, notes.buttonRoots).name, "GM/B");
});
test("Am7 recipe is the exact A bass and C major set", () => {
  const r = Model.recipes(Model.fromName("Am7"))[0];
  assert.equal(r.exact, true);
  assert.equal(r.bass, 9);
  assert.deepEqual(json(r.parts[0].notes), [0, 4, 7]);
});
test("slash recipe does not hide omitted tones", () => {
  const r = Model.recipes(Model.fromName("Am7/G"))[0];
  assert.equal(r.bass, 7);
  assert.equal(r.exact, false);
  assert.deepEqual(json(r.missing), [9]);
});
test("major triads use catalog normalization", () => {
  assert.ok(Model.recipes(Model.fromName("C")).length);
  assert.equal(Model.recipes(Model.fromName("C"))[0].exact, true);
});
test("saved prototype v1 is migrated without dropping notes", () => {
  const items = Model.savedItems(JSON.stringify([{ name: "C/E", notes: [4, 7, 0] }]));
  assert.deepEqual(json(items[0].chords[0].notes), [4, 7, 0]);
});
test("saved practice retains key and tempo with safe legacy defaults", () => {
  const chord = Model.entry(Model.fromName("Am7"));
  const item = Model.savedItems(JSON.stringify([{ name: "ii–V–I", chords: [chord], key: 7, bpm: 120 }]))[0];
  assert.equal(item.key, 7);
  assert.equal(item.bpm, 120);
  const invalid = Model.savedItems(JSON.stringify([{ name: "test", chords: [chord], key: 99, bpm: -1 }]))[0];
  assert.equal(invalid.key, null);
  assert.equal(invalid.bpm, 96);
});
test("restored names and theory agree with the saved pitches", () => {
  const note = Model.restore(Model.entry(Model.fromNotes([0])));
  assert.equal(note.suffix, null);
  assert.equal(note.detail, null);
  assert.equal(Model.recipes(note).length, 0);
  const corrected = Model.restore({ name: "Cm", notes: [0, 4, 7] });
  assert.deepEqual(json(corrected.detail.notes), ["C", "E", "G"]);
});
test("user labels are escaped in both text and attributes", () => {
  assert.equal(sandbox.Music.esc('"><img src=x onerror="test">&\''), "&quot;&gt;&lt;img src=x onerror=&quot;test&quot;&gt;&amp;&#39;");
});
test("malformed storage is rejected, not silently overwritten", () => {
  ["oops", "{}", '[{"name":"test","chords":[null]}]', '[{"name":"test","notes":[99]}]'].forEach((raw) => assert.throws(() => Model.savedItems(raw)));
});
test("single notes and unmatched sets still have voices", () => {
  assert.equal(Model.fromNotes([0]).name, "C");
  assert.equal(Model.voices(Model.fromNotes([0])).length, 1);
  assert.deepEqual(json(Model.fromNotes([0, 0, 4, 7]).notes), [0, 4, 7]);
});
test("dense notation keeps full-size scrollable note targets", () => {
  const diagram = sandbox.WorkbenchDiagrams.staff(Model.fromNotes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  assert.ok(diagram.includes('style="min-width:634px"'));
  assert.ok(diagram.includes('width="44" height="44"'));
});
test("all supported catalog chords survive a save roundtrip", () => {
  sandbox.StradellaData.CHORDS.filter((c) => !c.bug && sandbox.Music.chordInfo(0, c.suffix)).forEach((c) => {
    const model = Model.fromSuffix(0, c.suffix);
    assert.ok(model, c.suffix);
    assert.deepEqual(json(Model.restore(Model.entry(model)).notes), json(model.notes), c.suffix);
  });
});
console.log(cases + " model tests passed");
