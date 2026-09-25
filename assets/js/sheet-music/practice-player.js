/* One cancellable transport for the recording and tempo-aware live notes. */
window.SheetPracticePlayer = (function () {
  "use strict";
  function create(score, options = {}) {
    let mode = options.audioUrl ? "recording" : "live";
    let rate = 1;
    let position = 0;
    let state = "paused";
    let loop = { enabled: false, start: 1, end: Math.min(4, score.starts.length) };
    let context, instrument, instrumentPromise, audio, recording, timingPromise, audioPromise, audioUrl;
    let disposed = false;
    let instrumentName = "accordion";
    let origin = 0;
    let timer, frame;
    let ticket = 0;
    let nextEvent = 0;
    const listeners = new Set();
    const map = () => (mode === "recording" && recording ? recording : score);
    const measureAt = (time) => {
      let index = 0;
      while (index + 1 < map().starts.length && map().starts[index + 1] <= time + 0.00001) index++;
      return index + 1;
    };
    const now = () =>
      state !== "playing" ? position : mode === "recording" ? audio.currentTime : position + Math.max(0, context.currentTime - origin) * rate;
    const bounds = () => (loop.enabled ? { start: map().starts[loop.start - 1], end: map().ends[loop.end - 1] } : { start: 0, end: map().duration });
    const snapshot = () => ({
      state,
      mode,
      rate,
      loop: { ...loop },
      measure: measureAt(now()),
      count: score.starts.length,
      instrument: instrumentName,
    });
    const emit = (message = "") => listeners.forEach((listener) => listener(snapshot(), message));
    const cancelClock = () => {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      timer = frame = null;
    };
    function silence() {
      cancelClock();
      audio?.pause();
      window.MusicAudio.stopInstrument(instrument);
    }
    function pause() {
      const time = now();
      ticket++;
      silence();
      position = Math.max(0, Math.min(map().duration, time));
      state = "paused";
      emit();
    }
    function place(time) {
      position = Math.max(0, Math.min(map().duration, time));
      if (audio && mode === "recording") audio.currentTime = position;
      options.onCursor?.(measureAt(position));
    }
    function ensureContext() {
      if (!context || context.state === "closed") context = new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === "suspended") context.resume().catch(() => {});
    }
    async function ensureRecording() {
      if (!timingPromise) {
        timingPromise = fetch(options.timingUrl)
          .then((response) => {
            if (!response.ok) throw new Error("Recording timing could not be loaded.");
            return response.json();
          })
          .then((timing) => {
            recording = window.SheetPracticeTimeline.renderedMap(timing, score.starts.length);
          })
          .catch((error) => {
            timingPromise = null;
            throw error;
          });
      }
      await timingPromise;
      if (!audioPromise) {
        // A complete blob remains seekable even offline or behind a static
        // server/service worker that cannot answer HTTP Range requests.
        audioPromise = fetch(options.audioUrl)
          .then((response) => {
            if (!response.ok || response.status === 206) throw new Error("The full recording could not be loaded.");
            return response.blob();
          })
          .then(async (blob) => {
            if (disposed) throw new Error("Player closed.");
            audioUrl = URL.createObjectURL(blob);
            audio = new Audio(audioUrl);
            audio.preload = "auto";
            audio.preservesPitch = true;
            audio.addEventListener("ended", tick);
            if (audio.readyState < 1)
              await new Promise((resolve, reject) => {
                audio.addEventListener("loadedmetadata", resolve, { once: true });
                audio.addEventListener("error", () => reject(new Error("Recording could not be decoded.")), { once: true });
              });
          })
          .catch((error) => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audio = audioPromise = audioUrl = null;
            throw error;
          });
      }
      await audioPromise;
    }
    async function ensureInstrument() {
      ensureContext();
      if (!instrumentPromise) {
        const name = instrumentName;
        instrumentPromise = window.Soundfont.instrument(context, name, { soundfont: "MusyngKite" });
        instrumentPromise.catch(() => {
          if (name === instrumentName) instrumentPromise = null;
        });
      }
      return instrumentPromise;
    }
    function schedule(event, start, end) {
      if (end <= start) return;
      instrument.play(event.midi, Math.max(context.currentTime, origin + (start - position) / rate), {
        duration: (end - start) / rate,
        gain: 1,
      });
    }
    function scheduleAhead() {
      if (state !== "playing" || mode !== "live") return;
      const horizon = now() + 0.2 * rate;
      const end = bounds().end;
      while (nextEvent < score.events.length) {
        const event = score.events[nextEvent];
        if (event.start >= end || event.start > horizon) break;
        schedule(event, event.start, Math.min(event.end, end));
        nextEvent++;
      }
    }
    function beginLive() {
      origin = context.currentTime + 0.025;
      nextEvent = score.events.findIndex((event) => event.start >= position - 0.00001);
      if (nextEvent < 0) nextEvent = score.events.length;
      // Resume a sustained/tied note without replaying the notes before it.
      score.events.forEach((event) => {
        if (event.start < position - 0.00001 && event.end > position) schedule(event, position, Math.min(event.end, bounds().end));
      });
      scheduleAhead();
    }
    function tick() {
      if (state !== "playing") return;
      const time = now();
      if (time >= bounds().end || (mode === "recording" && audio.ended)) {
        if (!loop.enabled) {
          pause();
          place(0);
          emit();
          return;
        }
        window.MusicAudio.stopInstrument(instrument);
        place(bounds().start);
        if (mode === "live") beginLive();
        else if (audio.paused)
          audio.play().catch(() => {
            pause();
            emit("Playback stopped. Press Play to retry.");
          });
      }
      options.onCursor?.(measureAt(now()));
      emit();
    }
    function animate() {
      tick();
      if (state === "playing") frame = requestAnimationFrame(animate);
    }
    async function play() {
      if (disposed || state === "playing" || state === "loading") return;
      window.WorkbenchPlayer?.stop();
      if (mode === "live") ensureContext();
      const request = ++ticket;
      const currentMeasure = measureAt(position);
      const fraction = (position - map().starts[currentMeasure - 1]) / (map().ends[currentMeasure - 1] - map().starts[currentMeasure - 1]);
      state = "loading";
      emit();
      try {
        if (mode === "recording") await ensureRecording();
        else {
          const loaded = await ensureInstrument();
          if (request !== ticket) return;
          instrument = loaded;
        }
        if (request !== ticket) return;
        place(map().starts[currentMeasure - 1] + fraction * (map().ends[currentMeasure - 1] - map().starts[currentMeasure - 1]));
        if (position < bounds().start || position >= bounds().end) place(bounds().start);
        if (mode === "recording") {
          audio.playbackRate = rate;
          await audio.play();
          if (request !== ticket) return;
        }
        state = "playing";
        if (mode === "live") beginLive();
        timer = setInterval(() => {
          tick();
          scheduleAhead();
        }, 25);
        animate();
      } catch (_) {
        if (request !== ticket) return;
        pause();
        emit(
          mode === "recording"
            ? "Recording unavailable. Try Live sound, or retry when online."
            : "Live sound could not load. Check your connection and try again."
        );
      }
    }
    function change(action, resume = true) {
      const playing = state === "playing";
      pause();
      action();
      emit();
      if (playing && resume) play();
    }
    function seek(measure) {
      if (!Number.isInteger(measure) || measure < 1 || measure > score.starts.length) return false;
      change(() => {
        if (loop.enabled && (measure < loop.start || measure > loop.end)) loop.enabled = false;
        place(map().starts[measure - 1]);
      });
      return true;
    }
    function setLoop(start, end, enabled) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > score.starts.length || start > end) return false;
      change(() => {
        loop = { start, end, enabled: !!enabled };
        if (loop.enabled && (position < bounds().start || position >= bounds().end)) place(bounds().start);
      });
      return true;
    }
    function setRate(value) {
      if (!Number.isFinite(value) || value < 0.25 || value > 1.5) return false;
      change(() => {
        rate = value;
      });
      return true;
    }
    function setMode(value) {
      if (!["recording", "live"].includes(value) || (value === "recording" && !options.audioUrl) || value === mode) return;
      const measure = measureAt(now());
      change(() => {
        mode = value;
        place(map().starts[measure - 1]);
      }, false);
    }
    function setInstrument(value) {
      if (!["accordion", "church_organ", "acoustic_grand_piano", "string_ensemble_1"].includes(value)) return;
      change(() => {
        instrumentName = value;
        instrument = instrumentPromise = null;
      });
    }
    return {
      play,
      pause,
      seek,
      setLoop,
      setRate,
      setMode,
      setInstrument,
      snapshot,
      toggle: () => (state === "paused" ? play() : pause()),
      restart: () => {
        pause();
        place(bounds().start);
        emit();
      },
      subscribe: (listener) => {
        listeners.add(listener);
        listener(snapshot());
        return () => listeners.delete(listener);
      },
      dispose: () => {
        pause();
        disposed = true;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        context?.close().catch(() => {});
        listeners.clear();
      },
    };
  }
  return { create };
})();
