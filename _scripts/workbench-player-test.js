#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let contexts = 0,
  notes = [],
  timers = new Map(),
  nextTimer = 0,
  stopCalls = 0;
let resume;
const ctx = {
  currentTime: 1,
  destination: {},
  state: "running",
  resume: () => Promise.resolve(),
  createGain: () => ({
    gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
    disconnect() {},
  }),
  createOscillator: () => {
    const voice = {
      frequency: {},
      connect() {},
      disconnect() {},
      start(time) {
        notes.push({ voice, time });
      },
      stop() {
        stopCalls++;
      },
    };
    return voice;
  },
};
const sandbox = {
  document: { addEventListener() {} },
  setTimeout: (fn) => {
    timers.set(++nextTimer, fn);
    return nextTimer;
  },
  clearTimeout: (id) => timers.delete(id),
  Tactus: {
    audio: {
      resume: () => {
        contexts++;
        return ctx.resume().then(() => ctx);
      },
      output: (family) => {
        assert.equal(family, "synth");
        return {};
      },
    },
  },
  addEventListener() {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../assets/js/workbench/player.js"), "utf8"), sandbox);
const P = sandbox.WorkbenchPlayer;
(async () => {
  assert.equal(contexts, 0, "no audio context before user action");
  await P.play([[60, 64, 67]]);
  assert.equal(notes.length, 3);
  assert.equal(P.isPlaying(), true);
  assert.ok(
    notes.every((n) => n.time === 1.04),
    "chord tones start together"
  );
  P.stop();
  assert.equal(P.isPlaying(), false);
  assert.equal(timers.size, 0);
  assert.ok(stopCalls >= 6, "stop cancels active voices as well as scheduled ends");
  notes = [];
  P.mute();
  await P.play([[60]]);
  assert.equal(notes.length, 0, "muted playback is silent");
  P.mute();
  await P.play([[60, 64, 67]], { roll: true });
  assert.ok(notes[0].time < notes[1].time && notes[1].time < notes[2].time, "roll is ordered");
  P.stop();
  ctx.resume = () =>
    new Promise((resolve) => {
      resume = resolve;
    });
  notes = [];
  const pending = P.play([[60]]);
  P.stop();
  resume();
  await pending;
  assert.equal(notes.length, 0, "stopping during resume prevents delayed sound");
  ctx.resume = () => Promise.reject(new Error("unavailable"));
  let message = "";
  assert.equal(
    await P.play([[60]], {
      onError: (text) => {
        message = text;
      },
    }),
    false
  );
  assert.ok(message.includes("unavailable"));
  let legacy = 0,
    first = 0,
    second = 0;
  P.onStop(() => legacy++);
  const off = P.subscribeStop(() => first++);
  P.subscribeStop(() => second++);
  P.stop();
  assert.deepEqual([legacy, first, second], [1, 1, 1], "all mounted views receive stop");
  off();
  P.stop();
  assert.deepEqual([legacy, first, second], [2, 1, 2], "unsubscribe keeps the other views and original handler");
  console.log("9 player lifecycle tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
