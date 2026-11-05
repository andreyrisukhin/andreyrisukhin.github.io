// Short envelopes on noise and resonant tones, all driven by simulation time/events.
export function createHearthSound() {
  let ctx,
    noise,
    mix,
    roar,
    nextCrackle = 0;
  const last = new Map();
  function wake() {
    if (!globalThis.AudioContext) return;
    try {
      if (!ctx) {
        ctx = new AudioContext();
        mix = ctx.createDynamicsCompressor();
        mix.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        const bed = ctx.createBufferSource(),
          low = ctx.createBiquadFilter();
        bed.buffer = noise;
        bed.loop = true;
        low.frequency.value = 340;
        roar = ctx.createGain();
        roar.gain.value = 0;
        bed.connect(low).connect(roar).connect(mix);
        bed.start();
      }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    } catch {
      /* Audio is optional; the scene still works. */
    }
  }
  function pulse(hz, duration, gain, delay = 0, tone = false, attack = 0.003) {
    const t = ctx.currentTime + delay,
      env = ctx.createGain();
    const source = tone ? ctx.createOscillator() : ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    hz *= 0.87 + Math.random() * 0.26;
    if (tone) {
      source.type = "triangle";
      source.frequency.setValueAtTime(hz, t);
      source.frequency.exponentialRampToValueAtTime(hz * 0.58, t + duration);
    } else source.buffer = noise;
    filter.type = tone ? "lowpass" : "bandpass";
    filter.frequency.value = tone ? hz * 4 : hz;
    env.gain.setValueAtTime(0.00001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.00001, t + duration);
    source.connect(filter).connect(env).connect(mix);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    if (tone) source.start(t);
    else source.start(t, Math.random());
    source.stop(t + duration);
  }
  function play(type) {
    if (!mix || ctx.state !== "running") return;
    const t = ctx.currentTime;
    if (t - (last.get(type) ?? -Infinity) < (type === "hiss" ? 0.55 : 0.18)) return;
    last.set(type, t);
    switch (type) {
      case "impact":
        pulse(115, 0.21, 0.23, 0, true);
        pulse(780, 0.06, 0.16);
        break;
      case "split":
        pulse(2200, 0.035, 0.32);
        pulse(170, 0.15, 0.21, 0.04, true);
        break;
      case "hiss":
        pulse(3900, 0.78, 0.24, 0, false, 0.045);
        break;
      case "boil":
        for (let i = 0; i < 6; i++) pulse(720 + i * 80, 0.07, 0.065, i * 0.09, true);
        break;
      case "strike":
        pulse(3100, 0.13, 0.23);
        pulse(770, 0.2, 0.14, 0.08);
        break;
      case "ignite":
      case "floor":
        pulse(510, 0.45, 0.25, 0, false, 0.045);
        break;
      case "fling":
        pulse(820, 0.23, 0.14, 0, false, 0.055);
        break;
      case "bark":
        for (let i = 0; i < 4; i++) pulse(3300, 0.035, 0.13, i * 0.045 * Math.random());
        break;
      case "wood":
        pulse(1100, 0.06, 0.15);
        pulse(350, 0.08, 0.08, 0.03, true);
        break;
      case "pour":
        pulse(1450, 0.35, 0.1, 0, false, 0.035);
        break;
    }
  }
  return {
    wake,
    play,
    pause() {
      if (ctx) ctx.suspend().catch(() => {});
    },
    tick(events, state) {
      if (!roar || ctx.state !== "running") return;
      const intensity = state.burning || state.floor ? Math.min(1, state.output + state.floor * 0.06) : 0;
      roar.gain.setTargetAtTime(0.36 * intensity, ctx.currentTime, 0.18);
      for (const event of events) play(event.type);
      if (intensity > 0.015 && ctx.currentTime >= nextCrackle) {
        play(state.barkBurning && Math.random() < 0.7 ? "bark" : "wood");
        nextCrackle = ctx.currentTime + (0.25 + Math.random() * 0.8) / Math.max(0.25, intensity);
      }
    },
  };
}
