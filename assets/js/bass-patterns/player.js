// Local synthesized practice tones; no downloads or audio before a Play action.
window.BassPatternPlayer = (function () {
  "use strict";
  const voices = new Set();
  let generation = 0,
    interval = null,
    timers = [],
    stopCallback = () => {};
  function stop() {
    generation++;
    clearInterval(interval);
    interval = null;
    timers.forEach(clearTimeout);
    timers = [];
    voices.forEach((voice) => {
      try {
        voice.stop();
      } catch (_) {}
    });
    voices.clear();
    const callback = stopCallback;
    stopCallback = () => {};
    callback();
  }
  function note(ctx, midi, when, duration) {
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.075, when + 0.008);
    gain.gain.setValueAtTime(0.075, when + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, when + duration);
    oscillator.connect(gain);
    gain.connect(window.Tactus.audio.output("synth"));
    voices.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(oscillator);
    };
    oscillator.start(when);
    oscillator.stop(when + duration + 0.01);
  }
  async function play(value, options = {}) {
    stop();
    const pattern = window.BassPatterns.validate(value),
      ticket = generation;
    if (!pattern.steps.length) return false;
    const bpm = Math.max(40, Math.min(240, Number(options.bpm) || 96)),
      secondsPerTick = 60 / bpm / 12;
    stopCallback = options.onStop || (() => {});
    try {
      const ctx = await window.Tactus.audio.resume();
      if (ticket !== generation) return false;
      let index = 0,
        next = ctx.currentTime + 0.04;
      const count = pattern.steps.length * (pattern.repeat ? 2 : 1);
      function schedule() {
        if (ticket !== generation) return;
        while (index < count && next < ctx.currentTime + 0.2) {
          const stepIndex = index % pattern.steps.length,
            step = pattern.steps[stepIndex],
            duration = step.ticks * secondsPerTick;
          window.BassPatterns.pitches(step).forEach((pitch) => note(ctx, pitch.midi, next, Math.max(0.03, duration * 0.9)));
          timers.push(
            setTimeout(
              () => {
                if (ticket === generation) options.onStep?.(stepIndex);
              },
              Math.max(0, (next - ctx.currentTime) * 1000)
            )
          );
          next += duration;
          index++;
        }
        if (index === count && ctx.currentTime >= next) stop();
      }
      schedule();
      interval = setInterval(schedule, 25);
      return true;
    } catch (_) {
      if (ticket === generation) {
        stop();
        options.onError?.("Audio is unavailable. The staff and editor still work.");
      }
      return false;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", stop);
  return { play, stop };
})();
