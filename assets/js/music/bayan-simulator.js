(function () {
  "use strict";

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BAYAN_COLS = 3;
  const BAYAN_COL_STEP = 3;
  const KEY_SEQUENCE = ["q", "a", "z", "w", "s", "x", "e", "d", "c", "r", "f", "v", "t", "g", "b", "y", "h", "n", "u", "j", "m", "i", "k", ",", "o"];
  const MANIFEST_URL = "/assets/music/bayan-simulator/manifest.json";

  const QUALITIES = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    add9: [0, 4, 7, 14],
    root: [0],
    octave: [0, 12],
  };

  const state = {
    selected: new Set(),
    mode: "build",
    audio: null,
    instruments: [],
    buffers: new Map(),
    sampleVersion: 1,
  };

  const el = {
    root: document.getElementById("bayan-sim"),
    instrument: document.getElementById("bayan-sim-instrument"),
    velocity: document.getElementById("bayan-sim-velocity"),
    duration: document.getElementById("bayan-sim-duration"),
    gain: document.getElementById("bayan-sim-gain"),
    rollDelay: document.getElementById("bayan-sim-roll-delay"),
    velocityOut: document.getElementById("bayan-sim-velocity-out"),
    durationOut: document.getElementById("bayan-sim-duration-out"),
    gainOut: document.getElementById("bayan-sim-gain-out"),
    rollDelayOut: document.getElementById("bayan-sim-roll-delay-out"),
    buildMode: document.getElementById("bayan-sim-build-mode"),
    liveMode: document.getElementById("bayan-sim-live-mode"),
    play: document.getElementById("bayan-sim-play"),
    roll: document.getElementById("bayan-sim-roll"),
    clear: document.getElementById("bayan-sim-clear"),
    octDown: document.getElementById("bayan-sim-oct-down"),
    octUp: document.getElementById("bayan-sim-oct-up"),
    fit: document.getElementById("bayan-sim-fit"),
    presets: document.querySelectorAll(".bayan-sim-presets button[data-quality]"),
    keyboard: document.getElementById("bayan-sim-keyboard"),
    range: document.getElementById("bayan-sim-range"),
    status: document.getElementById("bayan-sim-status"),
    readout: document.getElementById("bayan-sim-readout"),
  };

  if (!el.root) return;

  function midiToName(note) {
    return NOTE_NAMES[((note % 12) + 12) % 12] + (Math.floor(note / 12) - 1);
  }

  function currentInstrument() {
    return state.instruments[Number(el.instrument.value) || 0];
  }

  function currentRange() {
    return currentInstrument()?.noteRange || [54, 78];
  }

  async function ensureAudio() {
    if (!state.audio) {
      state.audio = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audio.state === "suspended") await state.audio.resume();
    return state.audio;
  }

  async function loadBuffer(instrument) {
    const cached = state.buffers.get(instrument.slug);
    if (cached) return cached;
    const ctx = await ensureAudio();
    const separator = instrument.sample.includes("?") ? "&" : "?";
    const response = await fetch(`${instrument.sample}${separator}v=${state.sampleVersion}`);
    if (!response.ok) throw new Error(`Could not load ${instrument.name} sample`);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    state.buffers.set(instrument.slug, buffer);
    return buffer;
  }

  async function playNote(note, delayMs = 0, durationOverride = null) {
    const ctx = await ensureAudio();
    const instrument = currentInstrument();
    if (!instrument) return;
    const buffer = await loadBuffer(instrument);
    const durationSeconds = (durationOverride || Number(el.duration.value)) / 1000;
    const start = ctx.currentTime + delayMs / 1000;
    const level = (Number(el.gain.value) * Number(el.velocity.value)) / 127;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(level, start);
    gain.gain.setValueAtTime(level, Math.max(start, start + durationSeconds - 0.05));
    gain.gain.linearRampToValueAtTime(0.0001, start + durationSeconds);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((note - instrument.baseNote) / 12);
    source.connect(gain);
    source.start(start);
    source.stop(start + Math.min(durationSeconds, buffer.duration / source.playbackRate.value));
  }

  function reportAudioError(error) {
    el.status.textContent = error.message || String(error);
  }

  function flashButton(note) {
    const btn = el.keyboard.querySelector(`[data-note="${note}"]`);
    if (!btn) return;
    btn.classList.add("is-flashing");
    window.setTimeout(() => btn.classList.remove("is-flashing"), 220);
  }

  function selectedNotes() {
    return [...state.selected].sort((a, b) => a - b);
  }

  function updateReadout() {
    const [low, high] = currentRange();
    const notes = selectedNotes();
    el.readout.textContent = notes.length ? notes.map(midiToName).join(" ") : "no notes selected";
    el.range.textContent = `range: ${midiToName(low)} to ${midiToName(high)}`;
    el.keyboard.querySelectorAll(".bayan-sim-button").forEach((btn) => {
      const note = Number(btn.dataset.note);
      btn.classList.toggle("is-active", state.selected.has(note));
      btn.classList.toggle("is-root", notes[0] === note);
    });
  }

  function toggleNote(note) {
    if (state.mode === "live") {
      playNote(note).catch(reportAudioError);
      flashButton(note);
      return;
    }
    if (state.selected.has(note)) {
      state.selected.delete(note);
    } else {
      state.selected.add(note);
    }
    updateReadout();
  }

  function buildKeyboard() {
    const [low, high] = currentRange();
    const winLow = low - 6;
    const winHigh = high + 12;
    const rows = Math.ceil((winHigh - winLow + 1) / BAYAN_COL_STEP);
    const keyByNote = new Map(KEY_SEQUENCE.map((key, index) => [low + index, key]));
    el.keyboard.innerHTML = "";

    for (let col = 0; col < BAYAN_COLS; col++) {
      const column = document.createElement("div");
      column.className = `bayan-sim-col bayan-sim-col-${col}`;
      for (let row = 0; row < rows; row++) {
        const note = winLow + col + BAYAN_COL_STEP * row;
        if (note > winHigh) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bayan-sim-button";
        button.dataset.note = String(note);
        if (note < low || note > high) button.classList.add("is-out-of-range");
        button.innerHTML = `<span>${midiToName(note)}</span>${keyByNote.has(note) ? `<kbd>${keyByNote.get(note)}</kbd>` : ""}`;
        button.addEventListener("click", () => toggleNote(note));
        column.appendChild(button);
      }
      el.keyboard.appendChild(column);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    el.buildMode.classList.toggle("is-active", mode === "build");
    el.liveMode.classList.toggle("is-active", mode === "live");
    el.status.textContent =
      mode === "build" ? "Build chord: clicks and keys toggle notes into the chord." : "Live play: clicks and keys play immediately.";
  }

  function playSelected(asRoll) {
    const notes = selectedNotes();
    if (!notes.length) return;
    notes.forEach((note, index) => {
      const delay = asRoll ? index * Number(el.rollDelay.value) : 0;
      playNote(note, delay).catch(reportAudioError);
      window.setTimeout(() => flashButton(note), delay);
    });
  }

  function transposeSelection(delta) {
    const [low, high] = currentRange();
    const moved = selectedNotes()
      .map((note) => note + delta)
      .filter((note) => note >= low && note <= high);
    if (moved.length) {
      state.selected = new Set(moved);
      updateReadout();
    }
  }

  function fitSelection() {
    const [low, high] = currentRange();
    let notes = selectedNotes();
    if (!notes.length) return;
    while (Math.min(...notes) < low) notes = notes.map((note) => note + 12);
    while (Math.max(...notes) > high) notes = notes.map((note) => note - 12);
    state.selected = new Set(notes.filter((note) => note >= low && note <= high));
    updateReadout();
  }

  function setQuality(quality) {
    const [, high] = currentRange();
    const intervals = QUALITIES[quality] || QUALITIES.major;
    const root = selectedNotes()[0] || currentRange()[0];
    state.selected = new Set(intervals.map((interval) => root + interval).filter((note) => note <= high));
    fitSelection();
  }

  function populateInstruments() {
    el.instrument.innerHTML = "";
    state.instruments.forEach((instrument, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = instrument.name;
      el.instrument.appendChild(option);
    });
  }

  function seedChord() {
    const [low] = currentRange();
    state.selected = new Set([low, low + 4, low + 7]);
  }

  function wire() {
    [el.velocity, el.duration, el.gain, el.rollDelay].forEach((input) => {
      input.addEventListener("input", () => {
        el.velocityOut.value = el.velocity.value;
        el.durationOut.value = el.duration.value;
        el.gainOut.value = el.gain.value;
        el.rollDelayOut.value = el.rollDelay.value;
      });
    });
    el.instrument.addEventListener("change", () => {
      fitSelection();
      if (!state.selected.size) seedChord();
      buildKeyboard();
      updateReadout();
    });
    el.buildMode.addEventListener("click", () => setMode("build"));
    el.liveMode.addEventListener("click", () => setMode("live"));
    el.play.addEventListener("click", () => playSelected(false));
    el.roll.addEventListener("click", () => playSelected(true));
    el.clear.addEventListener("click", () => {
      state.selected.clear();
      updateReadout();
    });
    el.octDown.addEventListener("click", () => transposeSelection(-12));
    el.octUp.addEventListener("click", () => transposeSelection(12));
    el.fit.addEventListener("click", fitSelection);
    el.presets.forEach((button) => button.addEventListener("click", () => setQuality(button.dataset.quality)));
    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^(input|select|textarea)$/i.test(event.target?.tagName || "")) return;
      const key = event.key.toLowerCase();
      const index = KEY_SEQUENCE.indexOf(key);
      if (index < 0) return;
      event.preventDefault();
      toggleNote(currentRange()[0] + index);
    });
  }

  async function init() {
    try {
      const response = await fetch(`${MANIFEST_URL}?v=2`);
      if (!response.ok) throw new Error("Could not load Minecraft samples");
      const manifest = await response.json();
      state.sampleVersion = manifest.version || 1;
      state.instruments = manifest.instruments;
      populateInstruments();
      const harpIndex = state.instruments.findIndex((instrument) => instrument.slug === "harp");
      if (harpIndex >= 0) el.instrument.value = String(harpIndex);
      seedChord();
      buildKeyboard();
      wire();
      setMode("build");
      updateReadout();
    } catch (error) {
      el.status.textContent = error.message || String(error);
    }
  }

  init();
})();
