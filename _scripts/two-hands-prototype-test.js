#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const context = {
  document: {
    createElement: () => ({
      set textContent(value) {
        this.innerHTML = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      },
    }),
  },
};
context.window = context;
context.self = context;
vm.createContext(context);
[
  "assets/js/vendor/tonal.min.js",
  "assets/js/music/common.js",
  "assets/js/music/chord-name.js",
  "assets/js/music/stradella-data.js",
  "assets/js/workbench/model.js",
  "_prototypes/two-hands/stradella.js",
  "_prototypes/two-hands/voicings.js",
  "_prototypes/two-hands/inspector.js",
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context));
const Left = context.PrototypeStradella;
const Model = context.WorkbenchModel;
const Hands = context.PrototypeHandInspector;
const Voicings = context.PrototypeVoicings;
const json = (value) => JSON.parse(JSON.stringify(value));
const cells = json(Left.layout());
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
test("six function columns and four fifth-related rows have unique coordinates", () => {
  assert.equal(cells.length, 24);
  assert.equal(new Set(cells.map((cell) => cell.id)).size, 24);
  assert.equal(new Set(cells.map((cell) => cell.row + ":" + cell.column)).size, 24);
  const roots = json(Left.roots);
  assert.deepEqual(roots, [9, 2, 7, 0]);
  roots.slice(1).forEach((pc, i) => assert.equal((roots[i] - pc + 12) % 12, 7));
  assert.deepEqual(
    json(Left.columns).map((column) => column.id),
    ["d7", "7", "m", "M", "bass", "counter"]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.column),
    [5, 5, 5, 5]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "bass").map((cell) => cell.column),
    [4, 4, 4, 4]
  );
});
test("counterbass is a correctly spelled major third above the bass", () => {
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.notes[0]),
    [1, 6, 11, 4]
  );
  assert.deepEqual(
    cells.filter((cell) => cell.kind === "counter").map((cell) => cell.label),
    ["C♯", "F♯", "B", "E"]
  );
});
test("all chord columns use shared Stradella button voicings", () => {
  cells
    .filter((cell) => cell.kind !== "bass" && cell.kind !== "counter")
    .forEach((cell) => {
      const quality = cell.kind;
      assert.deepEqual(
        cell.notes,
        json(context.StradellaData.BUTTONS[quality]).map((pc) => (pc + cell.root) % 12)
      );
    });
});
test("seventh and diminished tones retain harmonic spellings", () => {
  const expected = {
    "7-9": ["A", "C#", "G"],
    "7-2": ["D", "F#", "C"],
    "7-7": ["G", "B", "F"],
    "7-0": ["C", "E", "Bb"],
    "d7-9": ["A", "C", "Gb"],
    "d7-2": ["D", "F", "Cb"],
    "d7-7": ["G", "Bb", "Fb"],
    "d7-0": ["C", "Eb", "Bbb"],
  };
  Object.entries(expected).forEach(([id, names]) => {
    const cell = cells.find((item) => item.id === id);
    assert.deepEqual(cell.spellings, names);
    assert.deepEqual(cell.spellings.map(context.Tonal.Note.chroma), cell.notes);
  });
});
test("button notation contains every tone with its own spelling and interval", () => {
  cells.forEach((cell) => {
    const inspection = Hands.inspectionModel(cell);
    const voices = json(Model.voices(inspection));
    assert.deepEqual(
      voices.map((v) => v.pc),
      cell.notes
    );
    assert.deepEqual(
      voices.map((v) => v.name),
      cell.spellings
    );
    voices.forEach((v) => assert.equal(context.Tonal.Note.midi(v.name + v.octave), v.midi));
  });
  assert.deepEqual(cells.find((cell) => cell.id === "7-9").intervals, ["1", "3", "♭7"]);
  assert.deepEqual(cells.find((cell) => cell.id === "d7-0").intervals, ["1", "♭3", "𝄫7"]);
});
test("both-hand audio preserves the selected Am7 recipe and right-hand voicing", () => {
  assert.deepEqual(json(Hands.performance(Model.fromName("Am7"))), {
    midis: [45, 48, 52, 55, 69, 72, 76, 79],
    leftIds: ["bass-9", "M-0"],
    rightMidis: [69, 72, 76, 79],
  });
});
test("the fixed progression excerpt contains every conventional recipe", () => {
  const roots = [11, 4, 9, 2, 7, 0];
  const layout = json(Left.layout(roots));
  assert.equal(layout.length, 36);
  const expected = [
    { name: "Am7", ids: ["bass-9", "M-0"], midis: [45, 48, 52, 55, 69, 72, 76, 79] },
    { name: "D7", ids: ["bass-2", "7-2"], midis: [38, 48, 50, 54, 62, 66, 69, 72] },
    { name: "Gmaj7", ids: ["bass-7", "m-11"], midis: [43, 50, 54, 59, 67, 71, 74, 78] },
  ];
  expected.forEach(({ name, ids, midis }) => {
    const model = Model.fromName(name);
    assert.deepEqual(json(Left.selected(model, roots)), ids);
    assert.deepEqual(json(Hands.performance(model, roots)).midis, midis);
    const actual = [...new Set(ids.flatMap((id) => layout.find((cell) => cell.id === id).notes))].sort((a, b) => a - b);
    const missing = json(Voicings.resolve(model, roots).missing);
    assert.deepEqual(
      [...actual, ...missing].sort((a, b) => a - b),
      json(model.notes).sort((a, b) => a - b)
    );
  });
  roots.forEach((root, row) => assert.equal(layout.find((cell) => cell.id === "bass-" + root).row, row));
});
test("D7 defaults to its seventh button and exposes the full-pitch alternative", () => {
  const model = Model.fromName("D7"),
    roots = [11, 4, 9, 2, 7, 0];
  const standard = json(Voicings.resolve(model, roots));
  assert.deepEqual(standard.leftIds, ["bass-2", "7-2"]);
  assert.deepEqual(standard.missing, [9]);
  assert.equal(standard.omittedFifth, true);
  assert.match(standard.detail, /A \(fifth\) omitted, standard Stradella/);
  const full = json(Voicings.resolve(model, roots, { voicing: "catalog-7", bass: 2 }));
  assert.deepEqual(full.leftIds, ["bass-2", "d7-9"]);
  assert.deepEqual(full.missing, []);
  assert.deepEqual(full.midis, [38, 48, 54, 57]);
});
test("all dominant seventh defaults transpose as root-third-seventh buttons", () => {
  const roots = Array.from({ length: 12 }, (_, i) => i);
  roots.forEach((root) => {
    const model = Model.fromName(context.Music.asciiNoteName(root) + "7");
    const result = json(Voicings.resolve(model, roots));
    assert.deepEqual(result.leftIds, ["bass-" + root, "7-" + root]);
    assert.deepEqual(result.missing, [(root + 7) % 12]);
    assert.equal(result.omittedFifth, true);
  });
});
test("inversions use actual bass or counterbass buttons and retain right-hand MIDI", () => {
  const model = Model.fromName("D7"),
    roots = [11, 4, 9, 2, 7, 0];
  const cases = [
    [2, "bass-2", 38],
    [6, "counter-2", 42],
    [9, "bass-9", 45],
    [0, "bass-0", 36],
  ];
  cases.forEach(([bass, id, midi]) => {
    const choice = { voicing: "standard", bass };
    const sound = json(Hands.performance(model, roots, choice));
    assert.equal(sound.leftIds[0], id);
    assert.equal(sound.midis[0], midi);
    assert.deepEqual(sound.rightMidis, [62, 66, 69, 72]);
    assert.ok(sound.midis.slice(1).every((note) => note > midi));
  });
});
test("stacked voicings deduplicate shared reeds without dropping chord tones", () => {
  const model = Model.fromName("Am7");
  const choice = json(Voicings.resolve(model, Left.roots, { voicing: "stacked", bass: 9 }));
  assert.deepEqual(choice.leftIds, ["bass-9", "m-9", "M-0"]);
  assert.deepEqual(choice.midis, [45, 48, 52, 57, 55]);
  assert.equal(new Set(choice.midis).size, choice.midis.length);
  assert.deepEqual(choice.missing, []);
});
test("incomplete left voicings disclose the notes supplied by the unchanged right hand", () => {
  const choice = json(Voicings.resolve(Model.fromName("Gmaj7"), [11, 4, 9, 2, 7, 0], { voicing: "catalog-maj7", bass: 11 }));
  assert.deepEqual(choice.missing, [7]);
  assert.match(choice.detail, /G supplied by the right hand/);
});
test("unavailable choices and non-chord bass notes fail closed", () => {
  const model = Model.fromName("Gmaj7");
  assert.equal(Voicings.resolve(model, Left.roots), null);
  assert.ok(json(Voicings.options(model, Left.roots)).every((option) => !option.available));
  assert.equal(Voicings.resolve(Model.fromName("D7"), Left.roots, { voicing: "standard", bass: 1 }), null);
  assert.equal(Voicings.resolve(Model.fromName("D7"), Left.roots, { voicing: "made-up", bass: 2 }), null);
});
test("every offered voicing and inversion stays within the selected harmony", () => {
  const roots = [11, 4, 9, 2, 7, 0];
  ["Am7", "D7", "Gmaj7"].forEach((name) => {
    const model = Model.fromName(name);
    Voicings.basses(model, roots)
      .filter((bass) => bass.available)
      .forEach((bass) => {
        Voicings.options(model, roots, bass.pc)
          .filter((option) => option.available)
          .forEach((option) => {
            const choice = Voicings.resolve(model, roots, { voicing: option.id, bass: bass.pc });
            assert.ok(choice.notes.every((pc) => model.notes.includes(pc)));
            assert.equal(choice.midis[0] % 12, bass.pc);
          });
      });
  });
});
test("notation preserves spellings and octave accuracy throughout the extended range", () => {
  Left.layout([11, 4, 9, 2, 7, 0]).forEach((cell) => {
    Model.voices(Hands.inspectionModel(cell)).forEach((voice, i) => {
      assert.equal(context.Tonal.Note.chroma(cell.spellings[i]), cell.notes[i]);
      assert.equal(context.Tonal.Note.midi(voice.name + voice.octave), voice.midi);
    });
  });
});
test("arrow navigation follows the reflected visual coordinates", () => {
  const listeners = {};
  let focused = null;
  const container = {
    addEventListener: (event, fn) => {
      listeners[event] = fn;
    },
    contains: () => true,
    querySelector: (selector) => ({
      focus: () => {
        focused = selector.match(/data-left-id="([^"]+)"/)[1];
      },
    }),
  };
  Left.bind(container, { onActivate: () => {} });
  function move(id, key) {
    focused = null;
    listeners.keydown({
      key,
      target: { closest: () => ({ dataset: { leftId: id } }) },
      preventDefault: () => {},
    });
    return focused;
  }
  assert.equal(move("bass-7", "ArrowRight"), "counter-7");
  assert.equal(move("bass-7", "ArrowLeft"), "M-7");
  assert.equal(move("bass-7", "ArrowUp"), "bass-2");
  assert.equal(move("bass-7", "ArrowDown"), "bass-0");
  assert.equal(move("counter-7", "ArrowRight"), null);
  assert.equal(move("d7-7", "ArrowLeft"), null);
  assert.equal(move("bass-9", "ArrowUp"), null);
  assert.equal(move("bass-0", "ArrowDown"), null);
});
test("Am7 selects A bass and C major with no extra or missing tones", () => {
  const selected = json(Left.selected(Model.fromName("Am7")));
  assert.deepEqual(selected, ["bass-9", "M-0"]);
  assert.deepEqual(
    [...new Set(cells.filter((cell) => selected.includes(cell.id)).flatMap((cell) => cell.notes))].sort((a, b) => a - b),
    [0, 4, 7, 9]
  );
});
test("demonstration audio retains every button pitch class", () => {
  cells.forEach((cell) => {
    assert.deepEqual(
      cell.midis.map((midi) => midi % 12).sort((a, b) => a - b),
      [...cell.notes].sort((a, b) => a - b)
    );
    assert.ok(cell.midis.every((midi) => midi >= 36 && midi < 60));
  });
});
test("recipes outside the schematic are not silently partially selected", () => {
  assert.deepEqual(json(Left.selected(Model.fromName("Bbm7"))), []);
});
test("markup distinguishes selected recipe buttons and the root bass", () => {
  const container = {};
  Left.mount(container, Model.fromName("Am7"));
  assert.equal((container.innerHTML.match(/class="hand-key/g) || []).length, 24);
  assert.equal((container.innerHTML.match(/ is-selected/g) || []).length, 2);
  assert.equal((container.innerHTML.match(/ is-root/g) || []).length, 1);
  assert.match(container.innerHTML, /aria-label="Hear A bass" aria-description="Chord root\./);
});
console.log(count + " two-hand prototype tests passed");
