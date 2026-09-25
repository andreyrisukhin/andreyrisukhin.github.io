// Run after a real browser click has unlocked audio. Observes the actual media
// element and soundfont player; wrappers delegate to the original browser APIs.
(async () => {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const until = async (predicate) => {
    for (let i = 0; i < 300; i++) {
      if (predicate()) return;
      await wait(100);
    }
    throw new Error("Audio did not become ready");
  };
  const player = SheetPractice.player;
  let audio, soundfont, context, analyser;
  const scheduled = [];
  const mediaPlay = HTMLMediaElement.prototype.play;
  const loadSoundfont = Soundfont.instrument;
  HTMLMediaElement.prototype.play = function (...args) {
    audio = this;
    return mediaPlay.apply(this, args);
  };
  Soundfont.instrument = function (...args) {
    context = args[0];
    return loadSoundfont.apply(this, args).then((instrument) => {
      soundfont = instrument;
      analyser = context.createAnalyser();
      instrument.connect(analyser);
      const play = instrument.play;
      instrument.play = function (...notes) {
        scheduled.push(notes);
        return play.apply(this, notes);
      };
      return instrument;
    });
  };
  try {
    player.pause();
    player.setMode("recording");
    player.setLoop(20, 20, false);
    player.seek(20);
    player.setRate(0.5);
    await player.play();
    await until(() => player.snapshot().state === "playing");
    await wait(700);
    assert(audio && audio.readyState >= 2 && !audio.paused, "Actual recording is decoded and playing");
    assert(audio.preservesPitch && audio.playbackRate === 0.5, "Recording uses pitch-preserving half speed");
    assert(
      audio.currentTime > 38.15 && audio.currentTime < 39,
      "Recording clock advances at half speed from measure 20 (observed " + audio.currentTime.toFixed(3) + ")"
    );
    player.pause();
    const stopped = audio.currentTime;
    await wait(200);
    assert(audio.paused && Math.abs(audio.currentTime - stopped) < 0.02, "Pause stops the real media clock");
    player.setRate(1.5);
    player.setLoop(20, 20, true);
    player.restart();
    await player.play();
    let last = audio.currentTime,
      wraps = 0;
    for (let i = 0; i < 50; i++) {
      await wait(60);
      const time = audio.currentTime;
      if (time < last - 0.4) wraps++;
      assert(time >= 38 - 0.05 && time <= 39.65, "Recording stays within the chosen passage");
      last = time;
    }
    assert(wraps >= 2, "Actual recording loops repeatedly at the measure boundary");
    player.pause();
    player.setMode("live");
    player.setRate(0.5);
    player.restart();
    await player.play();
    await until(() => player.snapshot().state === "playing" && scheduled.length > 0);
    assert(context.state === "running", "Live sound uses a running AudioContext");
    assert(soundfont && Object.keys(soundfont.buffers || {}).length > 0, "Real soundfont samples are decoded");
    let peak = 0;
    const data = new Float32Array(analyser.fftSize);
    for (let i = 0; i < 15; i++) {
      await wait(50);
      analyser.getFloatTimeDomainData(data);
      peak = Math.max(peak, ...data.map(Math.abs));
    }
    assert(peak > 0.0001, "Live output contains a non-silent audio signal");
    assert(
      scheduled.every(([midi, when, options]) => Number.isInteger(midi) && Number.isFinite(when) && options.duration > 0),
      "Actual live notes have valid pitches and durations"
    );
    player.pause();
    const count = scheduled.length;
    await wait(350);
    assert(scheduled.length === count, "Pause stops scheduling live notes");
    player.setRate(1);
    player.setLoop(69, 69, true);
    player.seek(69);
    await player.play();
    await wait(2700);
    assert(player.snapshot().measure === 69 && player.snapshot().state === "playing", "Live loop respects the slower tempo at measure 69");
    player.pause();
    player.setMode("recording");
    player.setLoop(1, 4, false);
    player.restart();
    const note = document.querySelector('.vf-stavenote[tabindex="0"]');
    note.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(document.querySelector("#sheet-inspector").open, "Inspection opens after score playback");
    document.querySelector("[data-inspect-hear]").click();
    assert(!document.querySelector("[data-inspect-stop]").disabled, "Audition can be cancelled immediately");
    await until(() => WorkbenchPlayer.isPlaying());
    assert(player.snapshot().state === "paused", "Score and note audition do not overlap");
    document.querySelector("[data-inspect-stop]").click();
    assert(!WorkbenchPlayer.isPlaying(), "Stop cancels actual written-note audio");
    document.querySelector("[data-inspect-hear]").click();
    document.querySelector("[data-inspect-stop]").click();
    await wait(100);
    assert(!WorkbenchPlayer.isPlaying(), "Immediate Stop prevents delayed audition");
    document.querySelector("[data-inspect-close]").click();
    return { checks: checks.length, result: "passed", recordingLoops: wraps, liveNotesScheduled: scheduled.length, liveSignalPeak: peak };
  } finally {
    player.pause();
    HTMLMediaElement.prototype.play = mediaPlay;
    Soundfont.instrument = loadSoundfont;
  }
})();
