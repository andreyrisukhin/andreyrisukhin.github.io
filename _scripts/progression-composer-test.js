#!/usr/bin/env node
// Pins the shared composer's teaching claims and edit boundaries without browser fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const c = {};
c.window = c;
c.self = c;
vm.createContext(c);
["assets/js/vendor/tonal.min.js", "assets/js/music/common.js", "assets/js/workbench/model.js", "assets/js/workbench/harmony.js"].forEach((file) =>
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), c)
);
const H = c.ComposerHarmony,
  M = c.WorkbenchModel,
  T = c.Tonal;
const json = (value) => JSON.parse(JSON.stringify(value));
const G = { tonic: "G", mode: "major" },
  A = { tonic: "A", mode: "minor" };
const model = M.fromName;
const names = (chords) => Array.from(chords, (chord) => chord.name);
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
test("chord entry never mistakes bare letters for a note collection", () => {
  assert.deepEqual(names(H.parse("C F G", G).chords), ["C", "F", "G"]);
  assert.deepEqual(names(H.parse("C E G", G).chords), ["C", "E", "G"]);
  assert.deepEqual(names(H.parse("Am7, D7 | Gmaj7", G).chords), ["Am7", "D7", "Gmaj7"]);
});
test("major and minor Roman cadences retain their intended qualities", () => {
  assert.deepEqual(names(H.parse("ii7 V7 Imaj7 in G major", A).chords), ["Am7", "D7", "Gmaj7"]);
  assert.deepEqual(names(H.parse("iiø7 V7 i in A minor", G).chords), ["Bm7b5", "E7", "Am"]);
  assert.deepEqual(names(H.parse("♭VII IV I in C major", G).chords), ["Bb", "F", "C"]);
  assert.deepEqual(names(H.parse("V7/V V7 I in C major", G).chords), ["D7", "G7", "C"]);
  assert.deepEqual(names(H.parse("vii°7 i in A minor", G).chords), ["G#dim7", "Am"]);
});
test("numbers choose actual collection sevenths, including natural minor v", () => {
  assert.deepEqual(names(H.parse("2 5 1", G).chords), ["Am7", "D7", "Gmaj7"]);
  assert.deepEqual(names(H.parse("2 5 1", A).chords), ["Bm7b5", "Em7", "Am7"]);
});
test("invalid text rejects the whole candidate instead of silently dropping tokens", () => {
  for (const input of ["", "Am7 nonsense G", "8 5 1", "V7/banana", "<script>", "C/E/G"]) assert.throws(() => H.parse(input, G));
  assert.throws(() => H.parse(Array(129).fill("C").join(" "), G), /128/);
});
test("explicit input key prepares pitches without modifying the analysis key", () => {
  const key = { ...G };
  const result = H.parse("ii7 V7 Imaj7 in F major", key);
  assert.deepEqual(names(result.chords), ["Gm7", "C7", "Fmaj7"]);
  assert.deepEqual(key, G);
  assert.equal(result.explicitKey, true);
});
test("degree labels follow spelling and quality, not stored labels or voicings", () => {
  assert.equal(H.numeral(model("Am7"), G), "ii7");
  assert.equal(H.numeral(model("Am7"), { tonic: "C", mode: "major" }), "vi7");
  assert.equal(H.numeral(model("Fmaj7"), A), "♭VImaj7");
  assert.equal(H.numeral(model("F#m7b5"), G), "viiø7");
  assert.equal(H.numeral({ ...model("D7/F#"), roman: "wrong" }, G), "V7");
});
test("the starting cadence explains preparation, dominant pull, and tonic arrival", () => {
  const [am, d, g] = ["Am7", "D7", "Gmaj7"].map(model);
  assert.equal(H.explain(am, G, null, d).role, "Predominant");
  assert.match(H.explain(am, G, null, d).text, /Here it prepares/);
  assert.equal(H.explain(d, G, am, g).role, "Dominant");
  assert.match(H.explain(d, G, am, g).text, /resolves to the tonic/);
  assert.doesNotMatch(H.explain(d, G, am, g).text, /raised/);
  assert.equal(H.explain(g, G, d).role, "Tonic");
  assert.match(H.explain(g, G, d).text, /preceding dominant/);
});
test("changing the next chord changes the interpretation, not chord identity", () => {
  const d = model("D7");
  assert.match(H.explain(d, G, null, model("Em7")).text, /deceptive/);
  assert.doesNotMatch(H.explain(d, G, null, model("C")).text, /resolves to the tonic/);
  assert.equal(d.name, "D7");
});
test("applied dominants require a plausible target and retain contextual caveats", () => {
  const reading = H.explain(model("A7"), G, null, model("D"));
  assert.equal(reading.role, "Possible applied dominant");
  assert.match(reading.text, /V7\/V/);
  assert.equal(H.explain(model("A7"), G, null, model("Bb")).role, "Dominant color");
  assert.match(H.explain(model("C7"), { tonic: "C", mode: "major" }, null, model("F7")).text, /In blues/);
});
test("minor v is distinct from the raised-leading-tone dominant", () => {
  assert.equal(H.explain(model("Em7"), A).role, "Minor dominant");
  assert.equal(H.explain(model("E7"), A, null, model("Am")).role, "Dominant");
  assert.match(H.explain(model("E7"), A).text, /raised leading tone/);
  assert.deepEqual(json(H.explain(model("E7"), A).outside), [8]);
  assert.equal(H.explain(model("Am7"), A).role, "Tonic");
});
test("borrowed iv and unspecified pitch sets are not forced into false functions", () => {
  assert.equal(H.explain(model("Cm"), G, null, model("D7")).role, "Borrowed predominant");
  const set = M.fromNotes([0, 1, 6]);
  if (!set.detail) assert.equal(H.explain(set, G).role, "Unspecified harmony");
  assert.notEqual(H.explain(model("Gm"), G).role, "Tonic");
});
test("common tones preserve their source spelling and do not claim voice leading", () => {
  assert.deepEqual(json(H.transition(model("C#7"), model("F#7")).common), ["C♯"]);
  assert.equal(H.transition(model("D7"), model("G")).movement, "Up a fourth");
});
test("tendency-tone demonstrations use exact semitone motions into tonic tones", () => {
  const major = H.resolution(model("D7"), G);
  assert.equal(major.label, "F♯ → G · C → B");
  assert.deepEqual(json(major.midis), [
    [66, 60],
    [67, 59],
  ]);
  assert.equal(major.alternative.name, "Em7");
  const minor = H.resolution(model("E7"), A);
  assert.equal(minor.label, "G♯ → A · D → C");
  assert.deepEqual(json(minor.midis), [
    [68, 62],
    [69, 60],
  ]);
  assert.equal(H.resolution(model("Dmaj7"), G), null);
});
test("key palettes are derived from the actual major and minor collections", () => {
  assert.deepEqual(names(H.diatonic(G, "triads")), ["G", "Am", "Bm", "C", "D", "Em", "F#dim"]);
  assert.equal(H.diatonic(A, "triads", "harmonic")[4].name, "E");
  assert.equal(H.diatonic(A, "triads", "melodic")[3].name, "D");
  for (const tonic of H.roots)
    for (const mode of ["major", "minor"]) {
      const key = { tonic, mode };
      for (const collection of ["natural", "harmonic", "melodic"]) {
        assert.equal(H.diatonic(key, "sevenths", collection).length, 7);
        assert.ok(H.diatonic(key, "triads", collection).every((chord) => chord && chord.notes.length === 3));
      }
    }
});
test("the full chord matrix is independent of Stradella and includes minor-major types", () => {
  for (const root of H.roots) {
    const common = H.catalog(root);
    const all = H.catalog(root, true);
    assert.ok(all.length > common.length);
    assert.equal(all.length, T.ChordType.all().length);
    assert.ok(all.some((entry) => /minor\/major|minor major/.test(T.Chord.get(entry.chord.name).type)));
    for (const entry of all) {
      assert.equal(entry.chord.root, T.Note.chroma(root));
      assert.ok(H.families.includes(entry.family));
      assert.ok(H.extensions.includes(entry.extension));
      assert.ok(entry.chord.notes.every((pc) => Number.isInteger(pc) && pc >= 0 && pc < 12));
    }
  }
});
test("note interpretations preserve the selected pitches and explicit bass", () => {
  const choices = H.recognize([4, 7, 0]);
  assert.ok(choices.length);
  assert.ok(choices.some((chord) => chord.name.includes("/E")));
  for (const chord of choices) {
    assert.equal(chord.notes[0], 4);
    assert.deepEqual(
      json(chord.notes).sort((a, b) => a - b),
      [0, 4, 7]
    );
  }
  assert.deepEqual(json(H.recognize([])), []);
  assert.equal(H.recognize([1])[0].notes[0], 1);
});
test("picked interpretations keep the full chosen order, not only the bass", () => {
  const picked = [4, 0, 7];
  for (const chord of H.recognize(picked)) {
    assert.deepEqual(json(chord.notes), picked);
    assert.equal(chord.voicing, "bass-octave");
    assert.deepEqual(
      Array.from(H.voices(chord), (v) => v.midi),
      [64, 72, 67]
    );
  }
  assert.equal(H.pickedChord([]), null);
});
test("all picked pitches stay in one octave above the bass with accurate spelling", () => {
  for (let bass = 0; bass < 12; bass++) {
    const picked = [bass, ...Array.from({ length: 12 }, (_, i) => 11 - i).filter((pc) => pc !== bass)];
    const voices = H.voices(H.pickedChord(picked));
    assert.deepEqual(
      Array.from(voices, (v) => v.pc),
      picked
    );
    for (const voice of voices) {
      assert.ok(voice.midi >= 60 + bass && voice.midi < 72 + bass);
      assert.equal(T.Note.midi(voice.name + voice.octave), voice.midi);
    }
  }
  for (const name of ["C#maj7", "Gbdim7", "B#7", "Cbmaj7"]) {
    for (const voice of H.voices({ ...model(name), voicing: "bass-octave" })) {
      assert.equal(T.Note.midi(voice.name + voice.octave), voice.midi);
    }
  }
});
test("picked edits replace, move and remove without mutating the original set", () => {
  const picked = [4, 0, 7];
  assert.deepEqual(json(H.editPicked(picked, 1, "replace", 2)), [4, 2, 7]);
  assert.deepEqual(json(H.editPicked(picked, 1, "replace", 7)), picked);
  assert.deepEqual(json(H.editPicked(picked, 0, "move", 1)), [0, 4, 7]);
  assert.deepEqual(json(H.editPicked(picked, 2, "move", -1)), [4, 7, 0]);
  assert.deepEqual(json(H.editPicked(picked, 0, "remove")), [0, 7]);
  assert.deepEqual(json(H.editPicked([4], 0, "remove")), []);
  for (const [index, action, value] of [
    [-1, "remove"],
    [3, "remove"],
    [0, "move", -1],
    [2, "move", 1],
    [1, "replace", 12],
  ]) {
    assert.deepEqual(json(H.editPicked(picked, index, action, value)), picked);
  }
  assert.deepEqual(picked, [4, 0, 7]);
});
test("ordinary chord voicings remain unchanged", () => {
  for (const name of ["C", "D7", "C/E", "C#maj7", "Gbdim7"]) {
    const chord = model(name);
    assert.deepEqual(json(H.voices(chord)), json(M.voices(chord)));
  }
});
test("picked order and voicing survive insert, transpose, undo and redo", () => {
  const doc = H.createDocument();
  const chord = H.recognize([4, 0, 7]).find((item) => item.root === 0);
  assert.ok(chord);
  doc.commit([chord], "insert");
  const inserted = json(doc.state);
  doc.transpose("A");
  const transposed = json(doc.state);
  const result = doc.state.chords[doc.state.selected];
  assert.equal(result.name, "DM/F#");
  assert.deepEqual(json(result.notes), [6, 2, 9]);
  assert.deepEqual(
    Array.from(H.voices(result), (v) => v.midi),
    [66, 74, 69]
  );
  doc.undo();
  assert.deepEqual(json(doc.state), inserted);
  doc.redo();
  assert.deepEqual(json(doc.state), transposed);
  assert.deepEqual(json(chord.notes), [4, 0, 7]);
});
test("unnamed picked sets retain their order and bounded voicing when transposed", () => {
  const chord = H.recognize([4, 3, 2, 1, 0])[0];
  assert.equal(chord.detail, null);
  const doc = H.createDocument();
  doc.commit([chord], "replace");
  doc.transpose("A");
  const result = doc.state.chords[doc.state.selected];
  assert.deepEqual(json(result.notes), [6, 5, 4, 3, 2]);
  assert.equal(result.voicing, "bass-octave");
  assert.deepEqual(
    Array.from(H.voices(result), (v) => v.midi),
    [66, 77, 76, 75, 74]
  );
});
test("transition suggestions keep common tones and slash-bass pitches honest", () => {
  const am = model("Am7");
  const related = H.related(am, G, "common");
  const counts = related.map((item) => H.transition(am, item).common.length);
  assert.ok(counts.every((n) => n > 0));
  assert.deepEqual(
    Array.from(counts),
    Array.from(counts).sort((a, b) => b - a)
  );
  const basses = H.related(am, G, "bass");
  assert.deepEqual(
    Array.from(basses, (chord) => chord.notes[0]),
    [7, 8, 10, 11]
  );
  assert.ok(basses.every((chord) => am.notes.every((pc) => chord.notes.includes(pc))));
});
test("every pattern resolves to valid pitches in every offered key", () => {
  for (const tonic of H.roots)
    for (const mode of ["major", "minor"]) {
      const patterns = H.patterns({ tonic, mode });
      assert.equal(patterns.length, 6);
      assert.ok(patterns.every((pattern) => pattern.chords.every((chord) => chord && chord.notes.length >= 3)));
      assert.equal(patterns.find((p) => p.id === "blues").chords.length, 12);
    }
});
test("selecting and choosing a gap are not edits", () => {
  const doc = H.createDocument();
  const before = names(doc.state.chords);
  doc.select(0);
  doc.setGap(1);
  assert.deepEqual(names(doc.state.chords), before);
  assert.equal(doc.canUndo, false);
});
test("insertion uses the chosen gap and snapshots are not aliases of the candidate", () => {
  const doc = H.createDocument(),
    chord = model("C");
  doc.setGap(1);
  assert.equal(doc.commit([chord], "insert"), true);
  chord.name = "changed outside";
  assert.deepEqual(names(doc.state.chords), ["Am7", "C", "D7", "Gmaj7"]);
  assert.equal(doc.state.selected, 1);
  assert.equal(doc.state.gap, 2);
});
test("replace affects one step and rejects phrases without changing history", () => {
  const doc = H.createDocument();
  assert.equal(doc.commit([model("C"), model("F")], "replace"), false);
  assert.equal(doc.canUndo, false);
  assert.equal(doc.commit([model("Em7")], "replace"), true);
  assert.deepEqual(names(doc.state.chords), ["Am7", "Em7", "Gmaj7"]);
});
test("candidate auditions have the correct neighbors for insert and replace", () => {
  const doc = H.createDocument(),
    candidate = [model("C")];
  assert.deepEqual(names(H.context(doc.state, candidate, "insert")), ["D7", "C", "Gmaj7"]);
  assert.deepEqual(names(H.context(doc.state, candidate, "replace")), ["Am7", "C", "Gmaj7"]);
  doc.setGap(0);
  assert.deepEqual(names(H.context(doc.state, candidate, "insert")), ["C", "Am7"]);
  doc.setGap(3);
  assert.deepEqual(names(H.context(doc.state, candidate, "insert")), ["Gmaj7", "C"]);
});
test("analysis key changes do not transpose notes; explicit transpose does", () => {
  const doc = H.createDocument();
  const before = json(doc.state.chords);
  doc.analyze({ tonic: "C", mode: "minor" });
  assert.deepEqual(json(doc.state.chords), before);
  doc.undo();
  doc.transpose("A");
  assert.deepEqual(names(doc.state.chords), ["Bm7", "E7", "Amaj7"]);
  assert.equal(doc.state.key.tonic, "A");
});
test("transposition preserves slash bass and enharmonic spelling", () => {
  const doc = H.createDocument();
  doc.commit([model("D7/F#")], "replace");
  doc.transpose("Ab");
  assert.equal(doc.state.chords[1].root, 3);
  assert.equal(doc.state.chords[1].notes[0], 7);
  assert.equal(doc.state.chords[1].name, "Eb7/G");
});
test("undo and redo restore notes, key, selection, gap and remove redo on a new edit", () => {
  const doc = H.createDocument(),
    before = json(doc.state);
  doc.commit([model("C")], "insert");
  const inserted = json(doc.state);
  doc.move(-1);
  doc.remove();
  doc.analyze(A);
  doc.undo();
  doc.undo();
  doc.undo();
  assert.deepEqual(json(doc.state), inserted);
  doc.undo();
  assert.deepEqual(json(doc.state), before);
  doc.redo();
  assert.deepEqual(json(doc.state), inserted);
  doc.undo();
  doc.commit([model("F")], "insert");
  assert.equal(doc.canRedo, false);
});
test("empty state and the 128-chord bound never leave invalid selection positions", () => {
  const doc = H.createDocument();
  while (doc.state.chords.length) doc.remove();
  assert.equal(doc.state.selected, 0);
  assert.equal(doc.state.gap, 0);
  assert.equal(doc.commit([model("C")], "replace"), false);
  assert.equal(
    doc.commit(
      Array.from({ length: 128 }, () => model("C")),
      "insert"
    ),
    true
  );
  assert.equal(doc.commit([model("D")], "insert"), false);
  doc.undo();
  assert.equal(doc.state.chords.length, 0);
});
console.log(count + " progression composer tests passed");
