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
const aliases = [
  ["", ["", "M", "maj", "^"]],
  ["m", ["m", "min", "-"]],
  ["maj7", ["maj7", "M7", "Δ", "ma7", "Maj7", "^7"]],
  ["m7", ["m7", "min7", "mi7", "-7"]],
  ["7", ["7", "dom"]],
  ["sus4", ["sus4", "sus"]],
  ["7sus4", ["7sus4", "7sus"]],
  ["aug", ["aug", "+", "+5", "^#5"]],
  ["dim", ["dim", "°", "o"]],
  ["dim7", ["dim7", "°7", "o7"]],
  ["m7b5", ["m7b5", "ø", "h7", "h", "-7b5"]],
  ["mMaj7", ["mMaj7", "mM7", "mΔ"]],
];
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
test("common chord aliases have one display name without changing musical identity", () => {
  for (const root of ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Cb", "B#"]) {
    for (const [canonical, spellings] of aliases) {
      for (const bass of ["", "/G#"]) {
        const expected = Model.fromName(root + canonical + bass);
        assert.equal(expected.name, root + canonical + bass);
        for (const suffix of spellings) {
          const input = root + suffix + bass;
          const actual = Model.fromName(input);
          assert.deepEqual(json(actual), json(expected), input);
          assert.deepEqual(json(actual.detail.notes), json(sandbox.Tonal.Chord.get(root + suffix).notes), input + " spelling");
          assert.deepEqual(json(Model.voices(actual)), json(Model.voices(expected)), input + " voicing");
          assert.deepEqual(json(Model.fromName(actual.name)), json(actual), input + " idempotence");
        }
      }
    }
  }
});
test("saved aliases and suffix entry restore canonical names and selected voicings", () => {
  for (const [canonical, spellings] of aliases) {
    const expected = Model.fromName("Db" + canonical + "/Ab");
    for (const suffix of spellings) {
      const saved = {
        ...Model.entry(expected),
        name: "Db" + suffix + "/Ab",
        suffix,
        voicing: "bass-octave",
        handChoice: { voicing: "standard", bass: 8 },
        gridCell: 12,
      };
      const restored = Model.restore(saved);
      assert.equal(restored.name, "Db" + canonical + "/Ab");
      assert.equal(restored.suffix, canonical);
      assert.deepEqual(json(restored.notes), json(expected.notes));
      assert.equal(restored.voicing, saved.voicing);
      assert.deepEqual(json(restored.handChoice), saved.handChoice);
      assert.equal(restored.gridCell, saved.gridCell);
      assert.equal(Model.fromSuffix(0, suffix).name, "C" + canonical);
      assert.equal(Model.transpose(Model.fromName("B" + suffix), -2).name, "A" + canonical);
    }
  }
});
test("normalization preserves enharmonic spellings and distinct roots and chord types", () => {
  for (const name of ["C#maj7", "Dbmaj7", "C/E", "C/G", "C6", "Am7", "Csus2", "Csus4", "Cdim", "Cdim7", "Cm7b5", "Cm7", "CmMaj7"]) {
    assert.equal(Model.fromName(name).name, name);
  }
  assert.deepEqual(json(Model.fromName("C6").notes).sort(), json(Model.fromName("Am7").notes).sort());
  assert.notEqual(Model.fromName("C6").root, Model.fromName("Am7").root);
});
test("detected chords and their alternatives also use canonical display names", () => {
  const model = Model.fromNotes([0, 4, 7, 9]);
  assert.ok(model.alternatives.length);
  for (const name of [model.name, ...model.alternatives]) assert.equal(Model.fromName(name).name, name);
  assert.ok(model.alternatives.includes("Am7/C"), "Distinct-root interpretations are retained");
  assert.equal(Model.fromNotes([0, 4, 8]).name, "Caug");
  assert.equal(Model.fromNotes([0, 3, 7, 11]).name, "CmMaj7");
});
test("minor-seventh aliases use m7 without changing roots or notes", () => {
  for (const root of ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Cb", "B#"]) {
    const expected = json(Model.fromName(root + "m7"));
    for (const suffix of ["min7", "mi7", "-7", "m7"]) {
      assert.deepEqual(json(Model.fromName(root + suffix)), expected, root + suffix);
    }
  }
  assert.deepEqual(json(Model.fromName("Bmin7").detail.notes), ["B", "D", "F#", "A"]);
  assert.deepEqual(json(Model.fromName("Amin7").detail.notes), ["A", "C", "E", "G"]);
});
test("minor-seventh alias normalization preserves slash bass and saved voicings", () => {
  const expected = Model.fromName("Bm7/A");
  assert.deepEqual(json(Model.fromName("bmin7/A")), json(expected));
  const saved = { ...Model.entry(expected), name: "Bmin7/A", suffix: "min7" };
  assert.deepEqual(json(Model.restore(saved)), json(Model.restore(Model.entry(expected))));
  assert.deepEqual(json(Model.voices(Model.fromName("Bmin7/A"))), json(Model.voices(expected)));
  assert.equal(Model.fromSuffix(11, "min7").name, "Bm7");
  assert.equal(Model.transpose(Model.fromName("Bmin7"), -2).name, "Am7");
});
test("normalization leaves other extensions and invalid names alone", () => {
  for (const name of ["Bmaj7", "Bm7b5", "Bm7add11", "Bmaj9", "Bm9", "B7b9"]) {
    assert.equal(Model.fromName(name).name, name);
  }
  assert.equal(Model.fromName("Bmin7garbage"), null);
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
  assert.equal(Model.fromNotes(notes, notes.buttonRoots).name, "G/B");
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
test("picked voicing survives storage and uses the same MIDI on staff and keyboard", () => {
  const picked = { ...Model.fromName("C/E"), notes: [4, 0, 7], voicing: "bass-octave", handChoice: { voicing: "standard", bass: 4 } };
  const restored = Model.restore(Model.entry(picked));
  assert.equal(restored.voicing, "bass-octave");
  assert.deepEqual(json(restored.handChoice), picked.handChoice);
  assert.deepEqual(json(Model.voices(restored).map((v) => v.midi)), [64, 72, 67]);
  const staff = sandbox.WorkbenchDiagrams.staff(restored);
  assert.ok(staff.includes("chosen order"));
  const keys = sandbox.WorkbenchDiagrams.keyboard(restored);
  for (const midi of [64, 72, 67]) assert.ok(keys.includes('data-midi="' + midi + '"'));
  assert.equal(Model.transpose(restored, 2).voicing, "bass-octave");
  assert.deepEqual(json(Model.transpose(restored, 2).notes), [6, 2, 9]);
});
test("malformed optional voicing metadata cannot change a restored model", () => {
  const entry = Model.entry(Model.fromName("D7"));
  const restored = Model.restore({ ...entry, voicing: "unknown", handChoice: { voicing: {}, bass: 99 } });
  assert.equal(restored.voicing, undefined);
  assert.equal(restored.handChoice, undefined);
});
test("grid cells persist and malformed positions are ignored", () => {
  const chord = Model.fromName("Am7");
  chord.gridCell = 12;
  assert.equal(Model.restore(Model.entry(chord)).gridCell, 12);
  assert.equal(Model.transpose(chord, 2).gridCell, 12);
  for (const value of [-1, 256, "4", 1.5, null]) {
    assert.equal(Model.restore({ ...Model.entry(chord), gridCell: value }).gridCell, undefined);
  }
});
console.log(cases + " model tests passed");
