// Shared pitch, persistence, and recipe rules. No DOM or audio side effects.
window.WorkbenchModel = (function () {
  "use strict";
  var M = window.Music;
  var T = window.Tonal;
  function mod(n) {
    return ((n % 12) + 12) % 12;
  }

  function normalize(name) {
    name = M.toAscii(name.trim());
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/^([#b]?)-/, "$1m");
  }

  function validNotes(notes) {
    return (
      Array.isArray(notes) &&
      notes.length > 0 &&
      notes.length <= 12 &&
      notes.every(function (n) {
        return Number.isInteger(n) && n >= 0 && n < 12;
      })
    );
  }

  function fromName(name) {
    var normalized = normalize(name),
      parts = normalized.split("/");
    if (parts.length > 2) return null;
    var chord = T.Chord.get(parts[0]);
    if (chord.empty || !chord.tonic) return null;
    var notes = chord.notes.map(T.Note.chroma);
    if (parts.length === 2) {
      var bass = M.parseNote(parts[1]);
      if (bass < 0) return null;
      var idx = notes.indexOf(bass);
      if (idx > 0) notes = notes.slice(idx).concat(notes.slice(0, idx));
      else if (idx < 0) notes.unshift(bass);
    }
    return {
      name: chord.symbol + (parts[1] ? "/" + parts[1] : ""),
      root: T.Note.chroma(chord.tonic),
      suffix: chord.symbol.slice(chord.tonic.length),
      notes: notes,
      detail: { notes: chord.notes, intervals: chord.intervals.map(M.formatInterval), semitones: chord.intervals.map(T.Interval.semitones) },
      alternatives: [],
    };
  }

  function fromNotes(notes, roots) {
    notes = notes.filter(function (n, i) {
      return notes.indexOf(n) === i;
    });
    if (!validNotes(notes)) return null;
    var candidates = T.Chord.detect(notes.map(M.asciiNoteName));
    if (roots) {
      var preferred = candidates.findIndex(function (name) {
        var model = fromName(name);
        return model && roots.indexOf(model.root) >= 0;
      });
      if (preferred > 0) candidates.unshift(candidates.splice(preferred, 1)[0]);
    }
    var model = candidates.length
      ? fromName(candidates[0])
      : {
          name: notes.map(M.noteName).join(" "),
          root: notes[0],
          suffix: null,
          detail: null,
        };
    model.notes = notes;
    model.alternatives = candidates.slice(1);
    return model;
  }

  function fromSuffix(root, suffix, roman) {
    var tonalSuffix = M.SUFFIX_TO_TONAL[suffix];
    var model = fromName(M.asciiNoteName(root) + (tonalSuffix === undefined ? M.toAscii(suffix) : tonalSuffix));
    if (model) model.roman = roman || "";
    return model;
  }

  function fromDegree(token, key) {
    var match = token.match(/^(vii|vi|v|iv|iii|ii|i|[1-7])(\u00B0|\u00F8|dim7?|maj7|m7b5|m7|m|7)?$/i);
    if (!match) return null;
    var romans = ["I", "II", "III", "IV", "V", "VI", "VII"];
    var number = /^[1-7]$/.test(match[1]) ? Number(match[1]) : romans.indexOf(match[1].toUpperCase()) + 1;
    var suffix = match[2];
    if (suffix === "°") suffix = "dim";
    if (suffix === "ø") suffix = "m7b5";
    if (!suffix) {
      if (/^[1-7]$/.test(match[1])) suffix = ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"][number - 1];
      else if (match[1] === match[1].toLowerCase()) suffix = number === 7 ? "m7b5" : "m7";
      else suffix = number === 5 ? "7" : "maj7";
    }
    var tonic = T.Scale.get([M.asciiNoteName(key), "major"]).notes[number - 1];
    var model = fromName(tonic + suffix);
    if (model) {
      var roman = /^(m(?!aj)|dim)/.test(suffix) ? romans[number - 1].toLowerCase() : romans[number - 1];
      model.roman = roman + ({ m7: "7", m: "", dim: "°", dim7: "°7", m7b5: "ø7" }[suffix] ?? suffix);
    }
    return model;
  }

  function entry(model) {
    return { name: model.name, notes: model.notes.slice(), root: model.root, suffix: model.suffix, roman: model.roman || "" };
  }

  function restore(value) {
    if (!value || typeof value.name !== "string" || !validNotes(value.notes)) return null;
    var model = fromName(value.name);
    if (!model && Number.isInteger(value.root) && value.root >= 0 && value.root < 12 && typeof value.suffix === "string") {
      model = fromSuffix(value.root, value.suffix);
    }
    if (
      !model ||
      model.notes.length !== value.notes.length ||
      model.notes.some(function (pc) {
        return value.notes.indexOf(pc) < 0;
      })
    )
      model = fromNotes(value.notes);
    model.notes = value.notes.slice();
    model.roman = typeof value.roman === "string" ? value.roman : "";
    return model;
  }

  function transpose(model, delta) {
    if (!delta) return restore(entry(model));
    var notes = model.notes.map(function (n) {
      return mod(n + delta);
    });
    var shifted = model.suffix == null ? fromNotes(notes) : fromSuffix(mod(model.root + delta), model.suffix);
    if (!shifted) return null;
    shifted.notes = notes;
    if (notes[0] !== shifted.root && model.suffix != null) {
      shifted.name += "/" + M.asciiNoteName(notes[0]);
    }
    shifted.roman = model.roman || "";
    return shifted;
  }

  // Ascending close voicing, starting at the requested bass in octave four.
  // Preserve the chord's spelling instead of substituting a fixed chromatic name table.
  function voices(model) {
    var previous = 59;
    return model.notes.map(function (pc) {
      var midi = 60 + pc;
      while (midi < previous) midi += 12;
      previous = midi;
      var name = ((model.detail && model.detail.notes) || []).find(function (n) {
        return T.Note.chroma(n) === pc;
      });
      name = name || M.asciiNoteName(pc);
      var octave = Math.round((midi - T.Note.midi(name + "4")) / 12) + 4;
      return { pc: pc, midi: midi, name: name, octave: octave };
    });
  }

  function savedItems(raw) {
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) throw new Error("Saved practice must be a list.");
    return list.map(function (item) {
      if (!item || typeof item.name !== "string") throw new Error("Invalid saved practice.");
      var chords = item.chords || (item.notes ? [item] : []);
      if (!Array.isArray(chords) || !chords.length || chords.length > 128) throw new Error("Invalid saved chords.");
      chords.forEach(function (c) {
        if (!c || typeof c.name !== "string" || !validNotes(c.notes)) throw new Error("Invalid saved notes.");
      });
      return {
        name: item.name,
        chords: chords,
        key: Number.isInteger(item.key) && item.key >= 0 && item.key < 12 ? item.key : null,
        bpm: Number.isFinite(item.bpm) && item.bpm >= 40 && item.bpm <= 200 ? item.bpm : 96,
        mode: item.mode === "progression" || chords.length > 1 ? "progression" : "chord",
        index: Number.isInteger(item.index) ? Math.max(0, Math.min(item.index, chords.length - 1)) : 0,
      };
    });
  }

  function functionInKey(model, key) {
    if (model.roman) return model.roman;
    var degree = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"][mod(model.root - key)];
    var suffix = model.suffix || "";
    if (/^(m(?!aj)|dim)/.test(suffix)) degree = degree.toLowerCase();
    return degree + ({ m: "", M: "", m7: "7", dim: "°", dim7: "°7", m7b5: "ø7" }[suffix] ?? suffix);
  }

  function recipes(model) {
    if (model.root < 0 || model.suffix == null) return [];
    var S = window.StradellaData;
    var suffix = window.ChordName.normalizeSuffix(model.suffix);
    return S.findBySuffix(suffix)
      .filter(function (c) {
        return !c.bug;
      })
      .map(function (c) {
        var r = S.getRecipe(c, true);
        if (!r) return null;
        var bass = model.notes[0];
        var parts = r.parts.map(function (p) {
          var pc = mod(model.root + p.note);
          return {
            name: M.noteName(pc) + { M: " major", m: " minor", 7: " seventh", d7: " diminished" }[p.qual],
            notes: S.BUTTONS[p.qual].map(function (n) {
              return mod(pc + n);
            }),
          };
        });
        var actual = [bass];
        parts.forEach(function (p) {
          actual = actual.concat(p.notes);
        });
        var rh = r.rh == null ? null : mod(model.root + r.rh);
        if (rh != null) actual.push(rh);
        var missing = model.notes.filter(function (n) {
          return actual.indexOf(n) < 0;
        });
        var extra = actual.filter(function (n, i) {
          return model.notes.indexOf(n) < 0 && actual.indexOf(n) === i;
        });
        return {
          label: S.renderRecipe(c, model.root, true, bass),
          bass: bass,
          parts: parts,
          rh: rh,
          missing: missing,
          extra: extra,
          exact: !missing.length && !extra.length,
          warning: c.uncertainNote || "",
          large: parts.length > 2,
        };
      })
      .filter(Boolean);
  }

  return {
    mod: mod,
    normalize: normalize,
    validNotes: validNotes,
    voices: voices,
    savedItems: savedItems,
    recipes: recipes,
    functionInKey: functionInKey,
    fromName: fromName,
    fromNotes: fromNotes,
    fromSuffix: fromSuffix,
    fromDegree: fromDegree,
    entry: entry,
    restore: restore,
    transpose: transpose,
  };
})();
