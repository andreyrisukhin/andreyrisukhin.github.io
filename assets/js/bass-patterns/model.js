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
    requireValue(value && [1, 2].includes(value.version), "Unsupported pattern version.");
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
      const result = { ticks: step.ticks, presses };
      if (step.chord !== undefined && value.version === 2) {
        requireValue(typeof step.chord === "string" && /^[A-G](b|#)?(m|7|m7|dim)?$/.test(step.chord), "Invalid chord label.");
        result.chord = step.chord;
      }
      if (value.version === 2 && step.notes !== undefined) {
        requireValue(Array.isArray(step.notes) && step.notes.length <= 12 && !presses.length, "Use notes or assigned buttons, not both.");
        const midiSeen = new Set();
        result.notes = step.notes
          .map((note) => {
            requireValue(
              note &&
                Number.isInteger(note.midi) &&
                note.midi >= 24 &&
                note.midi <= 84 &&
                typeof note.name === "string" &&
                /^[A-G](#|b)?$/.test(note.name) &&
                window.Tonal.Note.get(note.name).chroma === note.midi % 12 &&
                !midiSeen.has(note.midi),
              "Invalid or duplicate staff note."
            );
            midiSeen.add(note.midi);
            return { midi: note.midi, name: note.name };
          })
          .sort((a, b) => a.midi - b.midi);
      }
      return result;
    });
    const pattern = { version: value.version, title: value.title, meter: value.meter.slice(), steps };
    if (value.version === 2 && value.keyFifths !== undefined) {
      requireValue(Number.isInteger(value.keyFifths) && Math.abs(value.keyFifths) <= 7, "Invalid key signature.");
      pattern.keyFifths = value.keyFifths;
    }
    if (value.version === 2 && value.repeat !== undefined) {
      requireValue(typeof value.repeat === "boolean", "Invalid repeat.");
      pattern.repeat = value.repeat;
    }
    return pattern;
  }
  function empty() {
    return { version: 1, title: "Untitled pattern", meter: [4, 4], steps: [] };
  }
  function encode(value) {
    const p = validate(value);
    const compact = [
      p.title,
      p.meter,
      p.steps.map((s) => {
        const data = [s.ticks, s.presses.map((b) => [b.root, kinds.indexOf(b.kind), b.finger])];
        if (p.version === 2) data.push(s.notes ?? null);
        return data;
      }),
    ];
    if (p.version === 2) compact.push({ keyFifths: p.keyFifths, repeat: p.repeat, chords: p.steps.map((s) => s.chord || null) });
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    return (
      "BP" +
      p.version +
      "." +
      btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    );
  }
  function decode(text) {
    requireValue(typeof text === "string" && text.trim().length <= 65536, "Pattern code is too large.");
    text = text.trim();
    requireValue(/^BP[12]\.[A-Za-z0-9_-]+$/.test(text), "Paste a BP1 or BP2 pattern code.");
    const version = Number(text[2]);
    try {
      const bytes = Uint8Array.from(atob(text.slice(4).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      requireValue(
        Array.isArray(data) && (data.length === 3 || (version === 2 && data.length === 4)) && Array.isArray(data[2]),
        "Invalid pattern code."
      );
      const metadata = data[3] || {};
      requireValue(!metadata.chords || (Array.isArray(metadata.chords) && metadata.chords.length === data[2].length), "Invalid chord labels.");
      return validate({
        version,
        title: data[0],
        meter: data[1],
        keyFifths: metadata.keyFifths,
        repeat: metadata.repeat,
        steps: data[2].map((s, i) => {
          requireValue(Array.isArray(s) && s.length === (version === 1 ? 2 : 3) && Array.isArray(s[1]), "Invalid step.");
          return {
            ticks: s[0],
            ...(version === 2 && s[2] !== null ? { notes: s[2] } : {}),
            ...(metadata.chords?.[i] != null ? { chord: metadata.chords[i] } : {}),
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
    if (step.notes !== undefined) return clone(step.notes);
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
  // Diatonic positions count from C0; the bottom bass-clef line is G2 (18).
  function staffPosition(note) {
    const info = window.Tonal.Note.get(note.name);
    const octave = (note.midi - info.chroma) / 12 - 1 + (info.letter === "C" && info.alt < 0 ? 1 : info.letter === "B" && info.alt > 0 ? -1 : 0);
    return octave * 7 + "CDEFGAB".indexOf(info.letter);
  }
  function staffNote(position, accidental = 0) {
    const degree = ((position % 7) + 7) % 7;
    return {
      midi: (Math.floor(position / 7) + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][degree] + accidental,
      name: "CDEFGAB"[degree] + (accidental === 1 ? "#" : accidental === -1 ? "b" : ""),
    };
  }
  function pitchABC(pitch, remembered, keyAlterations) {
    const spelling = window.Tonal.Note.get(pitch.name);
    let octave = Math.floor(pitch.midi / 12) - 1;
    while (window.Tonal.Note.midi(pitch.name + octave) < pitch.midi) octave++;
    while (window.Tonal.Note.midi(pitch.name + octave) > pitch.midi) octave--;
    const id = spelling.letter + octave;
    const previous = remembered.get(id) ?? keyAlterations[spelling.letter] ?? 0;
    const accidental =
      previous === spelling.alt ? "" : spelling.alt > 0 ? "^".repeat(spelling.alt) : spelling.alt < 0 ? "_".repeat(-spelling.alt) : "=";
    remembered.set(id, spelling.alt);
    return accidental + (octave > 4 ? spelling.letter.toLowerCase() + "'".repeat(octave - 5) : spelling.letter + ",".repeat(4 - octave));
  }
  function score(value, repeatAt = value.repeat ? value.steps.length - 1 : -1) {
    const p = validate(value);
    const key = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"][(p.keyFifths || 0) + 7];
    const keyAlterations = {},
      remembered = new Map();
    (p.keyFifths > 0 ? "FCGDAEB" : "BEADGCF")
      .slice(0, Math.abs(p.keyFifths || 0))
      .split("")
      .forEach((letter) => {
        keyAlterations[letter] = p.keyFifths > 0 ? 1 : -1;
      });
    let abc = "X:1\nM:" + p.meter.join("/") + "\nL:1/16\nK:" + key + " clef=bass\n";
    let used = 0,
      bar = 1;
    const barTicks = (p.meter[0] * 48) / p.meter[1],
      segments = [];
    p.steps.forEach((step, index) => {
      const notes = pitches(step);
      let remaining = step.ticks;
      while (remaining) {
        const written = notes.map((note) => pitchABC(note, remembered, keyAlterations));
        const head = written.length ? (written.length > 1 ? "[" + written.join("") + "]" : written[0]) : "z";
        const ticks = Math.min(remaining, barTicks - used);
        const start = abc.length;
        if (remaining === step.ticks && step.chord) abc += '"' + step.chord + '"';
        abc += head + ticks / 3;
        remaining -= ticks;
        if (remaining && notes.length) abc += "-";
        segments.push({ start, end: abc.length, step: index, ticks, bar });
        abc += " ";
        used += ticks;
        if (used === barTicks) {
          abc += index === repeatAt && !remaining ? ":| " : "| ";
          used = 0;
          remembered.clear();
          bar++;
          if (bar % 5 === 1) abc += "\n";
        }
      }
    });
    if (!(used === 0 && repeatAt === p.steps.length - 1 && p.steps.length))
      abc = used === 0 && p.steps.length ? abc.replace(/\|\s*$/, "|]") : abc + (repeatAt === p.steps.length - 1 && p.steps.length ? ":|" : "|]");
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
  function segmentForElement(score, element) {
    // ABCJS includes leading whitespace after barlines in a note's range.
    if (element.el_type !== "note") return undefined;
    return score.segments.find((segment) => segment.start < element.endChar && segment.end > element.startChar);
  }
  const examples = [
    example("Alternating bass", [4, 4], [0, 0, 7, 0], [1, 3]),
    example("Waltz bass", [3, 4], [0, 0, 0], [1, 2]),
    example("Chromatic approach", [4, 4], [0, 4, 6, 7], []),
  ];
  return { kinds, durations, clone, validate, empty, encode, decode, button, pitches, staffPosition, staffNote, score, segmentForElement, examples };
})();
