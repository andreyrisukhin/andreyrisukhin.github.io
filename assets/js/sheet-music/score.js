/* Shared score schedule: MusicXML tempo map plus OSMD ties, articulations, and Stradella readings. */
window.SheetScore = (function () {
  const INSTRUMENT_CHOICES = [
    ["church_organ", "Church organ"],
    ["drawbar_organ", "Drawbar organ"],
    ["reed_organ", "Reed organ"],
    ["accordion", "Accordion"],
    ["harmonica", "Harmonica"],
    ["tango_accordion", "Tango accordion"],
    ["acoustic_grand_piano", "Grand piano"],
    ["bright_acoustic_piano", "Bright piano"],
    ["electric_piano_1", "Electric piano"],
    ["harpsichord", "Harpsichord"],
    ["celesta", "Celesta"],
    ["music_box", "Music box"],
    ["string_ensemble_1", "Strings"],
    ["choir_aahs", "Choir"],
    ["flute", "Flute"],
    ["clarinet", "Clarinet"],
    ["oboe", "Oboe"],
    ["bassoon", "Bassoon"],
    ["violin", "Violin"],
    ["cello", "Cello"],
  ];

  // Stands in for OSMD's TransposeCalculator (same two methods). OSMD
  // passes the already-transposed key copy, which still carries
  // keyTypeOriginal.
  function spellingTransposer(OSMD) {
    const T = window.SheetTranspose;
    const P = OSMD.Pitch;
    const originalFifths = (key) => (key && typeof key.keyTypeOriginal === "number" ? key.keyTypeOriginal : key ? key.Key : 0);
    return {
      transposePitch(pitch, key, halftones) {
        const step = T.LETTER_HALFTONES.indexOf(pitch.FundamentalNote);
        if (step < 0 || !halftones) return pitch;
        const out = T.transposeNote(
          { step, alter: P.HalfTonesFromAccidental(pitch.Accidental), octave: pitch.Octave },
          originalFifths(key),
          halftones
        );
        return new P(T.LETTER_HALFTONES[out.step], out.octave, P.AccidentalFromHalfTones(out.alter));
      },
      transposeKey(key, halftones) {
        key.Key = T.transposeFifths(originalFifths(key), halftones);
        key.isTransposedBy = halftones;
      },
    };
  }

  // OSMD transposes the score's own KeyInstructions in place while laying
  // out measure-start key signatures, but the accidental calculator copies
  // them earlier and only transposes when the offset is nonzero. Back at
  // zero it would inherit the previous key and draw naturals on every note,
  // so reset each key to its written value before rebuilding.
  function restoreWrittenKeys(sheet) {
    const restore = (instructions) => {
      for (const ins of instructions || []) {
        if (!ins || typeof ins.keyType !== "number" || typeof ins.keyTypeOriginal !== "number") continue;
        if (ins.keyType !== ins.keyTypeOriginal) ins.Key = ins.keyTypeOriginal;
        ins.isTransposedBy = 0;
      }
    };
    for (const measure of (sheet && sheet.SourceMeasures) || []) {
      for (const entry of measure.FirstInstructionsStaffEntries || []) if (entry) restore(entry.Instructions);
      for (const entry of measure.LastInstructionsStaffEntries || []) if (entry) restore(entry.Instructions);
      for (const container of measure.VerticalSourceStaffEntryContainers || []) {
        for (const entry of container.StaffEntries || []) if (entry) restore(entry.Instructions);
      }
    }
  }

  // Mode precedence: the file's own <mode>, then the page's hint, then
  // (for opened files, which have no page hint) inference from the notes.
  // OSMD reads a missing <mode> as major, so it cannot tell the cases apart.
  function readScoreKey(osmd, modeHint, profile = {}) {
    const T = window.SheetTranspose;
    try {
      const first = osmd.Sheet.SourceMeasures[0];
      for (const entry of first.FirstInstructionsStaffEntries || []) {
        for (const ins of (entry && entry.Instructions) || []) {
          if (typeof ins.keyType === "number") {
            let mode = profile.mode;
            if (!mode && modeHint !== "minor" && modeHint !== "major" && profile.infer) {
              mode = T.inferMode(ins.keyType, profile.weights, profile.firstChord);
            }
            return { fifths: ins.keyType, mode: mode || T.modeFromOsmd(ins.Mode, modeHint) };
          }
        }
      }
    } catch (_) {}
    return null;
  }

  // Articulation playback. Gate is the fraction of the written length that
  // sounds. Accents shape the attack only: the note starts louder, then
  // decays to the level of an unaccented note (soundfont-player's default
  // sustain is 0.9 of the note gain), so an accented held note is
  // emphasized without being louder throughout. Measured on the accordion
  // soundfont, a 0.5 s decay keeps an accent about 5 dB up at 50 ms and
  // 2 dB up at 150 ms, level by 300 ms; shorter decays vanish under the
  // sample's own onset.
  const DEFAULT_GATE = 0.95;
  const DEFAULT_SUSTAIN = 0.9;
  const ACCENTS = {
    accent: 2, // +6 dB at the attack, roughly mf to ff
    strongaccent: 2.5, // marcato, +8 dB
    marcatoup: 2.5,
    marcatodown: 2.5,
    invertedstrongaccent: 2.5,
  };
  // OSMD's ArticulationEnum, for builds that do not export it.
  const ARTICULATION_NAMES = {
    0: "accent",
    1: "strongaccent",
    3: "marcatoup",
    4: "marcatodown",
    5: "invertedstrongaccent",
    6: "staccato",
    7: "staccatissimo",
    8: "spiccato",
    9: "tenuto",
    25: "detachedlegato",
  };

  function articulationStyle(voiceEntry) {
    const list = voiceEntry.Articulations || voiceEntry.articulations || [];
    if (!list.length) return {};
    const names = window.opensheetmusicdisplay && window.opensheetmusicdisplay.ArticulationEnum;
    const has = new Set(
      list.map((a) => {
        const value = a && typeof a === "object" ? a.articulationEnum ?? a.ArticulationEnum : a;
        return (names && names[value]) || ARTICULATION_NAMES[value];
      })
    );
    const style = {};
    if (has.has("staccatissimo") || has.has("spiccato")) style.gate = 0.3;
    else if (has.has("detachedlegato") || (has.has("staccato") && has.has("tenuto"))) style.gate = 0.75;
    else if (has.has("staccato")) style.gate = 0.5;
    else if (has.has("tenuto")) style.gate = 1;
    const peak = Math.max(0, ...[...has].map((name) => ACCENTS[name] || 0));
    if (peak) style.accent = { peak, sustain: DEFAULT_SUSTAIN / peak };
    return style;
  }

  // Stradella left-hand notation: on the lower staff of an accordion
  // part, notes below the middle line (D3) are single bass buttons and
  // notes on or above it stand for chord buttons. A chord note is
  // written as its root; the chord symbol above the staff gives the
  // quality.
  const STRADELLA_CHORD_MIN_MIDI = 50;
  const STRADELLA_CHORD_TONE_GAIN = 0.5;
  const CHORD_WORD_RE = /^([A-Ga-g])([#b\u266F\u266D]?)(m|min|-|M|maj|7|m7|min7|-7|maj7|M7|dim|dim7|\u00B0|\u00B07|o|o7)?$/;
  // Chord-button qualities: display suffix and tones as [semitones above
  // the root, letter steps above the root] so tones can be spelled.
  // The Stradella diminished button omits the fifth.
  const CHORD_QUALITIES = {
    "": [
      [0, 0],
      [4, 2],
      [7, 4],
    ],
    m: [
      [0, 0],
      [3, 2],
      [7, 4],
    ],
    7: [
      [0, 0],
      [4, 2],
      [10, 6],
    ],
    m7: [
      [0, 0],
      [3, 2],
      [7, 4],
      [10, 6],
    ],
    maj7: [
      [0, 0],
      [4, 2],
      [7, 4],
      [11, 6],
    ],
    dim7: [
      [0, 0],
      [3, 2],
      [9, 6],
    ],
  };
  const CHORD_WORD_SUFFIX = {
    M: "",
    maj: "",
    min: "m",
    "-": "m",
    min7: "m7",
    "-7": "m7",
    M7: "maj7",
    dim: "dim7",
    "\u00B0": "dim7",
    "\u00B07": "dim7",
    o: "dim7",
    o7: "dim7",
  };
  const MAJOR_CHORD = { suffix: "", tones: CHORD_QUALITIES[""] };
  const LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  // Accepts lowercase roots ("am", "em") as well as lead-sheet spelling.
  // Anything else ("rit.", "a tempo") returns null.
  function parseChordWord(text) {
    const m = CHORD_WORD_RE.exec(String(text || "").trim());
    if (!m) return null;
    let pc = LETTER_PC[m[1].toLowerCase()];
    if (m[2] === "#" || m[2] === "\u266F") pc += 1;
    else if (m[2] === "b" || m[2] === "\u266D") pc -= 1;
    const written = m[3] || "";
    const suffix = written in CHORD_WORD_SUFFIX ? CHORD_WORD_SUFFIX[written] : written;
    return { pc: (pc + 12) % 12, suffix, tones: CHORD_QUALITIES[suffix] };
  }

  const HARMONY_STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // What a score says about its key and left-hand notation, read from the
  // MusicXML rather than OSMD so a missing <mode> stays missing.
  //   mode:       written mode of the first key, or null
  //   weights:    sounding beats per pitch class before the first key change
  //   firstChord: { pc, minor } of the first chord symbol or chord word
  //   stradella:  the lower staff carries chord words over single notes,
  //               the Stradella convention the reader plays as buttons
  function profileXml(doc, timeline) {
    const T = window.SheetTranspose;
    const profile = { mode: null, weights: new Array(12).fill(0), firstChord: null, stradella: false };
    const parts = doc ? [...doc.querySelectorAll("score-partwise > part")] : [];
    if (!parts.length) return profile;
    const own = (node, name) => [...node.children].filter((el) => el.tagName === name);
    const measuresOf = (part) => own(part, "measure");
    let fifths = null;
    let cutoff = Infinity;
    measuresOf(parts[0]).forEach((measure, index) => {
      const key = measure.querySelector("attributes > key");
      const value = key && key.querySelector("fifths");
      if (!value) return;
      const next = Number(value.textContent);
      if (fifths === null) {
        fifths = next;
        profile.mode = T.modeFromXml(key.querySelector("mode")?.textContent);
      } else if (next !== fifths && cutoff === Infinity) {
        cutoff = timeline && timeline.beatStarts ? timeline.beatStarts[index] : Infinity;
      }
    });
    for (const event of (timeline && timeline.events) || []) {
      if (event.beat < cutoff) profile.weights[event.midi % 12] += event.endBeat - event.beat;
    }
    for (const node of doc.querySelectorAll("harmony, direction words")) {
      if (node.tagName === "harmony") {
        const pc = HARMONY_STEP_PC[node.querySelector("root-step")?.textContent.trim()];
        if (pc === undefined) continue;
        const alter = Number(node.querySelector("root-alter")?.textContent || 0);
        profile.firstChord = { pc: (pc + alter + 12) % 12, minor: /^minor/.test(node.querySelector("kind")?.textContent.trim() || "") };
        break;
      }
      const chord = parseChordWord(node.textContent);
      if (chord) {
        profile.firstChord = { pc: chord.pc, minor: chord.suffix === "m" || chord.suffix === "m7" };
        break;
      }
    }
    for (const part of parts) {
      const staves = Number(part.querySelector("attributes > staves")?.textContent || 1);
      if (staves < 2) continue;
      const lower = (node) => own(node, "staff")[0]?.textContent.trim() === String(staves);
      let words = 0;
      let notes = 0;
      let stacked = 0;
      for (const measure of measuresOf(part)) {
        for (const node of measure.children) {
          if (!lower(node)) continue;
          if (node.tagName === "direction" && [...node.querySelectorAll("words")].some((w) => parseChordWord(w.textContent))) words++;
          if (node.tagName === "note" && node.querySelector("pitch")) {
            notes++;
            if (node.querySelector("chord")) stacked++;
          }
        }
      }
      // Piano left hands stack chord tones; Stradella writes one button.
      if (words >= 2 && notes && stacked / notes < 0.25) profile.stradella = true;
    }
    return profile;
  }

  function expressionTexts(multiExpression) {
    const out = [];
    const lists = [multiExpression.UnknownList || multiExpression.unknownList, multiExpression.EntriesList || multiExpression.entriesList];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const expr = (item && (item.expression || item.Expression)) || item;
        const label = expr && (expr.Label || expr.label);
        const text = label && typeof label === "object" ? label.text || label.Text : label;
        if (typeof text === "string" && !out.includes(text)) out.push(text);
      }
    }
    return out;
  }

  // Is this staff entry on the lower staff of a two-staff instrument?
  function isLowerInstrumentStaff(sse, fallbackIndex) {
    const staff = sse.ParentStaff || sse.parentStaff;
    const instrument = staff && (staff.ParentInstrument || staff.parentInstrument);
    const staves = instrument && (instrument.Staves || instrument.staves);
    if (staves && staves.length) return staves.length > 1 && staves[staves.length - 1] === staff;
    return fallbackIndex === 1;
  }

  function noteToMidi(pitch) {
    try {
      if (typeof pitch.getHalfTone === "function") {
        return pitch.getHalfTone() + 12;
      }
      const semitone = (pitch.FundamentalNote || 0) + (pitch.AccidentalHalfTones || 0);
      const notationOctave = (pitch.Octave || 0) + 3;
      return (notationOctave + 1) * 12 + semitone;
    } catch (_) {
      return null;
    }
  }

  function build(osmd, timeline, options = {}) {
    const sheet = osmd.Sheet || osmd.sheet;
    if (!sheet) throw new Error("Score is not loaded.");
    const measures = sheet.SourceMeasures || sheet.sourceMeasures;
    if (!measures || !measures.length) {
      throw new Error("Score has no measures.");
    }
    if (measures.length !== timeline.starts.length) throw new Error("Score timing does not match the notation.");
    const secondsAt = timeline.secondsAt;
    const realBeatStarts = timeline.beatStarts;
    const events = [];
    let degradeCount = 0;
    const chordWords = [];
    const realBeats = (frac) =>
      frac && typeof frac.RealValue === "number" ? frac.RealValue * 4 : frac && typeof frac.realValue === "number" ? frac.realValue * 4 : 0;
    // Latest chord symbol with this root at or before the note, else the
    // first one later in the same measure.
    const chordQualityFor = (pc, sec, measureIdx) => {
      let best = null;
      for (const w of chordWords) {
        if (w.pc !== pc) continue;
        if (w.sec <= sec + 0.001) best = w;
        else if (!best && w.measureIdx === measureIdx) best = w;
      }
      return best || MAJOR_CHORD;
    };
    // Source note -> {role, suffix, tones}, for hover labels.
    const stradellaReadings = new Map();
    for (const [measureIdx, measure] of measures.entries()) {
      const beatStart = realBeatStarts[measureIdx];
      if (options.stradellaBass) {
        for (const staffExprs of measure.StaffLinkedExpressions || measure.staffLinkedExpressions || []) {
          for (const me of staffExprs || []) {
            const sec = secondsAt(beatStart + realBeats(me.Timestamp || me.timestamp));
            for (const text of expressionTexts(me)) {
              const chord = parseChordWord(text);
              if (chord) chordWords.push({ sec, measureIdx, ...chord });
            }
          }
        }
        chordWords.sort((a, b) => a.sec - b.sec);
      }
      const containers = measure.VerticalSourceStaffEntryContainers || measure.verticalSourceStaffEntryContainers || [];
      for (const c of containers) {
        // OSMD exposes both PascalCase and camelCase getters depending
        // on build; try both before giving up and stacking at t.
        const ts = c.Timestamp || c.timestamp;
        const tsBeats =
          ts && typeof ts.RealValue === "number" ? ts.RealValue * 4 : ts && typeof ts.realValue === "number" ? ts.realValue * 4 : (degradeCount++, 0);
        const startSec = secondsAt(beatStart + tsBeats);
        const staffEntries = c.StaffEntries || c.staffEntries || [];
        for (const [staffIdx, sse] of staffEntries.entries()) {
          if (!sse) continue;
          const stradellaStaff = options.stradellaBass && isLowerInstrumentStaff(sse, staffIdx);
          const voiceEntries = sse.VoiceEntries || sse.voiceEntries || [];
          for (const ve of voiceEntries) {
            const articulation = articulationStyle(ve);
            const notes = ve.Notes || ve.notes || [];
            for (const note of notes) {
              if (!note) continue;
              const isRest = note.isRestFlag === true || note.IsRestFlag === true || (typeof note.isRest === "function" && note.isRest());
              if (isRest) continue;
              const pitch = note.Pitch || note.pitch;
              if (!pitch) continue;
              const midi = noteToMidi(pitch);
              if (midi == null) continue;
              // A tie chain sounds once, from its first note, for the
              // chain's total length; later notes in the chain are silent.
              const tie = note.NoteTie || note.noteTie;
              const tieNotes = tie && (tie.Notes || tie.notes);
              const tied = tieNotes && tieNotes.length > 1;
              if (tied && tieNotes[0] !== note) continue;
              const len = tied ? tie.Duration || tie.duration : note.Length || note.length;
              const lenBeats =
                len && typeof len.RealValue === "number" ? len.RealValue * 4 : len && typeof len.realValue === "number" ? len.realValue * 4 : 1;
              const durationSec = Math.max(0.05, secondsAt(beatStart + tsBeats + lenBeats) - startSec);
              let reading = null;
              if (stradellaStaff) {
                const quality = midi >= STRADELLA_CHORD_MIN_MIDI ? chordQualityFor(midi % 12, startSec, measureIdx) : null;
                reading = quality ? { role: "chord", suffix: quality.suffix, tones: quality.tones } : { role: "bass" };
                for (const n of tied ? tieNotes : [note]) stradellaReadings.set(n, reading);
              }
              if (reading && reading.role === "chord") {
                for (const [interval] of reading.tones) {
                  events.push({ midi: midi + interval, startSec, durationSec, gain: STRADELLA_CHORD_TONE_GAIN, role: "chord", ...articulation });
                }
              } else {
                events.push({ midi, startSec, durationSec, role: reading ? "bass" : undefined, ...articulation });
              }
            }
          }
        }
      }
    }
    if (degradeCount > 0) {
      console.warn("[playback] %d containers had no usable Timestamp; events stacked at measure start", degradeCount);
    }
    return {
      ...timeline,
      events: events
        .map((event) => ({ gate: DEFAULT_GATE, ...event, start: event.startSec, end: event.startSec + event.durationSec }))
        .sort((a, b) => a.start - b.start),
      stradellaReadings,
    };
  }

  return { build, spellingTransposer, restoreWrittenKeys, readScoreKey, profileXml, instruments: INSTRUMENT_CHOICES };
})();
