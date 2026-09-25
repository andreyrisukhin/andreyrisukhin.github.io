/* Score time stays at written tempo; playback speed is applied by the player. */
window.SheetPracticeTimeline = (function () {
  "use strict";

  function fromMeasures(measures) {
    let beat = 0;
    const changes = [{ beat: 0, bpm: 120 }];
    const starts = [];
    const notes = [];
    const ties = new Map();
    measures.forEach((measure, index) => {
      starts.push(beat);
      (measure.tempos || []).forEach((change) => {
        if (Number.isFinite(change.bpm) && change.bpm > 0) changes.push({ beat: beat + change.beat, bpm: change.bpm });
      });
      (measure.notes || []).forEach((note) => {
        const start = beat + note.beat;
        const end = start + note.duration;
        const key = [note.part || 0, note.staff || 1, note.voice || 1, note.midi].join("/");
        const previous = ties.get(key);
        if (note.tieStop && previous && Math.abs(previous.endBeat - start) < 0.0001) {
          previous.endBeat = end;
          if (!note.tieStart) ties.delete(key);
        } else {
          const event = { midi: note.midi, beat: start, endBeat: end, measure: index + 1, staff: note.staff || 1 };
          notes.push(event);
          if (note.tieStart) ties.set(key, event);
          else ties.delete(key);
        }
      });
      beat += measure.beats;
    });
    changes.sort((a, b) => a.beat - b.beat);
    const tempos = [];
    changes.forEach((change) => {
      if (tempos.length && tempos[tempos.length - 1].beat === change.beat) tempos.pop();
      tempos.push(change);
    });
    let seconds = 0;
    tempos.forEach((change, index) => {
      if (index) seconds += ((change.beat - tempos[index - 1].beat) * 60) / tempos[index - 1].bpm;
      change.seconds = seconds;
    });
    function secondsAt(value) {
      let tempo = tempos[0];
      for (const next of tempos) {
        if (next.beat > value) break;
        tempo = next;
      }
      return tempo.seconds + ((value - tempo.beat) * 60) / tempo.bpm;
    }
    return {
      events: notes.map((note) => ({ ...note, start: secondsAt(note.beat), end: secondsAt(note.endBeat) })).sort((a, b) => a.start - b.start),
      starts: starts.map(secondsAt),
      ends: starts.map((start, index) => secondsAt(start + measures[index].beats)),
      tempos,
      duration: secondsAt(beat),
    };
  }

  function fromXML(doc) {
    if (doc.querySelector("parsererror")) throw new Error("The score could not be read.");
    const measures = [];
    const text = (node, selector) => node.querySelector(selector)?.textContent || "";
    const number = (node, selector, fallback = 0) => {
      const value = text(node, selector);
      return value === "" ? fallback : Number(value);
    };
    [...doc.querySelectorAll("score-partwise > part")].forEach((part, partIndex) => {
      let divisions = 1;
      [...part.children]
        .filter((node) => node.tagName === "measure")
        .forEach((measure, index) => {
          const result = (measures[index] ||= { beats: 0, notes: [], tempos: [] });
          let cursor = 0;
          let previousBeat = 0;
          for (const node of measure.children) {
            if (node.tagName === "attributes") divisions = number(node, "divisions", divisions);
            if (node.tagName === "backup") cursor -= number(node, "duration") / divisions;
            if (node.tagName === "forward") cursor += number(node, "duration") / divisions;
            if (node.tagName === "direction") {
              const sound = node.querySelector("sound[tempo]");
              const metronome = node.querySelector("metronome");
              let bpm = sound ? Number(sound.getAttribute("tempo")) : 0;
              if (!bpm && metronome) {
                const unit = { whole: 4, half: 2, quarter: 1, eighth: 0.5, "16th": 0.25 }[text(metronome, "beat-unit")] || 1;
                const dots = metronome.querySelectorAll("beat-unit-dot").length;
                bpm = number(metronome, "per-minute") * unit * (2 - Math.pow(0.5, dots));
              }
              if (bpm) result.tempos.push({ beat: cursor + number(node, "offset") / divisions, bpm });
            }
            if (node.tagName === "note" && !node.querySelector("grace")) {
              const duration = number(node, "duration") / divisions;
              const chord = !!node.querySelector("chord");
              const start = chord ? previousBeat : cursor;
              const pitch = node.querySelector("pitch");
              if (pitch) {
                const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[text(pitch, "step")];
                const midi = (number(pitch, "octave") + 1) * 12 + pc + number(pitch, "alter");
                if (Number.isInteger(midi) && midi >= 0 && midi <= 127 && duration > 0) {
                  result.notes.push({
                    midi,
                    beat: start,
                    duration,
                    part: partIndex,
                    staff: number(node, "staff", 1),
                    voice: text(node, "voice") || "1",
                    tieStart: !!node.querySelector('tie[type="start"]'),
                    tieStop: !!node.querySelector('tie[type="stop"]'),
                  });
                }
              }
              previousBeat = start;
              if (!chord) cursor += duration;
              result.beats = Math.max(result.beats, start + duration);
            }
            result.beats = Math.max(result.beats, cursor);
          }
        });
    });
    if (!measures.length || measures.some((measure) => !(measure.beats > 0))) throw new Error("The score has no usable measure timing.");
    return fromMeasures(measures);
  }

  function renderedMap(timing, count) {
    const measures = timing.measures;
    if (!Array.isArray(measures) || measures.length !== count) throw new Error("Recording timing does not match the score.");
    measures.forEach((measure, index) => {
      if (
        !Number.isFinite(measure.startSec) ||
        !Number.isFinite(measure.endSec) ||
        measure.startSec < 0 ||
        measure.endSec <= measure.startSec ||
        (index && Math.abs(measure.startSec - measures[index - 1].endSec) > 0.01)
      ) {
        throw new Error("Recording timing is invalid.");
      }
    });
    return { starts: measures.map((m) => m.startSec), ends: measures.map((m) => m.endSec), duration: measures[measures.length - 1].endSec };
  }
  return { fromMeasures, fromXML, renderedMap };
})();
