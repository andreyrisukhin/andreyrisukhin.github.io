/* Prototype-only harmony and document rules. No DOM, audio, or persistence. */
window.ComposerHarmony = (function () {
  "use strict";
  const T = window.Tonal;
  const M = window.WorkbenchModel;
  const pretty = (name) => name.replace(/b/g, "♭").replace(/#/g, "♯");
  const romanNames = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const fifths = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const chordInfo = (chord) => T.Chord.get(chord.name.split("/")[0]);
  const contains = (chord, interval) => chord.notes.includes(M.mod(chord.root + interval));
  const major = (chord) => contains(chord, 4) && contains(chord, 7);
  const minor = (chord) => contains(chord, 3) && contains(chord, 7);
  const dominant = (chord) => contains(chord, 4) && contains(chord, 10);
  const keyName = (key) => pretty(key.tonic) + " " + key.mode;

  function keyData(key, collection = "natural") {
    return key.mode === "major" ? T.Key.majorKey(key.tonic) : T.Key.minorKey(key.tonic)[collection];
  }

  function diatonic(key, size = "sevenths", collection = "natural") {
    return keyData(key, collection)[size === "triads" ? "triads" : "chords"].map(M.fromName);
  }

  function numeral(chord, key) {
    if (!chord.detail) return "Note set";
    const distance = T.Interval.get(T.Interval.distance(key.tonic, chord.detail.notes[0]));
    const lower = ["Minor", "Diminished"].includes(chordInfo(chord).quality);
    let degree = romanNames[(distance.num - 1) % 7];
    if (lower) degree = degree.toLowerCase();
    const accidental = distance.alt > 0 ? "♯".repeat(distance.alt) : "♭".repeat(-distance.alt);
    const suffix = chord.suffix
      .replace(/^(m7b5|ø7?)$/, "ø7")
      .replace(/^(dim7|o7|°7)$/, "°7")
      .replace(/^(dim|o|°)$/, "°")
      .replace(/^m(?!aj)/, "")
      .replace(/^Maj/, "maj")
      .replace(/^M(?=\d)/, "maj")
      .replace(/^M$/, "");
    return accidental + degree + suffix;
  }

  function rootDegree(chord, key) {
    return numeral({ ...chord, suffix: "" }, key);
  }

  function explain(chord, key, previous = null, next = null) {
    const roman = numeral(chord, key);
    const home = T.Note.chroma(key.tonic);
    const offset = M.mod(chord.root - home);
    const scale = keyData(key).scale.map(T.Note.chroma);
    const outside = chord.notes.filter((pc) => !scale.includes(pc));
    let role = "Context-dependent";
    let text = "A degree label locates the root. The surrounding phrase, melody, and rhythm determine its role.";
    if (!chord.detail)
      return {
        roman,
        role: "Unspecified harmony",
        text: "These notes do not have a selected chord interpretation. Hear the set without assigning it a tonal function.",
        outside,
      };

    if (dominant(chord) && next && next.root === M.mod(chord.root + 5) && (major(next) || minor(next)) && next.root !== home) {
      role = "Possible applied dominant";
      text =
        "Before " +
        pretty(next.name) +
        ", " +
        pretty(chord.name) +
        " can act as a local V7/" +
        rootDegree(next, key) +
        ". This points at that chord without requiring a change of key; style and melody decide whether that reading fits.";
      if (offset === 0) text += " In blues, the same pair may instead be tonic-to-subdominant motion.";
    } else if (offset === 7 && contains(chord, 4)) {
      role = "Dominant";
      text =
        "The fifth-degree root and " + (key.mode === "minor" ? "raised leading tone" : "leading tone") + " point toward " + pretty(key.tonic) + ".";
      if (next?.root === home && (key.mode === "minor" ? minor(next) : major(next))) {
        text += " Here it resolves to the tonic, " + pretty(next.name) + ".";
      } else if (
        next &&
        ((key.mode === "major" && next.root === M.mod(home + 9) && minor(next)) ||
          (key.mode === "minor" && next.root === M.mod(home + 8) && major(next)))
      ) {
        text += " Here it moves to " + numeral(next, key) + " instead: a deceptive resolution.";
      } else {
        text += " The next chord does not yet establish a tonic resolution.";
      }
    } else if (offset === 0 && (key.mode === "minor" ? minor(chord) : major(chord)) && !dominant(chord)) {
      role = "Tonic";
      text = "This chord is built on the tonal home, " + pretty(key.tonic) + ".";
      text +=
        previous && M.mod(previous.root - home) === 7 && contains(previous, 4)
          ? " The preceding dominant makes this arrival more explicit."
          : " It can establish or prolong home; placement and melody still matter.";
    } else if (offset === 11 && contains(chord, 3) && contains(chord, 6)) {
      role = "Dominant substitute";
      text =
        "Built on the leading tone, this diminished harmony can resolve toward " +
        pretty(key.tonic) +
        ". It shares important tones with the dominant.";
    } else if ((offset === 2 && (minor(chord) || (contains(chord, 3) && contains(chord, 6)))) || (offset === 5 && (major(chord) || minor(chord)))) {
      const borrowed = key.mode === "major" && offset === 5 && minor(chord);
      role = borrowed ? "Borrowed predominant" : "Predominant";
      text = borrowed ? "The minor iv borrows its lowered sixth degree from parallel minor. " : "";
      text +=
        next && M.mod(next.root - home) === 7 && contains(next, 4)
          ? "Here it prepares the dominant, " + pretty(next.name) + "."
          : next?.root === home && offset === 5
            ? "Here it moves directly to the tonic, a plagal motion rather than a dominant preparation."
            : "It often prepares a dominant. That role is a possibility, not a guarantee from the numeral alone.";
    } else if (key.mode === "minor" && offset === 7 && minor(chord)) {
      role = "Minor dominant";
      text =
        "Natural minor gives a minor v. It lacks the raised leading tone of V or V7, so the pull toward home is different. Compare the major dominant by ear.";
    } else if (!outside.length && ((key.mode === "major" && [4, 9].includes(offset)) || (key.mode === "minor" && [3, 8].includes(offset)))) {
      role = "Tonic relative";
      text =
        "It shares tones with the tonic and can extend tonic harmony, but it can also participate in a sequence or lead elsewhere. Listen to its neighbors.";
    } else if (
      key.mode === "major" &&
      diatonic({ ...key, mode: "minor" }, "triads").some((model) => model.root === chord.root && model.notes.every((pc) => chord.notes.includes(pc)))
    ) {
      role = "Borrowed / modal";
      text = "This harmony is available in parallel minor. It can add a modal color; borrowing alone does not tell us what function it serves here.";
    } else if (dominant(chord)) {
      role = "Dominant color";
      text =
        "Its major third and minor seventh give it dominant-seventh color. A possible target is " +
        pretty(T.Note.transpose(chord.detail.notes[0], "4P")) +
        ", but the current neighbors do not establish that resolution.";
    }
    return { roman, role, text, outside };
  }

  function spell(chord, pc) {
    return pretty(chord.detail?.notes.find((note) => T.Note.chroma(note) === pc) || roots[pc]);
  }

  function transition(from, to) {
    const common = from.notes.filter((pc) => to.notes.includes(pc));
    const delta = M.mod(to.root - from.root);
    const movements = [
      "Same root",
      "Up a semitone",
      "Up a whole tone",
      "Up a minor third",
      "Up a major third",
      "Up a fourth",
      "A tritone apart",
      "Down a fourth",
      "Down a major third",
      "Down a minor third",
      "Down a whole tone",
      "Down a semitone",
    ];
    return { common: common.map((pc) => spell(from, pc)), movement: movements[delta] };
  }

  function resolution(chord, key) {
    if (!dominant(chord) || M.mod(chord.root - T.Note.chroma(key.tonic)) !== 7) return null;
    const target = M.fromName(key.tonic + (key.mode === "minor" ? "m" : ""));
    const alternative = diatonic(key)[5];
    const sources = [M.mod(chord.root + 4), M.mod(chord.root + 10)];
    const destinations = [target.root, M.mod(target.root + (key.mode === "minor" ? 3 : 4))];
    const from = sources.map((pc) => 60 + pc);
    const to = from.map((midi, i) => midi + ((destinations[i] - sources[i] + 18) % 12) - 6);
    return {
      target,
      alternative,
      midis: [from, to],
      label: sources.map((pc, i) => spell(chord, pc) + " → " + spell(target, destinations[i])).join(" · "),
    };
  }

  function fromDegree(token, key) {
    const parts = token.split("/");
    if (parts.length > 2) return null;
    let tonic = key.tonic;
    if (parts[1]) {
      const target = T.RomanNumeral.get(parts[1]);
      if (target.empty || target.chordType) return null;
      tonic = T.Note.transpose(tonic, target.interval);
    }
    const numeric = parts[0].match(/^([1-7])(.*)$/);
    if (numeric && parts.length === 1) {
      const position = Number(numeric[1]) - 1;
      return numeric[2] ? M.fromName(keyData(key).scale[position] + numeric[2]) : diatonic(key)[position];
    }
    const degree = T.RomanNumeral.get(parts[0]);
    if (degree.empty) return null;
    let suffix = degree.chordType;
    if (/^ø7?$/.test(suffix)) suffix = "m7b5";
    else if (/^°7?$/.test(suffix)) suffix = suffix.endsWith("7") ? "dim7" : "dim";
    else if (!degree.major && !/^(m|dim|o)/.test(suffix)) suffix = "m" + suffix;
    return M.fromName(T.Note.transpose(tonic, degree.interval) + suffix);
  }

  function parse(text, currentKey) {
    const input = text.trim().replace(/♭/g, "b").replace(/♯/g, "#");
    if (!input) throw new Error("Enter a chord or sequence first.");
    const match = input.match(/^(.*?)\s+in\s+([A-Ga-g][#b]{0,2})(?:\s+(major|minor))?$/i);
    const key = match ? { tonic: match[2][0].toUpperCase() + match[2].slice(1), mode: (match[3] || currentKey.mode).toLowerCase() } : currentKey;
    if (T.Note.chroma(key.tonic) == null) throw new Error("Use a key such as G major or A minor.");
    const tokens = (match ? match[1] : input).split(/[\s,|→]+/).filter(Boolean);
    if (tokens.length > 128) throw new Error("Use at most 128 chords.");
    const chords = tokens.map((token) => {
      // In this composer, bare note letters mean major chords, never a note set.
      const chord = /^(?:[b#]*[ivIV]+|[1-7])/.test(token) ? fromDegree(token, key) : M.fromName(token);
      if (!chord) throw new Error("Could not read “" + token + "”. Try Am7, C/E, ii7, or V7/V.");
      return chord;
    });
    if (!chords.length) throw new Error("Enter at least one chord.");
    return { chords, key, explicitKey: !!match };
  }

  function pickedChord(picked) {
    if (!picked.length) return null;
    return {
      name: "Picked notes",
      root: picked[0],
      notes: picked.slice(),
      voicing: "bass-octave",
      detail: {
        notes: picked.map((pc) => roots[pc]),
        intervals: picked.map((_, i) => (i === 0 ? "Bass" : "Note " + (i + 1))),
      },
    };
  }
  function voices(chord) {
    return M.voices(chord);
  }
  function editPicked(picked, index, action, value) {
    const next = picked.slice();
    if (index < 0 || index >= next.length) return next;
    if (action === "remove") next.splice(index, 1);
    if (action === "move" && index + value >= 0 && index + value < next.length) {
      const [pc] = next.splice(index, 1);
      next.splice(index + value, 0, pc);
    }
    if (action === "replace" && Number.isInteger(value) && value >= 0 && value < 12 && !next.includes(value)) next[index] = value;
    return next;
  }
  function recognize(picked) {
    if (!picked.length) return [];
    const detected = T.Chord.detect(picked.map((pc) => roots[pc]));
    const matches = detected
      .map(M.fromName)
      .filter((chord) => chord && chord.notes.length === picked.length && picked.every((pc) => chord.notes.includes(pc)));
    if (!matches.length) return [{ ...M.fromNotes(picked), notes: picked.slice(), voicing: "bass-octave" }];
    return matches
      .map((chord) => {
        const bass = picked[0];
        const model = M.fromName(chord.name.split("/")[0] + (bass === chord.root ? "" : "/" + roots[bass]));
        model.notes = picked.slice();
        model.voicing = "bass-octave";
        return model;
      })
      .filter((chord, i, all) => all.findIndex((item) => item.name === chord.name) === i);
  }

  const commonTypes = new Set([
    "",
    "M",
    "m",
    "dim",
    "aug",
    "sus2",
    "sus4",
    "5",
    "6",
    "m6",
    "maj7",
    "m7",
    "7",
    "m7b5",
    "dim7",
    "mMaj7",
    "m/ma7",
    "add9",
    "Madd9",
    "maj9",
    "m9",
    "9",
    "7b9",
    "7#9",
    "11",
    "m11",
    "maj13",
    "m13",
    "13",
    "7sus4",
  ]);
  const families = ["Major", "Minor", "Dominant", "Diminished", "Augmented", "Suspended", "Other"];
  const extensions = ["Triad", "6th", "7th", "9th", "11th", "13th", "Other"];
  function catalog(root, all = false) {
    return T.ChordType.all()
      .filter((type) => all || type.aliases.some((alias) => commonTypes.has(alias)))
      .map((type) => {
        const aliases = type.aliases.includes("maj7") ? ["maj7", ...type.aliases] : type.aliases;
        const alias = aliases.find((name) => {
          const parsed = M.fromName(root + name);
          return parsed && parsed.root === T.Note.chroma(root) && chordInfo(parsed).chroma === type.chroma;
        });
        const chord = alias === undefined ? null : M.fromName(root + (alias === "M" ? "" : alias));
        const intervals = type.intervals;
        const family =
          intervals.includes("3M") && intervals.includes("7m")
            ? "Dominant"
            : !intervals.some((i) => /^3/.test(i)) && intervals.some((i) => ["2M", "4P"].includes(i))
              ? "Suspended"
              : families.includes(type.quality)
                ? type.quality
                : "Other";
        const highest = Math.max(...intervals.map((i) => T.Interval.get(i).num));
        const extension =
          highest > 7
            ? highest >= 13
              ? "13th"
              : highest >= 11
                ? "11th"
                : "9th"
            : highest === 7
              ? "7th"
              : highest === 6
                ? "6th"
                : intervals.length === 3
                  ? "Triad"
                  : "Other";
        return { chord, family, extension, description: type.name || type.aliases[0] };
      })
      .filter((item) => item.chord);
  }

  function related(chord, key, kind) {
    if (!chord) return [];
    if (kind === "resolve") {
      const target = T.Note.transpose(chord.detail?.notes[0] || roots[chord.root], "4P");
      return ["", "m", "maj7", "m7"].map((suffix) => M.fromName(target + suffix));
    }
    if (kind === "color")
      return catalog(chord.detail?.notes[0] || roots[chord.root])
        .slice(0, 30)
        .map((item) => item.chord);
    if (kind === "bass") {
      return [-2, -1, 1, 2]
        .map((delta) => {
          const name = chord.detail ? chord.name.split("/")[0] : "";
          return name ? M.fromName(name + "/" + roots[M.mod(chord.notes[0] + delta)]) : null;
        })
        .filter(Boolean);
    }
    return diatonic(key)
      .filter((item) => item.name !== chord.name)
      .map((item) => ({ item, common: transition(chord, item).common.length }))
      .filter((entry) => entry.common > 0)
      .sort((a, b) => b.common - a.common)
      .map((entry) => entry.item);
  }

  function patterns(key) {
    const minorKey = key.mode === "minor";
    const patterns = [
      ["cadence", minorKey ? "Minor ii–V–i" : "Major ii–V–I", minorKey ? "iiø7 V7 i" : "ii7 V7 Imaj7", "Prepare, create tension, arrive home."],
      ["deceptive", "Deceptive resolution", minorKey ? "V7 bVImaj7" : "V7 vi7", "The dominant moves somewhere other than the tonic."],
      ["plagal", "Plagal motion", minorKey ? "iv i" : "IV I", "Compare IV–I with a dominant–tonic arrival."],
      ["turnaround", "Turnaround", minorKey ? "i bVImaj7 iiø7 V7" : "Imaj7 vi7 ii7 V7", "A phrase that points back to the beginning."],
      [
        "cycle",
        "Diatonic root cycle",
        minorKey ? "i iv bVII7 bIIImaj7 bVImaj7 iiø7 V7 i" : "vi7 ii7 V7 Imaj7 IVmaj7 viiø7 III7 vi7",
        "Mostly fourth-related roots; not every step is a perfect fourth.",
      ],
      [
        "blues",
        "12-bar blues",
        "I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7",
        "Dominant-seventh colors do not all function as V7. Treat the major/minor key analysis as only one lens.",
      ],
    ];
    return patterns.map(([id, label, input, description]) => ({ id, label, description, chords: parse(input, key).chords }));
  }

  function context(state, candidate, intent) {
    const start = intent === "replace" ? state.selected : state.gap;
    const after = start + (intent === "replace" ? 1 : 0);
    return [state.chords[start - 1], ...candidate, state.chords[after]].filter(Boolean);
  }

  function createDocument() {
    function placed(chords) {
      let previous = -1;
      return chords.map((chord, index) => {
        const value = chord.gridCell;
        const gridCell = Number.isInteger(value) && value > previous && value <= 255 - (chords.length - index - 1) ? value : previous + 1;
        previous = gridCell;
        return { ...chord, gridCell };
      });
    }
    let state = { chords: placed(["Am7", "D7", "Gmaj7"].map(M.fromName)), key: { tonic: "G", mode: "major" }, selected: 1, gap: 2 };
    const past = [],
      future = [];
    function save() {
      past.push(clone(state));
      if (past.length > 100) past.shift();
      future.length = 0;
    }
    return {
      get state() {
        return state;
      },
      get canUndo() {
        return !!past.length;
      },
      get canRedo() {
        return !!future.length;
      },
      load(next) {
        if (!next || !Array.isArray(next.chords) || next.chords.length > 128) throw new Error("Invalid progression.");
        const chords = next.chords.map((chord) => M.restore(M.entry(chord)));
        if (chords.some((chord) => !chord) || !roots.includes(next.key.tonic) || !["major", "minor"].includes(next.key.mode))
          throw new Error("Invalid progression.");
        state = {
          chords: placed(chords),
          key: { ...next.key },
          selected: Math.max(0, Math.min(next.selected || 0, Math.max(0, chords.length - 1))),
          gap: Math.max(0, Math.min(next.gap ?? chords.length, chords.length)),
        };
        past.length = future.length = 0;
      },
      setHandChoice(choice) {
        const chord = state.chords[state.selected];
        if (!chord) return;
        save();
        chord.handChoice = { ...choice };
      },
      select(index) {
        if (index >= 0 && index < state.chords.length) state.selected = index;
      },
      setGap(index) {
        if (index >= 0 && index <= state.chords.length) state.gap = index;
      },
      commit(chords, intent) {
        if (!chords.length || (intent === "replace" && (chords.length !== 1 || !state.chords.length))) return false;
        if (state.chords.length + chords.length - (intent === "replace" ? 1 : 0) > 128) return false;
        const index = intent === "replace" ? state.selected : state.gap;
        let next = clone(state.chords);
        if (intent === "replace") {
          next.splice(index, 1, { ...clone(chords[0]), gridCell: next[index].gridCell });
        } else {
          const start = index ? next[index - 1].gridCell + 1 : 0;
          const inserted = clone(chords).map((chord, offset) => ({ ...chord, gridCell: start + offset }));
          let previous = start + chords.length - 1;
          const tail = next.slice(index).map((chord) => {
            previous = Math.max(previous + 1, chord.gridCell);
            return { ...chord, gridCell: previous };
          });
          next = [...next.slice(0, index), ...inserted, ...tail];
          if (next[next.length - 1].gridCell >= 256) return false;
        }
        save();
        state.chords = next;
        state.selected = index;
        state.gap = index + chords.length;
        return true;
      },
      putCell(cell, chord) {
        if (!Number.isInteger(cell) || cell < 0 || cell >= 256 || !chord) return false;
        const existing = state.chords.findIndex((item) => item.gridCell === cell);
        if (existing < 0 && state.chords.length >= 128) return false;
        const value = M.restore(M.entry(chord));
        if (!value) return false;
        save();
        value.gridCell = cell;
        if (existing >= 0) state.chords[existing] = value;
        else state.chords.push(value);
        state.chords.sort((a, b) => a.gridCell - b.gridCell);
        state.selected = state.chords.indexOf(value);
        state.gap = state.selected + 1;
        return true;
      },
      moveToCell(index, cell) {
        if (!Number.isInteger(cell) || cell < 0 || cell >= 256 || !state.chords[index]) return false;
        const moving = state.chords[index];
        if (moving.gridCell === cell) return false;
        save();
        const other = state.chords.find((chord) => chord.gridCell === cell);
        if (other) other.gridCell = moving.gridCell;
        moving.gridCell = cell;
        state.chords.sort((a, b) => a.gridCell - b.gridCell);
        state.selected = state.chords.indexOf(moving);
        state.gap = state.selected + 1;
        return true;
      },
      remove() {
        if (!state.chords.length) return;
        save();
        const index = state.selected;
        state.chords.splice(index, 1);
        state.selected = Math.max(0, Math.min(index, state.chords.length - 1));
        state.gap = Math.min(index, state.chords.length);
      },
      move(delta) {
        const next = state.selected + delta;
        if (next < 0 || next >= state.chords.length) return;
        save();
        const fromCell = state.chords[state.selected].gridCell;
        state.chords[state.selected].gridCell = state.chords[next].gridCell;
        state.chords[next].gridCell = fromCell;
        const [chord] = state.chords.splice(state.selected, 1);
        state.chords.splice(next, 0, chord);
        state.selected = next;
        state.gap = next + 1;
      },
      analyze(key) {
        if (key.tonic === state.key.tonic && key.mode === state.key.mode) return;
        save();
        state.key = { ...key };
      },
      transpose(tonic) {
        const delta = M.mod(T.Note.chroma(tonic) - T.Note.chroma(state.key.tonic));
        if (!delta && tonic === state.key.tonic) return;
        save();
        state.chords = state.chords.map((chord) => {
          if (!chord.detail) return { ...M.transpose(chord, delta), ...(chord.voicing ? { voicing: chord.voicing } : {}) };
          const interval = T.Interval.distance(state.key.tonic, tonic);
          const name = T.Note.transpose(chord.detail.notes[0], interval);
          const bass = chord.notes[0] === chord.root ? "" : "/" + T.Note.transpose(roots[chord.notes[0]], interval);
          const transposed = M.fromName(name + chord.suffix + bass);
          transposed.gridCell = chord.gridCell;
          if (chord.voicing === "bass-octave") {
            transposed.notes = chord.notes.map((pc) => M.mod(pc + delta));
            transposed.voicing = chord.voicing;
          }
          return transposed;
        });
        state.key.tonic = tonic;
      },
      undo() {
        if (past.length) {
          future.push(clone(state));
          state = past.pop();
        }
      },
      redo() {
        if (future.length) {
          past.push(clone(state));
          state = future.pop();
        }
      },
    };
  }
  return {
    pretty,
    roots,
    fifths,
    families,
    extensions,
    keyName,
    keyData,
    diatonic,
    numeral,
    explain,
    spell,
    transition,
    resolution,
    parse,
    pickedChord,
    voices,
    editPicked,
    recognize,
    catalog,
    related,
    patterns,
    context,
    createDocument,
  };
})();
