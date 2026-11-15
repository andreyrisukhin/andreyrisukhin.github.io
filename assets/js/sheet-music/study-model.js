/* Conservative beat-window harmony estimates. Analysis never changes the score or playback. */
(function (root) {
  "use strict";
  const EPS = 0.00001;
  const pc = (midi) => ((midi % 12) + 12) % 12;
  const unique = (values) => [...new Set(values)];
  const pretty = (name) => name.replace(/#/g, "♯").replace(/b/g, "♭");
  const pitchClass = (note) => note.pitch?.replace(/-?\d+$/, "") || ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][pc(note.midi)];
  const pitchName = (note) => note.pitch || pitchClass(note) + (Math.floor(note.midi / 12) - 1);
  const names = (notes) =>
    unique(
      notes
        .slice()
        .sort((a, b) => a.midi - b.midi)
        .map(pitchName)
    );
  const overlap = (note, start, end) => Math.max(0, Math.min(note.endBeat, end) - Math.max(note.beat, start));
  const SHAPES = [
    ["", [0, 4, 7]],
    ["m", [0, 3, 7]],
    ["7", [0, 4, 7, 10]],
    ["maj7", [0, 4, 7, 11]],
    ["m7", [0, 3, 7, 10]],
    ["dim", [0, 3, 6]],
    ["dim7", [0, 3, 6, 9]],
    ["m7♭5", [0, 3, 6, 10]],
    ["aug", [0, 4, 8]],
    ["sus4", [0, 5, 7]],
    ["sus2", [0, 2, 7]],
  ];

  function octavePairs(notes) {
    const pairs = [];
    const seen = new Set();
    for (const a of notes)
      for (const b of notes) {
        // A compound interval (two octaves), a unison, or alternating notes is not an octave pair.
        if (b.midi - a.midi !== 12 || a.part !== b.part || a.staff !== b.staff || overlap(a, b.beat, b.endBeat) <= EPS) continue;
        const key = [a.part, a.staff, a.midi, b.midi].join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ low: pitchName(a), high: pitchName(b), staff: a.staff, part: a.part, midis: [a.midi, b.midi] });
      }
    return pairs;
  }

  function infer(notes, start, end) {
    const active = notes.filter((note) => overlap(note, start, end) > EPS);
    const weights = new Map();
    // Octave doubling does not count as extra harmonic evidence.
    for (const note of active) weights.set(pc(note.midi), Math.max(weights.get(pc(note.midi)) || 0, overlap(note, start, end)));
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    const candidates = [];
    for (const rootPC of weights.keys())
      for (const [suffix, intervals] of SHAPES) {
        const tones = intervals.map((interval) => pc(rootPC + interval));
        if (!tones.every((tone) => weights.has(tone))) continue; // Never invent a missing chord tone.
        const outside = [...weights].filter(([tone]) => !tones.includes(tone)).reduce((sum, [, weight]) => sum + weight, 0);
        if (outside > total * 0.26) continue;
        const rootNote = active.find((note) => pc(note.midi) === rootPC);
        candidates.push({ name: pitchClass(rootNote) + suffix, tones, outside, score: outside / total + intervals.length * 0.005 });
      }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    const observed = unique(
      active
        .slice()
        .sort((a, b) => a.midi - b.midi)
        .map(pitchClass)
    );
    if (!best) return { name: observed.join(" + ") || "Rest", tones: [], alternatives: [], inferred: false };
    return {
      ...best,
      inferred: true,
      alternatives: candidates
        .filter((candidate) => candidate.name !== best.name && candidate.score - best.score < 0.04)
        .map((candidate) => candidate.name),
    };
  }

  function analyze(timeline) {
    return timeline.beatStarts.map((start, index) => {
      const end =
        timeline.beatEnds?.[index] ?? timeline.beatStarts[index + 1] ?? timeline.events.reduce((max, note) => Math.max(max, note.endBeat), start);
      const notes = timeline.events.filter((note) => overlap(note, start, end) > EPS);
      const context = infer(notes, start, end);
      const boundaries = [start];
      // Quarter beats give stable reading windows; complete attacks also allow off-beat chord changes.
      for (let beat = start + 1; beat < end - EPS; beat++) boundaries.push(beat);
      for (const beat of unique(notes.map((note) => note.beat))) {
        if (beat <= start + EPS || beat >= end - EPS) continue;
        const attack = notes.filter((note) => Math.abs(note.beat - beat) < EPS);
        if (unique(attack.map((note) => pc(note.midi))).length >= 3) boundaries.push(beat);
      }
      boundaries.push(end);
      boundaries.sort((a, b) => a - b);
      const segments = [];
      unique(boundaries)
        .slice(0, -1)
        .forEach((beat, i, points) => {
          const until = points[i + 1] ?? end;
          const local = infer(notes, beat, until);
          // An arpeggio fragment can use the bar's supported harmony, but a complete local chord wins.
          const active = notes.filter((note) => overlap(note, beat, until) > EPS);
          const reading = !local.inferred && context.inferred && active.length ? context : local;
          const previous = segments.at(-1);
          if (previous && previous.name === reading.name && previous.inferred === reading.inferred) previous.end = until;
          else segments.push({ ...reading, beat, end: until });
        });
      return {
        number: index + 1,
        start,
        end,
        notes,
        segments,
        octaves: octavePairs(notes),
        bass: names(notes.filter((note) => note.staff > 1)),
        upper: names(notes.filter((note) => note.staff === 1)),
      };
    });
  }

  const api = { analyze, infer, octavePairs, pretty, names, pitchName, pc };
  root.SheetStudyModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
