/*
 * Tactus audio: one AudioContext per page, a bus per voice family with a
 * calibrated trim, and a peak limiter in front of the speakers.
 *
 *   voice → output(family) → master → limiter → destination
 *
 * Every player routes notes into output(family) instead of ctx.destination,
 * so families sound equally loud and a chord stack cannot clip.
 */
(function (root, factory) {
  const audio = factory(root);
  if (typeof module === "object" && module.exports) module.exports = audio;
  else (root.Tactus = root.Tactus || {}).audio = audio;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  // Gain in dB applied to each family so each page's normal playback lands
  // near -27 dBFS gated RMS on the master bus. MusyngKite samples are quiet
  // at gain 1; the bayan recordings are hot. Re-measure with
  // _scripts/tactus-loudness-check.js after changing a voice.
  const TRIMS_DB = {
    soundfont: 6,
    synth: 0,
    piano: 0,
    sample: -13.5,
  };

  let ctx = null;
  let master = null;
  let limiter = null;
  let buses = {};
  let volume = 1;
  const soundfonts = new Map();

  const dbToGain = (db) => Math.pow(10, db / 20);
  const gainToDb = (gain) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);

  function build(context) {
    ctx = context;
    buses = {};
    soundfonts.clear();
    master = ctx.createGain();
    master.gain.value = volume;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 3;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    return ctx;
  }

  function resumeQuietly(context) {
    if (context.state !== "suspended") return;
    const resumed = context.resume();
    if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
  }

  // Creates (or reopens) the shared context. Call synchronously inside a
  // user-gesture handler: Safari will not start audio first touched after
  // an await.
  function context() {
    if (!ctx || ctx.state === "closed") {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) throw new Error("Web Audio is unavailable in this browser.");
      build(new Context());
    }
    resumeQuietly(ctx);
    return ctx;
  }

  function resume() {
    let current;
    try {
      current = context();
    } catch (error) {
      return Promise.reject(error);
    }
    if (current.state === "running") return Promise.resolve(current);
    return Promise.resolve(current.resume()).then(() => current);
  }

  function output(family) {
    context();
    if (!buses[family]) {
      const bus = ctx.createGain();
      bus.gain.value = dbToGain(TRIMS_DB[family] || 0);
      bus.connect(master);
      buses[family] = bus;
    }
    return buses[family];
  }

  // Resolves to a soundfont-player instrument wired to the soundfont bus.
  // Loads are shared per page; a failed load is forgotten so a later call
  // can retry once the network is back.
  function soundfont(name, options) {
    const bank = (options && options.soundfont) || "MusyngKite";
    const key = bank + "/" + name;
    if (soundfonts.has(key)) return soundfonts.get(key);
    const Soundfont = root.Soundfont;
    if (!Soundfont) return Promise.reject(new Error("Soundfont player is not loaded."));
    let loading;
    try {
      loading = Promise.resolve(Soundfont.instrument(context(), name, { soundfont: bank, destination: output("soundfont") }));
    } catch (error) {
      return Promise.reject(error);
    }
    soundfonts.set(key, loading);
    loading.catch(() => {
      if (soundfonts.get(key) === loading) soundfonts.delete(key);
    });
    return loading;
  }

  function setTrim(family, db) {
    TRIMS_DB[family] = Number(db) || 0;
    if (buses[family]) buses[family].gain.value = dbToGain(TRIMS_DB[family]);
  }

  function stop(instrument) {
    try {
      if (instrument && typeof instrument.stop === "function") instrument.stop();
    } catch (_) {
      /* already stopped */
    }
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (master) master.gain.value = volume;
    return volume;
  }

  // Gated loudness of the master bus before the limiter (`rmsDb`, `peakDb`)
  // and of what reaches the speakers after it (`outRmsDb`, `outPeakDb`).
  // Blocks quieter than `gateDb` count as silence so rests do not drag the
  // average down. The analyser window is longer than the polling interval,
  // so no samples are skipped.
  function meter(options) {
    const opts = options || {};
    const gateDb = opts.gateDb == null ? -60 : opts.gateDb;
    const probe = (source) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      return { source, analyser, data: new Float32Array(analyser.fftSize), energy: 0, peak: 0 };
    };
    context();
    const taps = [probe(master), probe(limiter)];
    let blocks = 0;
    const timer = root.setInterval(() => {
      const means = taps.map((tap) => {
        tap.analyser.getFloatTimeDomainData(tap.data);
        let sum = 0;
        for (let i = 0; i < tap.data.length; i++) {
          sum += tap.data[i] * tap.data[i];
          tap.peak = Math.max(tap.peak, Math.abs(tap.data[i]));
        }
        return sum / tap.data.length;
      });
      if (gainToDb(Math.sqrt(means[0])) <= gateDb) return;
      taps.forEach((tap, i) => {
        tap.energy += means[i];
      });
      blocks++;
    }, opts.intervalMs || 50);
    const rms = (tap) => (blocks ? gainToDb(Math.sqrt(tap.energy / blocks)) : -Infinity);
    return {
      read: () => ({
        rmsDb: rms(taps[0]),
        peakDb: gainToDb(taps[0].peak),
        outRmsDb: rms(taps[1]),
        outPeakDb: gainToDb(taps[1].peak),
        activeBlocks: blocks,
      }),
      reset: () => {
        blocks = 0;
        taps.forEach((tap) => {
          tap.energy = tap.peak = 0;
        });
      },
      stop: () => {
        root.clearInterval(timer);
        taps.forEach((tap) => {
          try {
            tap.source.disconnect(tap.analyser);
          } catch (_) {
            /* context already rebuilt */
          }
        });
      },
    };
  }

  return {
    context,
    resume,
    output,
    soundfont,
    stop,
    meter,
    setVolume,
    volume: () => volume,
    trims: () => ({ ...TRIMS_DB }),
    setTrim,
    dbToGain,
    gainToDb,
    // Swap in another context (an OfflineAudioContext or a test double).
    use: build,
  };
});
