// In-page loudness check for the shared audio engine (assets/js/tactus/audio.js).
// Evaluate on a built music page in a browser launched with
// --autoplay-policy=no-user-gesture-required. It starts the page's own player,
// meters the master bus, and reports gated RMS against the shared target.
//
//   agent-browser --args "--autoplay-policy=no-user-gesture-required" open http://127.0.0.1:4000/music/blues/
//   agent-browser eval --stdin < _scripts/tactus-loudness-check.js
(async () => {
  const TARGET_DB = -27;
  const TOLERANCE_DB = 2;
  const SECONDS = window.__loudnessSeconds || 8;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (predicate, label) => {
    for (let i = 0; i < 200; i++) {
      if (await predicate()) return;
      await wait(100);
    }
    throw new Error("Timed out waiting for " + label);
  };
  const click = (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error("Missing " + selector);
    element.click();
  };
  const audio = window.Tactus.audio;
  const soundfontReady = (name) => audio.soundfont(name);

  // Each entry starts the page's normal playback and returns a stop function.
  // `warm` loads samples first so the measurement hears the real voice.
  const pages = {
    "/music/bass-patterns/": {
      start: () => {
        const pattern = JSON.parse(document.getElementById("bp-imported").textContent);
        window.BassPatternPlayer.play(pattern, { bpm: 96 });
      },
      stop: () => window.BassPatternPlayer.stop(),
    },
    "/music/workbench/": {
      start: () => click("#workbench-play"),
      stop: () => window.WorkbenchPlayer.stop(),
    },
    "/music/blues/": {
      start: () => click("#blues-play-btn"),
      stop: () => click("#blues-play-btn"),
    },
    "/music/exercises/": {
      warm: () => soundfontReady("acoustic_grand_piano"),
      start: () => click('[data-action="play"]'),
      stop: () => click('[data-action="play"]'),
    },
    "/music/stradella/": {
      warm: () => soundfontReady("acoustic_grand_piano"),
      start: () => {
        // A fresh browser profile has no saved progression; pick three chords.
        [...document.querySelectorAll("button[data-id]")].slice(0, 3).forEach((button) => button.click());
        click("#stradella-play");
      },
      stop: () => click("#stradella-play"),
    },
    "/music/bayan-simulator/": {
      start: async () => {
        click('.bayan-sim-presets button[data-quality="major"]');
        for (let i = 0; i < SECONDS; i++) setTimeout(() => click("#bayan-sim-play"), i * 1000);
      },
      stop: () => {},
    },
    "/music/sheet/reconstructing-more-science/": {
      warm: () => soundfontReady(window.__playback.instrumentName),
      start: () => {
        window.__playback.primeAudio();
        window.__playback.play();
      },
      stop: () => window.__playback.pause(),
    },
    "/music/sheet/cogwork-dancers/": {
      warm: () => soundfontReady(window.SheetPractice.player.snapshot().instrument),
      start: () => {
        const player = window.SheetPractice.player;
        player.setMode("live");
        player.play();
      },
      stop: () => window.SheetPractice.player.pause(),
    },
  };

  const page = pages[location.pathname];
  if (!page) throw new Error("No loudness recipe for " + location.pathname);
  await audio.resume();
  if (page.warm) await page.warm();
  const meter = audio.meter();
  try {
    await page.start();
    await until(() => meter.read().activeBlocks > 0, "sound");
    meter.reset();
    await wait(SECONDS * 1000);
    const reading = meter.read();
    const round = (value) => Math.round(value * 10) / 10;
    return {
      page: location.pathname,
      rmsDb: round(reading.rmsDb),
      peakDb: round(reading.peakDb),
      outRmsDb: round(reading.outRmsDb),
      outPeakDb: round(reading.outPeakDb),
      targetDb: TARGET_DB,
      pass: Math.abs(reading.rmsDb - TARGET_DB) <= TOLERANCE_DB,
      trims: audio.trims(),
    };
  } finally {
    await page.stop();
    meter.stop();
  }
})();
