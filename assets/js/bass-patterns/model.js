window.BassPatterns = (function () {
  "use strict";
  const kinds = ["bass", "counter", "M", "m", "7", "d7"];
  const durations = [
    [48, "Whole"],
    [36, "Dotted half"],
    [24, "Half"],
    [18, "Dotted quarter"],
    [12, "Quarter"],
    [9, "Dotted eighth"],
    [6, "Eighth"],
    [3, "Sixteenth"],
  ];
  const buttons = window.WorkbenchStradella.layout(Array.from({ length: 12 }, (_, i) => i));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function requireValue(ok, message) {
    if (!ok) throw new Error(message);
  }
  function validate(value) {
    requireValue(value && value.version === 1, "Unsupported pattern version.");
    requireValue(typeof value.title === "string" && value.title.length <= 80, "Use a title of at most 80 characters.");
    requireValue(
      Array.isArray(value.meter) &&
        value.meter.length === 2 &&
        Number.isInteger(value.meter[0]) &&
        value.meter[0] >= 1 &&
        value.meter[0] <= 12 &&
        [2, 4, 8, 16].includes(value.meter[1]),
      "Invalid meter."
    );
    requireValue(Array.isArray(value.steps) && value.steps.length <= 128, "Use at most 128 steps.");
    const steps = value.steps.map((step) => {
      requireValue(step && durations.some(([ticks]) => ticks === step.ticks), "Invalid step duration.");
      requireValue(Array.isArray(step.presses) && step.presses.length <= 6, "Use at most six buttons in a step.");
      const seen = new Set();
      const presses = step.presses.map((press) => {
        requireValue(
          press && Number.isInteger(press.root) && press.root >= 0 && press.root < 12 && kinds.includes(press.kind),
          "Invalid bass button."
        );
        requireValue(
          press.finger === null || (Number.isInteger(press.finger) && press.finger >= 1 && press.finger <= 5),
          "Finger must be 1–5 or unassigned."
        );
        const id = press.kind + "-" + press.root;
        requireValue(!seen.has(id), "A button can appear only once in a step.");
        seen.add(id);
        return { root: press.root, kind: press.kind, finger: press.finger };
      });
      return { ticks: step.ticks, presses };
    });
    return { version: 1, title: value.title, meter: value.meter.slice(), steps };
  }
  function empty() {
    return { version: 1, title: "Untitled pattern", meter: [4, 4], steps: [] };
  }
  function encode(value) {
    const p = validate(value);
    const compact = [p.title, p.meter, p.steps.map((s) => [s.ticks, s.presses.map((b) => [b.root, kinds.indexOf(b.kind), b.finger])])];
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    return (
      "BP1." +
      btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    );
  }
  function decode(text) {
    requireValue(typeof text === "string" && text.trim().length <= 65536, "Pattern code is too large.");
    text = text.trim();
    requireValue(/^BP1\.[A-Za-z0-9_-]+$/.test(text), "Paste a BP1 pattern code.");
    try {
      const bytes = Uint8Array.from(atob(text.slice(4).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      requireValue(Array.isArray(data) && data.length === 3 && Array.isArray(data[2]), "Invalid pattern code.");
      return validate({
        version: 1,
        title: data[0],
        meter: data[1],
        steps: data[2].map((s) => {
          requireValue(Array.isArray(s) && s.length === 2 && Array.isArray(s[1]), "Invalid step.");
          return {
            ticks: s[0],
            presses: s[1].map((b) => {
              requireValue(Array.isArray(b) && b.length === 3 && Number.isInteger(b[1]), "Invalid button.");
              return { root: b[0], kind: kinds[b[1]], finger: b[2] };
            }),
          };
        }),
      });
    } catch (_) {
      throw new Error("Invalid pattern code. Nothing was changed.");
    }
  }
  function button(press) {
    return buttons.find((b) => b.id === press.kind + "-" + press.root);
  }
  function pitches(step) {
    const result = new Map();
    step.presses.forEach((press) => {
      const b = button(press);
      b.notes.forEach((pc, i) => {
        const midi = (["bass", "counter"].includes(press.kind) ? 36 : 48) + pc;
        if (!result.has(midi)) result.set(midi, { midi, name: b.spellings[i] });
      });
    });
    return [...result.values()].sort((a, b) => a.midi - b.midi);
  }
  function pitchABC(pitch) {
    const spelling = window.Tonal.Note.get(pitch.name);
    let octave = Math.floor(pitch.midi / 12) - 1;
    while (window.Tonal.Note.midi(pitch.name + octave) < pitch.midi) octave++;
    while (window.Tonal.Note.midi(pitch.name + octave) > pitch.midi) octave--;
    const accidental = spelling.alt > 0 ? "^".repeat(spelling.alt) : spelling.alt < 0 ? "_".repeat(-spelling.alt) : "=";
    return accidental + (octave > 4 ? spelling.letter.toLowerCase() + "'".repeat(octave - 5) : spelling.letter + ",".repeat(4 - octave));
  }
  function score(value) {
    const p = validate(value);
    let abc = "X:1\nM:" + p.meter.join("/") + "\nL:1/16\nK:C clef=bass\n";
    let used = 0,
      bar = 1;
    const barTicks = (p.meter[0] * 48) / p.meter[1],
      segments = [];
    p.steps.forEach((step, index) => {
      const notes = pitches(step);
      const head = notes.length ? (notes.length > 1 ? "[" + notes.map(pitchABC).join("") + "]" : pitchABC(notes[0])) : "z";
      let remaining = step.ticks;
      while (remaining) {
        const ticks = Math.min(remaining, barTicks - used);
        const start = abc.length;
        abc += head + ticks / 3;
        remaining -= ticks;
        if (remaining && notes.length) abc += "-";
        segments.push({ start, end: abc.length, step: index, ticks, bar });
        abc += " ";
        used += ticks;
        if (used === barTicks) {
          abc += "| ";
          used = 0;
          bar++;
          if (bar % 5 === 1) abc += "\n";
        }
      }
    });
    abc = used === 0 && p.steps.length ? abc.replace(/\|\s*$/, "|]") : abc + "|]";
    return { abc, segments, incomplete: used, barTicks };
  }
  function example(title, meter, roots, chordSteps) {
    return validate({
      version: 1,
      title,
      meter,
      steps: roots.map((root, i) => ({
        ticks: 12,
        presses: [{ root, kind: chordSteps.includes(i) ? "M" : "bass", finger: null }],
      })),
    });
  }
  const examples = [
    example("Alternating bass", [4, 4], [0, 0, 7, 0], [1, 3]),
    example("Waltz bass", [3, 4], [0, 0, 0], [1, 2]),
    example("Chromatic approach", [4, 4], [0, 4, 6, 7], []),
  ];
  return { kinds, durations, clone, validate, empty, encode, decode, button, pitches, score, examples };
})();
