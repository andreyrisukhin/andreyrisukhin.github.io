const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
let checks = 0;
function check(label, fn) {
  fn();
  checks++;
  console.log("✓ " + label);
}
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/sheet-music/practice-timeline.js"), "utf8"), { window });
const T = window.SheetPracticeTimeline;
const timeline = T.fromMeasures([
  { beats: 4, notes: [{ midi: 60, beat: 0, duration: 4, tieStart: true }] },
  { beats: 4, tempos: [{ beat: 0, bpm: 160 }], notes: [{ midi: 60, beat: 0, duration: 4, tieStop: true }] },
  { beats: 4, tempos: [{ beat: 2, bpm: 100 }], notes: [{ midi: 64, beat: 0, duration: 4 }] },
]);
check("Tempo changes, including mid-measure changes, set measure boundaries", () => {
  assert.deepEqual(Array.from(timeline.starts), [0, 2, 3.5]);
  assert.equal(timeline.duration, 5.45);
});
check("A tied note crosses the tempo boundary without a second attack", () => {
  assert.equal(timeline.events.length, 2);
  assert.equal(timeline.events[0].start, 0);
  assert.equal(timeline.events[0].end, 3.5);
});
check("Duration uses all tempo segments crossed by a note", () => assert.equal(timeline.events[1].end, 5.45));
check("Same-pitch notes in different staves are not merged", () => {
  const result = T.fromMeasures([
    {
      beats: 4,
      notes: [
        { midi: 60, beat: 0, duration: 1, tieStart: true, staff: 1 },
        { midi: 60, beat: 1, duration: 1, tieStop: true, staff: 2 },
      ],
    },
  ]);
  assert.equal(result.events.length, 2);
});
check("Explicit opening tempo overrides the default", () => {
  assert.equal(T.fromMeasures([{ beats: 4, tempos: [{ beat: 0, bpm: 60 }] }]).duration, 4);
});
check("Invalid or mismatched recording timing is rejected", () => {
  assert.throws(() => T.renderedMap({ measures: [] }, 3));
  assert.throws(() => T.renderedMap({ measures: [{ startSec: 1, endSec: 0 }] }, 1));
  assert.throws(() =>
    T.renderedMap(
      {
        measures: [
          { startSec: 0, endSec: 1 },
          { startSec: 2, endSec: 3 },
        ],
      },
      2
    )
  );
});
check("Production recording ends at the score, not the reverb tail", () => {
  const timing = JSON.parse(fs.readFileSync(path.join(root, "assets/music/sheet-music/cogwork-dancers/cogwork-dancers-timing.json")));
  assert.equal(T.renderedMap(timing, 79).duration, 137.9);
});
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/sheet-music/score.js"), "utf8"), { window, console });
function scoreFixture() {
  const pitch = (midi) => ({ getHalfTone: () => midi - 12 });
  const first = { Pitch: pitch(60), Length: { RealValue: 1 } };
  const continuation = { Pitch: pitch(60), Length: { RealValue: 1 } };
  const tie = { Notes: [first, continuation], Duration: { RealValue: 2 } };
  first.NoteTie = continuation.NoteTie = tie;
  const measure = (note, articulations = []) => ({
    VerticalSourceStaffEntryContainers: [
      {
        Timestamp: { RealValue: 0 },
        StaffEntries: [{ VoiceEntries: [{ Notes: [note], Articulations: articulations }] }],
      },
    ],
  });
  return { Sheet: { SourceMeasures: [measure(first, [0, 6]), measure(continuation), measure({ Pitch: pitch(64), Length: { RealValue: 1 } }, [9])] } };
}
check("Shared OSMD schedule keeps tied durations across tempo changes and articulation", () => {
  const score = window.SheetScore.build(scoreFixture(), timeline);
  assert.equal(score.events.length, 2);
  assert.equal(score.events[0].end, 3.5);
  assert.equal(score.events[0].gate, 0.5);
  assert.equal(score.events[0].accent.peak * score.events[0].accent.sustain, 0.9);
  assert.equal(score.events[1].gate, 1);
  assert.equal(score.duration, 5.45);
});
check("Shared schedule expands Stradella chords without changing written notes", () => {
  const osmd = scoreFixture();
  const note = { Pitch: { getHalfTone: () => 45 }, Length: { RealValue: 0.25 } }; // A3
  osmd.Sheet.SourceMeasures[0].VerticalSourceStaffEntryContainers[0].StaffEntries.push({
    VoiceEntries: [{ Notes: [note] }],
  });
  osmd.Sheet.SourceMeasures[0].StaffLinkedExpressions = [
    [
      {
        Timestamp: { RealValue: 0 },
        UnknownList: [{ Label: { text: "am" } }],
      },
    ],
  ];
  const score = window.SheetScore.build(osmd, timeline, { stradellaBass: true });
  assert.deepEqual(
    Array.from(
      score.events.filter((event) => event.role === "chord"),
      (event) => event.midi
    ),
    [57, 60, 64]
  );
  assert.equal(score.stradellaReadings.get(note).suffix, "m");
  assert.equal(note.Pitch.getHalfTone(), 45);
});

function harness() {
  let clock = 0,
    contexts = 0,
    loads = 0;
  const timers = new Map();
  let timerId = 0;
  const played = [];
  let audio;
  let load = () => Promise.resolve(instrument);
  const instrument = { play: (midi, when, options) => played.push({ midi, when, ...options }), stop() {} };
  class Context {
    constructor() {
      contexts++;
      this.state = "running";
    }
    get currentTime() {
      return clock;
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    createGain() {
      return { gain: { value: 1 }, connect() {} };
    }
    createDynamicsCompressor() {
      return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} };
    }
  }
  class Audio {
    constructor() {
      audio = this;
      this.currentTime = 0;
      this.paused = true;
      this.readyState = 1;
    }
    addEventListener() {}
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  const w = {
    SheetPracticeTimeline: T,
    AudioContext: Context,
    Soundfont: {
      instrument: () => {
        loads++;
        return load();
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/tactus/audio.js"), "utf8"), { self: w });
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/sheet-music/practice-player.js"), "utf8"), {
    window: w,
    Audio,
    URL: { createObjectURL: () => "blob:recording-test", revokeObjectURL() {} },
    fetch: async () => ({
      ok: true,
      status: 200,
      blob: async () => ({}),
      json: async () => ({
        measures: [
          { startSec: 0, endSec: 4 },
          { startSec: 4, endSec: 7 },
          { startSec: 7, endSec: 10 },
        ],
      }),
    }),
    setInterval: (fn) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearInterval: (id) => timers.delete(id),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  return {
    create: w.SheetPracticePlayer.create,
    played,
    instrument,
    advance: (value) => {
      clock += value;
      [...timers.values()].forEach((fn) => fn());
    },
    setLoad: (fn) => {
      load = fn;
    },
    get contexts() {
      return contexts;
    },
    get loads() {
      return loads;
    },
    get audio() {
      return audio;
    },
    get timers() {
      return timers.size;
    },
  };
}

(async () => {
  const h = harness();
  const p = h.create(timeline);
  check("No autoplay or audio context during initialization", () => {
    assert.equal(p.snapshot().state, "paused");
    assert.equal(h.contexts, 0);
  });
  const configured = harness();
  const custom = configured.create(timeline, { instrument: "drawbar_organ", instruments: ["accordion", "drawbar_organ"], gain: 1.6 });
  custom.setTranspose(3);
  await custom.play();
  check("Shared player honors page instrument, transposition, and gain", () => {
    assert.equal(custom.snapshot().instrument, "drawbar_organ");
    assert.equal(configured.played[0].midi, 63);
    assert.equal(configured.played[0].gain, 1.6);
  });
  custom.pause();
  custom.setTranspose(7);
  check("Transpose limits leave state intact", () => assert.equal(custom.snapshot().transpose, 3));
  custom.dispose();
  const articulated = harness();
  const marked = articulated.create(window.SheetScore.build(scoreFixture(), timeline));
  await marked.play();
  check("Shared audio scheduling applies gates and accent envelopes", () => {
    assert.equal(articulated.played[0].duration, 1.75);
    assert.equal(articulated.played[0].gain, 2);
    assert.equal(articulated.played[0].decay, 0.5);
    assert.equal(articulated.played[0].sustain, 0.45);
  });
  marked.dispose();
  check("Invalid speed and reversed/out-of-range loops leave state intact", () => {
    assert.equal(p.setRate(0), false);
    assert.equal(p.setRate(NaN), false);
    assert.equal(p.setLoop(3, 2, true), false);
    assert.equal(p.setLoop(0, 2, true), false);
    assert.equal(p.setLoop(1, 4, true), false);
    assert.equal(p.seek(NaN), false);
  });
  p.setRate(0.5);
  await p.play();
  check("Half speed doubles live note duration without transposing", () => {
    assert.equal(h.played[0].midi, 60);
    assert.equal(h.played[0].duration, 7);
    assert.equal(p.snapshot().state, "playing");
  });
  p.pause();
  check("Pause cancels the live scheduler", () => assert.equal(h.timers, 0));
  p.seek(2);
  await p.play();
  check("Seeking into a tied note resumes its remaining duration", () => {
    assert.equal(h.played.at(-1).midi, 60);
    assert.equal(h.played.at(-1).duration, 3);
  });
  p.pause();
  p.setRate(1);
  p.setLoop(2, 2, true);
  p.restart();
  await p.play();
  h.advance(2);
  check("Single-measure loop restarts at its first measure", () => {
    assert.equal(p.snapshot().measure, 2);
    assert.equal(p.snapshot().state, "playing");
    assert.ok(h.played.at(-1).duration <= 1.5);
  });
  p.pause();
  p.seek(3);
  check("Seeking outside a loop explicitly disables the loop", () => assert.equal(p.snapshot().loop.enabled, false));
  await p.play();
  h.advance(3);
  check("Natural end stops the scheduler and resets position", () => {
    assert.equal(p.snapshot().state, "paused");
    assert.equal(p.snapshot().measure, 1);
    assert.equal(h.timers, 0);
  });
  const pending = harness();
  let resolve;
  pending.setLoad(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const loading = pending.create(timeline);
  const promise = loading.play();
  loading.pause();
  resolve(pending.instrument);
  await promise;
  check("Pause while sound loads prevents late playback", () => {
    assert.equal(loading.snapshot().state, "paused");
    assert.equal(pending.played.length, 0);
  });
  const r = harness();
  const recording = r.create(timeline, { audioUrl: "test.mp3", timingUrl: "test.json" });
  recording.seek(2);
  recording.setRate(0.75);
  await recording.play();
  check("Recording uses its own timing map and pitch-preserving speed", () => {
    assert.equal(r.audio.currentTime, 4);
    assert.equal(r.audio.playbackRate, 0.75);
    assert.equal(r.audio.preservesPitch, true);
  });
  recording.setMode("live");
  check("Switching sound preserves the measure without autoplay", () => {
    assert.equal(recording.snapshot().measure, 2);
    assert.equal(recording.snapshot().state, "paused");
    assert.equal(r.audio.paused, true);
  });
  recording.setMode("recording");
  recording.setTranspose(-2);
  check("Transposing a recording selects live sound without autoplay or losing the measure", () => {
    assert.equal(recording.snapshot().mode, "live");
    assert.equal(recording.snapshot().measure, 2);
    assert.equal(recording.snapshot().state, "paused");
  });
  recording.setMode("recording");
  check("Returning to a recording restores the written key", () => assert.equal(recording.snapshot().transpose, 0));
  recording.setLoop(2, 2, true);
  await recording.play();
  r.audio.currentTime = 7.1;
  r.advance(0);
  check("Recording loops at the selected end, excluding following measures", () => assert.equal(r.audio.currentTime, 4));
  recording.dispose();
  check("Disposal stops audio and timers", () => {
    assert.equal(r.audio.paused, true);
    assert.equal(r.timers, 0);
  });
  console.log(`${checks} sheet practice checks passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
