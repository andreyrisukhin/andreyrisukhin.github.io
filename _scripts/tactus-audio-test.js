#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../assets/js/tactus/audio.js"), "utf8");
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
};

function node(kind, links) {
  const self = {
    kind,
    connect(target) {
      links.push([self, target]);
      return target;
    },
    disconnect() {},
  };
  return self;
}

function load() {
  const links = [];
  const loads = [];
  let contexts = 0;
  class Context {
    constructor() {
      contexts++;
      this.state = "suspended";
      this.resumes = 0;
      this.destination = node("destination", links);
    }
    resume() {
      this.resumes++;
      this.state = "running";
      return Promise.resolve();
    }
    createGain() {
      return Object.assign(node("gain", links), { gain: { value: 1 } });
    }
    createDynamicsCompressor() {
      return Object.assign(node("limiter", links), {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
      });
    }
  }
  let result = () => Promise.resolve({ stop() {} });
  const root = {
    AudioContext: Context,
    Soundfont: {
      instrument(ctx, name, options) {
        loads.push({ ctx, name, options });
        return result(name);
      },
    },
  };
  vm.runInNewContext(source, { self: root });
  return {
    audio: root.Tactus.audio,
    links,
    loads,
    root,
    get contexts() {
      return contexts;
    },
    fail: (fn) => {
      result = fn;
    },
  };
}

const targetOf = (links, from) => links.filter(([a]) => a === from).map(([, b]) => b);

(async () => {
  await check("No context exists until a player asks for one", () => {
    const t = load();
    assert.equal(t.contexts, 0);
    t.audio.setVolume(0.5);
    assert.equal(t.contexts, 0, "volume can be set before audio starts");
  });

  await check("One shared, resumed context for every caller", () => {
    const t = load();
    const a = t.audio.context();
    const b = t.audio.context();
    assert.equal(a, b);
    assert.equal(t.contexts, 1);
    assert.equal(a.state, "running");
  });

  await check("Families route through their own trimmed bus, then master, then the limiter", () => {
    const t = load();
    const ctx = t.audio.context();
    const synth = t.audio.output("synth");
    assert.equal(t.audio.output("synth"), synth, "bus is reused");
    const piano = t.audio.output("piano");
    assert.notEqual(piano, synth);
    const [master] = targetOf(t.links, synth);
    assert.equal(master.kind, "gain");
    assert.deepEqual(targetOf(t.links, piano), [master]);
    const [limiter] = targetOf(t.links, master);
    assert.equal(limiter.kind, "limiter");
    assert.ok(limiter.threshold.value < 0 && limiter.ratio.value >= 10, "limiter catches peaks");
    assert.deepEqual(targetOf(t.links, limiter), [ctx.destination]);
    assert.ok(Math.abs(synth.gain.value - t.audio.dbToGain(t.audio.trims().synth)) < 1e-12);
  });

  await check("Trims and volume apply live and stay within range", () => {
    const t = load();
    t.audio.context();
    const bus = t.audio.output("sample");
    t.audio.setTrim("sample", -6);
    assert.ok(Math.abs(bus.gain.value - 0.501187) < 1e-6);
    assert.equal(t.audio.trims().sample, -6);
    const [master] = targetOf(t.links, bus);
    assert.equal(t.audio.setVolume(2), 1);
    assert.equal(t.audio.setVolume(-1), 0);
    assert.equal(master.gain.value, 0);
    t.audio.trims().sample = 99;
    assert.equal(t.audio.trims().sample, -6, "trims() returns a copy");
  });

  await check("Soundfonts load once into the soundfont bus", async () => {
    const t = load();
    const first = t.audio.soundfont("accordion");
    assert.equal(t.audio.soundfont("accordion"), first);
    await first;
    assert.equal(t.loads.length, 1);
    assert.equal(t.loads[0].options.soundfont, "MusyngKite");
    assert.equal(t.loads[0].options.destination, t.audio.output("soundfont"));
    t.audio.soundfont("accordion", { soundfont: "FluidR3_GM" });
    assert.equal(t.loads.length, 2, "another bank is a separate instrument");
  });

  await check("A failed soundfont load can be retried", async () => {
    const t = load();
    t.fail(() => Promise.reject(new Error("offline")));
    await assert.rejects(t.audio.soundfont("cello"), /offline/);
    t.fail(() => Promise.resolve({ stop() {} }));
    await t.audio.soundfont("cello");
    assert.equal(t.loads.length, 2);
  });

  await check("Missing soundfont player rejects instead of throwing", async () => {
    const t = load();
    delete t.root.Soundfont;
    await assert.rejects(t.audio.soundfont("cello"), /not loaded/);
  });

  await check("A closed context is replaced with a fresh graph", () => {
    const t = load();
    const first = t.audio.context();
    const bus = t.audio.output("synth");
    first.state = "closed";
    const second = t.audio.context();
    assert.notEqual(second, first);
    assert.notEqual(t.audio.output("synth"), bus);
  });

  await check("resume() resolves with the running context and reports missing Web Audio", async () => {
    const t = load();
    const ctx = await t.audio.resume();
    assert.equal(ctx.state, "running");
    const bare = load();
    delete bare.root.AudioContext;
    await assert.rejects(bare.audio.resume(), /unavailable/);
  });

  await check("stop() tolerates missing or finished instruments", () => {
    const t = load();
    let stopped = 0;
    t.audio.stop({ stop: () => stopped++ });
    t.audio.stop(null);
    t.audio.stop({
      stop() {
        throw new Error("ended");
      },
    });
    assert.equal(stopped, 1);
  });

  await check("CommonJS export works without a window", () => {
    const sandbox = { module: { exports: {} } };
    vm.runInNewContext(source, sandbox);
    assert.equal(typeof sandbox.module.exports.output, "function");
  });

  console.log(`${passed} tactus audio tests passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
