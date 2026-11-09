/*
 * Key names and note spelling for transposing a score by semitones.
 *
 * Key signatures follow OpenSheetMusicDisplay's TransposeCalculator
 * (flats for Db, Eb, Ab, Bb; sharps for D, E, A, B; six sharps for the
 * tritone). Notes are respelled by interval from the tonic, which OSMD's
 * own calculator does not do.
 */

(function (root) {
  const RANGE = 6;
  // Indexed by fifths + 7 (seven flats through seven sharps).
  const MAJOR = ["C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯"];
  const MINOR = ["A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯"];
  // OSMD TransposeCalculator.keyMapping: key signature of the major key
  // n semitones above C.
  const FIFTHS_BY_SEMITONE = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  const mod12 = (n) => ((n % 12) + 12) % 12;

  function clamp(semitones) {
    const n = Math.round(Number(semitones) || 0);
    return Math.max(-RANGE, Math.min(RANGE, n));
  }

  function transposeFifths(fifths, semitones) {
    return FIFTHS_BY_SEMITONE[mod12(fifths * 7 + semitones)];
  }

  function keyName(fifths, mode) {
    const names = mode === "minor" ? MINOR : MAJOR;
    const name = names[fifths + 7];
    if (!name) return null;
    return `${name} ${mode === "minor" ? "minor" : "major"}`;
  }

  function formatOffset(semitones) {
    if (!semitones) return "";
    return (semitones > 0 ? "+" : "−") + Math.abs(semitones);
  }

  // key: { fifths, mode } from the score, or null when unknown.
  function describe(key, semitones) {
    const n = clamp(semitones);
    const offset = formatOffset(n);
    if (!key || typeof key.fifths !== "number") {
      return { semitones: n, offset, name: n ? `${offset} semitones` : "Original key", fifths: null };
    }
    const fifths = n ? transposeFifths(key.fifths, n) : key.fifths;
    return { semitones: n, offset, name: keyName(fifths, key.mode) || "Original key", fifths };
  }

  // Letter steps from the old tonic to the new one. Every note moves by
  // the same interval, so Bb up three semitones into G# minor becomes C#,
  // not Db, and the leading tone E natural becomes F double-sharp.
  const LETTER_HALFTONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const mod7 = (n) => ((n % 7) + 7) % 7;
  const tonicLetter = (fifths) => mod7(fifths * 4);

  function letterShift(fromFifths, semitones) {
    let shift = mod7(tonicLetter(transposeFifths(fromFifths, semitones)) - tonicLetter(fromFifths));
    if (semitones < 0 && shift > 0) shift -= 7;
    return shift;
  }

  // note: { step: 0-6 for C-B, alter: semitones, octave }. Returns the same
  // shape, respelled when the interval would need a triple accidental.
  function transposeNote(note, fromFifths, semitones) {
    if (!semitones) return { step: note.step, alter: note.alter, octave: note.octave };
    const sounding = note.octave * 12 + LETTER_HALFTONES[note.step] + note.alter + semitones;
    let absStep = note.octave * 7 + note.step + letterShift(fromFifths, semitones);
    let alter;
    for (;;) {
      const step = mod7(absStep);
      const octave = Math.floor(absStep / 7);
      alter = sounding - (octave * 12 + LETTER_HALFTONES[step]);
      if (alter > 2) absStep++;
      else if (alter < -2) absStep--;
      else return { step, alter, octave };
    }
  }

  // OSMD reads a missing <mode> as major, so a page hint wins. Otherwise
  // KeyEnum 1 (minor) and 7 (aeolian) read as minor, everything else major.
  function modeFromOsmd(modeEnum, hint) {
    if (hint === "minor" || hint === "major") return hint;
    return modeEnum === 1 || modeEnum === 7 ? "minor" : "major";
  }

  // A written <mode>, or null when the score leaves it out. Church modes
  // other than aeolian and ionian are named by their signature's major key.
  function modeFromXml(text) {
    const mode = String(text || "")
      .trim()
      .toLowerCase();
    if (mode === "minor" || mode === "aeolian") return "minor";
    return mode ? "major" : null;
  }

  // Krumhansl-Kessler key profiles, from the tonic up.
  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function correlation(a, b) {
    const mean = (v) => v.reduce((sum, x) => sum + x, 0) / v.length;
    const ma = mean(a);
    const mb = mean(b);
    let num = 0;
    let da = 0;
    let db = 0;
    a.forEach((x, i) => {
      num += (x - ma) * (b[i] - mb);
      da += (x - ma) ** 2;
      db += (b[i] - mb) ** 2;
    });
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  // Chooses between a signature's major key and its relative minor.
  // weights: 12 pitch-class durations. firstChord: { pc, minor } for the
  // first chord name, which settles it when it is either tonic chord;
  // Stradella scores write chord buttons as bare roots, so their notes
  // alone often read as the relative major.
  function inferMode(fifths, weights, firstChord) {
    const major = mod12(fifths * 7);
    const minor = mod12(major + 9);
    if (firstChord && firstChord.pc === minor && firstChord.minor) return "minor";
    if (firstChord && firstChord.pc === major && !firstChord.minor) return "major";
    if (!weights || !weights.some((w) => w > 0)) return "major";
    const fromTonic = (tonic) => weights.map((_, i) => weights[mod12(i + tonic)]);
    return correlation(fromTonic(minor), MINOR_PROFILE) > correlation(fromTonic(major), MAJOR_PROFILE) ? "minor" : "major";
  }

  const api = {
    RANGE,
    FIFTHS_BY_SEMITONE,
    LETTER_HALFTONES,
    clamp,
    transposeFifths,
    letterShift,
    transposeNote,
    keyName,
    formatOffset,
    describe,
    modeFromOsmd,
    modeFromXml,
    inferMode,
  };
  root.SheetTranspose = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
