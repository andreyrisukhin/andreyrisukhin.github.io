#!/usr/bin/env node
// A small DOM fixture keeps the MusicXML model testable without a browser dependency.
const assert = require("node:assert/strict");
const Model = require("../assets/js/sheet-music/correction-model.js");
class Element {
  constructor(name, content = "", attributes = {}) {
    this.localName = name;
    this.namespaceURI = null;
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this._text = "";
    if (Array.isArray(content)) content.forEach((node) => this.appendChild(node));
    else this._text = String(content);
  }
  get textContent() {
    return this.children.length ? this.children.map((node) => node.textContent).join("") : this._text;
  }
  set textContent(value) {
    this.children.forEach((node) => {
      node.parentNode = null;
    });
    this.children = [];
    this._text = String(value);
  }
  get nextSibling() {
    return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null;
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  getAttributeNames() {
    return Object.keys(this.attributes);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  appendChild(node) {
    return this.insertBefore(node, null);
  }
  insertBefore(node, before) {
    if (before && before.parentNode !== this) throw new Error("Invalid insertion anchor");
    node.remove();
    node.parentNode = this;
    node.bind(this.ownerDocument);
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
    return node;
  }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  bind(doc) {
    this.ownerDocument = doc;
    this.children.forEach((node) => node.bind(doc));
  }
  cloneNode() {
    return new Element(this.localName, this.children.length ? this.children.map((node) => node.cloneNode()) : this._text, this.attributes);
  }
  getElementsByTagName(name) {
    return this.children.flatMap((node) => [...(node.localName === name ? [node] : []), ...node.getElementsByTagName(name)]);
  }
}
class Document {
  constructor(root) {
    this.documentElement = root;
    root.bind(this);
  }
  cloneNode() {
    return new Document(this.documentElement.cloneNode());
  }
  createElementNS(_, name) {
    const node = new Element(name);
    node.bind(this);
    return node;
  }
}
const e = (name, content, attrs) => new Element(name, content, attrs);
const note = (step, octave, duration, voice = 1, staff = 1, extras = []) =>
  e("note", [
    ...(step ? [e("pitch", [e("step", step), e("octave", octave)])] : [e("rest")]),
    e("duration", duration),
    e("voice", voice),
    e("type", "quarter"),
    e("staff", staff),
    ...extras,
  ]);
const doc = (...measures) => new Document(e("score-partwise", [e("part", measures, { id: "P1" })]));
const measure = (...nodes) => e("measure", nodes);
const attrs = () => e("attributes", [e("divisions", 4)]);
const first = { partIndex: 0, measureIndex: 0, noteIndex: 0 };
const at = (index, measureIndex = 0) => ({ ...first, noteIndex: index, measureIndex });
const fixture = () => {
  const chord = note("E", 4, 4);
  chord.insertBefore(e("chord"), chord.children[0]);
  return doc(
    measure(
      attrs(),
      note("C", 4, 4, 1, 1, [e("lyric", [e("text", "Keep this lyric")])]),
      chord,
      note("D", 4, 4),
      note(null, 0, 8),
      e("backup", [e("duration", 16)]),
      note("C", 3, 16, 2, 2),
      e("barline", [e("bar-style", "light-heavy")])
    )
  );
};
let checks = 0;
function test(name, run) {
  run();
  checks++;
  console.log("ok - " + name);
}
test("Index distinguishes chords, voices, staves, and backup positions", () => {
  const entries = Model.index(fixture());
  assert.deepEqual(
    entries.map((n) => [n.onset, n.staff, n.voice]),
    [
      [0, "1", "1"],
      [0, "1", "1"],
      [1, "1", "1"],
      [2, "1", "1"],
      [0, "2", "2"],
    ]
  );
});
test("Pitch corrections change one chord tone, not the whole stack or another staff", () => {
  const original = fixture(),
    updated = Model.apply(original, at(1), { pitch: { step: "F", alter: 1, octave: 5 } });
  assert.deepEqual(
    Model.index(updated).map((n) => Model.label(n.pitch)),
    ["C4", "F♯5", "D4", "Rest", "C3"]
  );
  assert.equal(Model.describe(original, at(1)).pitch.step, "E");
});
test("Pitch edits preserve lyrics, barlines, and unrelated XML", () => {
  const original = fixture(),
    updated = Model.apply(original, first, { pitch: { step: "B", alter: -1, octave: 4 } });
  assert.equal(updated.documentElement.getElementsByTagName("text")[0].textContent, "Keep this lyric");
  assert.equal(updated.documentElement.getElementsByTagName("bar-style")[0].textContent, "light-heavy");
  const node = Model.index(updated)[0].node;
  assert.deepEqual(
    node.children.map((n) => n.localName),
    ["pitch", "duration", "voice", "type", "staff", "lyric"]
  );
  assert.deepEqual(
    node.children[0].children.map((n) => n.localName),
    ["step", "alter", "octave"]
  );
});
test("Natural corrections remove the old alteration and let notation compute the necessary symbol", () => {
  const sharp = Model.apply(fixture(), first, { pitch: { step: "C", alter: 1, octave: 4 } });
  const natural = Model.apply(sharp, first, { pitch: { step: "C", alter: 0, octave: 4 } });
  const node = Model.index(natural)[0].node;
  assert.equal(node.children[0].getElementsByTagName("alter").length, 0);
  assert.equal(node.getElementsByTagName("accidental").length, 0);
});
test("No-op edits return no revision", () => {
  assert.equal(Model.apply(fixture(), first, { pitch: { step: "C", alter: 0, octave: 4 }, type: "quarter", dots: 0 }), null);
});
test("Invalid pitches and octaves are rejected without modifying the source", () => {
  for (const pitch of [
    { step: "H", alter: 0, octave: 4 },
    { step: "C", alter: 3, octave: 4 },
    { step: "C", alter: 0, octave: 10 },
  ]) {
    assert.throws(() => Model.apply(fixture(), first, { pitch }), /valid pitch/);
  }
});
test("Shortening a chord shifts later notes in its voice and pads trailing rests", () => {
  const updated = Model.apply(fixture(), first, { type: "eighth", dots: 0 }),
    entries = Model.index(updated);
  assert.equal(entries[0].duration, 0.5);
  assert.equal(entries[1].duration, 0.5);
  assert.equal(entries.find((n) => n.pitch?.step === "D").onset, 0.5);
  assert.equal(
    entries.filter((n) => n.staff === "1").reduce((sum, n) => sum + (n.node.getElementsByTagName("chord").length ? 0 : n.duration), 0),
    4
  );
  assert.equal(entries.find((n) => n.staff === "2").onset, 0);
  assert.equal(updated.documentElement.getElementsByTagName("backup")[0].textContent, "16");
});
test("Lengthening consumes only trailing rests and keeps other voices in place", () => {
  const entries = Model.index(Model.apply(fixture(), first, { type: "half", dots: 0 }));
  assert.equal(entries.find((n) => n.pitch?.step === "D").onset, 2);
  assert.equal(entries.find((n) => !n.pitch).duration, 1);
  assert.equal(entries.find((n) => n.staff === "2").duration, 4);
});
test("Measure overfill is rejected rather than corrupting voice backups", () => {
  const original = fixture();
  assert.throws(() => Model.apply(original, first, { type: "whole", dots: 0 }), /Not enough trailing rest/);
  assert.equal(Model.index(original)[0].duration, 1);
});
test("Dots update both written value and timing", () => {
  const node = Model.index(Model.apply(fixture(), first, { type: "quarter", dots: 1 }))[0];
  assert.equal(node.duration, 1.5);
  assert.equal(node.node.getElementsByTagName("dot").length, 1);
  assert.equal(Model.beats("half", 2), 3.5);
  assert.throws(() => Model.beats("quarter", 3), /zero to two/);
});
const tied = () =>
  doc(
    measure(attrs(), note("C", 4, 16, 1, 1, [e("tie", "", { type: "start" }), e("notations", [e("tied", "", { type: "start" })])])),
    measure(note("C", 4, 16, 1, 1, [e("tie", "", { type: "stop" }), e("notations", [e("tied", "", { type: "stop" })])]))
  );
test("Editing either end of a tie updates the complete chain", () => {
  const updated = Model.apply(tied(), at(0, 1), { pitch: { step: "D", alter: -1, octave: 5 } });
  assert.deepEqual(
    Model.index(updated).map((n) => Model.label(n.pitch)),
    ["D♭5", "D♭5"]
  );
  assert.equal(updated.documentElement.getElementsByTagName("tied").length, 2);
});
test("Tie rhythms stay protected", () => {
  assert.match(Model.describe(tied(), first).rhythmReason, /Tied/);
  assert.throws(() => Model.apply(tied(), first, { type: "half", dots: 0 }), /Tied/);
});
test("Unmatched ties do not make partial pitch edits", () => {
  const broken = doc(measure(attrs(), note("C", 4, 4, 1, 1, [e("tie", "", { type: "stop" })])));
  assert.throws(() => Model.apply(broken, first, { pitch: { step: "D", alter: 0, octave: 4 } }), /matched safely/);
});
test("Tuplet rhythms are protected while their pitches remain editable", () => {
  const original = doc(measure(attrs(), note("C", 4, 4, 1, 1, [e("time-modification", [e("actual-notes", 3), e("normal-notes", 2)])])));
  assert.match(Model.describe(original, first).rhythmReason, /Tuplet/);
  const updated = Model.apply(original, first, { pitch: { step: "D", alter: 0, octave: 4 } });
  assert.equal(updated.documentElement.getElementsByTagName("actual-notes")[0].textContent, "3");
});
test("Grace-note pitches are editable but grace timing is protected", () => {
  const grace = note("C", 4, 0);
  grace.insertBefore(e("grace"), grace.children[0]);
  const original = doc(measure(attrs(), grace, note("D", 4, 4)));
  assert.equal(Model.index(original)[1].onset, 0);
  assert.match(Model.describe(original, first).rhythmReason, /Grace/);
  assert.equal(Model.describe(Model.apply(original, first, { pitch: { step: "E", alter: 0, octave: 4 } }), first).pitch.step, "E");
});
test("Rhythm corrections drop stale beam instructions", () => {
  const original = fixture();
  Model.index(original)[0].node.appendChild(e("beam", "begin"));
  const updated = Model.apply(original, first, { type: "eighth", dots: 0 });
  assert.equal(updated.documentElement.getElementsByTagName("beam").length, 0);
});
test("Invalid note addresses fail safely", () => {
  assert.throws(() => Model.describe(fixture(), at(99)), /no longer/);
});
test("Annotated and hidden rests are not discarded to pad a rhythm correction", () => {
  for (const kind of ["notation", "hidden", "display-position"]) {
    const original = fixture(),
      rest = Model.index(original)[3].node;
    if (kind === "notation") rest.appendChild(e("notations", [e("fermata")]));
    if (kind === "hidden") rest.setAttribute("print-object", "no");
    if (kind === "display-position") rest.children[0].appendChild(e("display-step", "B"));
    assert.match(Model.describe(original, first).rhythmReason, /rests/);
    assert.throws(() => Model.apply(original, first, { type: "eighth", dots: 0 }), /rests/);
    const updated = Model.apply(original, first, { pitch: { step: "D", alter: 0, octave: 4 } });
    assert.equal(Model.index(updated)[3].node.getAttribute("print-object"), rest.getAttribute("print-object"));
    assert.deepEqual(
      Model.index(updated)[3].node.children.map((node) => node.localName),
      rest.children.map((node) => node.localName)
    );
  }
});
test("Explicit rhythm correction repairs mismatched written type and duration", () => {
  const original = fixture();
  Model.index(original)[0].node.children.find((node) => node.localName === "type").textContent = "eighth";
  Model.index(original)[1].node.children.find((node) => node.localName === "type").textContent = "eighth";
  assert.equal(Model.index(Model.apply(original, first, { type: "eighth", dots: 0 }))[0].duration, 0.5);
});
test("Invalid note values and extreme accidentals remain bounded", () => {
  assert.throws(() => Model.beats("constructor", 0), /supported/);
  assert.equal(Model.label({ step: "C", alter: 10000000, octave: 4 }), "C(10000000)4");
});
test("OSMD mapping uses part, measure, voice, staff, onset, and written pitch", () => {
  const instrument = { IdString: "P1", Staves: [] };
  const staff = { ParentInstrument: instrument };
  instrument.Staves.push(staff);
  const source = { Pitch: { FundamentalNote: 0, AccidentalHalfTones: 0, Octave: 1 } };
  const osmd = {
    Sheet: {
      SourceMeasures: [
        {
          VerticalSourceStaffEntryContainers: [
            { Timestamp: { RealValue: 0 }, StaffEntries: [{ ParentStaff: staff, VoiceEntries: [{ ParentVoice: { VoiceId: 1 }, Notes: [source] }] }] },
          ],
        },
      ],
    },
  };
  assert.deepEqual(Model.mapNotes(osmd, fixture()).get(source), first);
  assert.equal(Model.mapNotes(osmd, doc(measure(attrs(), note("D", 4, 4)))).get(source), undefined);
  const ambiguous = doc(measure(attrs(), note("C", 4, 4), note("C", 4, 4, 1, 1, [e("chord")])));
  assert.equal(Model.mapNotes(osmd, ambiguous).get(source), undefined);
});
test("Scale steps use the active key, wrap octaves, and keep pitch alterations", () => {
  const source = doc(measure(e("attributes", [e("divisions", 4), e("key", [e("fifths", 4)])]), note("B", 3, 4), note("D", 4, 4)));
  assert.deepEqual(Model.stepPitch(source, first, -1), { step: "A", alter: 0, octave: 3 });
  assert.deepEqual(Model.stepPitch(source, at(1), -1), { step: "C", alter: 1, octave: 4 });
  assert.deepEqual(Model.stepPitch(source, first, 1), { step: "C", alter: 1, octave: 4 });
  const changed = Model.apply(source, at(1), { pitch: Model.stepPitch(source, at(1), -1) });
  assert.equal(Model.index(changed)[1].pitch.alter, 1);
  assert.equal(Model.index(changed)[1].node.getElementsByTagName("accidental").length, 0);
});
test("Scale stepping follows later and staff-specific keys", () => {
  const source = doc(
    measure(attrs(), note("B", 4, 4)),
    measure(e("attributes", [e("key", [e("fifths", -2)]), e("key", [e("fifths", 4)], { number: "2" })]), note("A", 4, 4), note("B", 3, 4, 2, 2))
  );
  assert.deepEqual(Model.stepPitch(source, at(0, 1), 1), { step: "B", alter: -1, octave: 4 });
  assert.deepEqual(Model.stepPitch(source, at(1, 1), 1), { step: "C", alter: 1, octave: 4 });
});
test("Chromatic and octave modifiers preserve their promised intervals", () => {
  const source = fixture();
  assert.equal(Model.midi(Model.stepPitch(source, first, 1, "chromatic")), 61);
  assert.equal(Model.midi(Model.stepPitch(source, first, -1, "chromatic")), 59);
  assert.equal(Model.midi(Model.stepPitch(source, first, 1, "octave")), 72);
});
test("Courtesy symbols are explicit, reversible, and do not change pitch", () => {
  const forced = Model.apply(fixture(), first, { accidental: "show" });
  assert.equal(Model.index(forced)[0].node.getElementsByTagName("accidental")[0].getAttribute("cautionary"), "yes");
  const auto = Model.apply(forced, first, { accidental: "auto" });
  assert.deepEqual(Model.describe(auto, first).pitch, { step: "C", alter: 0, octave: 4 });
  assert.equal(Model.index(auto)[0].node.getElementsByTagName("accidental").length, 0);
});
test("Automatic display preserves other voices, courtesy marks, and key XML", () => {
  const source = fixture();
  Model.index(source)[2].node.appendChild(e("accidental", "natural", { cautionary: "yes" }));
  const changed = Model.apply(source, first, { pitch: { step: "D", alter: 1, octave: 4 } });
  assert.equal(Model.index(changed)[2].node.getElementsByTagName("accidental")[0].getAttribute("cautionary"), "yes");
  assert.equal(Model.index(changed)[0].pitch.alter, 1);
});
test("The form cannot accept pitches the player would silently drop", () => {
  assert.throws(() => Model.apply(fixture(), first, { pitch: { step: "B", alter: 0, octave: 9 } }), /playable pitch/);
  assert.equal(Model.midi(Model.describe(Model.apply(fixture(), first, { pitch: { step: "G", alter: 0, octave: 9 } }), first).pitch), 127);
});
test("Rhythm preview identifies later groups and concrete rest padding", () => {
  const preview = Model.rhythmImpact(fixture(), first, "eighth", 0);
  assert.match(preview, /D4/);
  assert.match(preview, /earlier by 0.5/);
  assert.match(preview, /2 → 2.5/);
});
test("A courtesy symbol is local even when the pitch change follows a complete tie", () => {
  const updated = Model.apply(tied(), at(0, 1), { pitch: { step: "D", alter: 1, octave: 4 }, accidental: "show" });
  assert.deepEqual(
    Model.index(updated).map((e) => e.pitch.alter),
    [1, 1]
  );
  assert.equal(Model.index(updated)[0].node.getElementsByTagName("accidental").length, 0);
  assert.equal(Model.index(updated)[1].node.getElementsByTagName("accidental")[0].getAttribute("cautionary"), "yes");
});
test("Extended key signatures retain their double alterations", () => {
  const source = doc(measure(e("attributes", [e("key", [e("fifths", 8)])]), note("E", 4, 4)));
  assert.deepEqual(Model.stepPitch(source, first, 1), { step: "F", alter: 2, octave: 4 });
});
console.log(`${checks} MusicXML correction model checks passed`);
