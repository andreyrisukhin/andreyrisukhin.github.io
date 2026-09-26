/*
 * Lightweight playback for OSMD-rendered scores.
 *
 * - Walks the loaded OSMD Sheet once to build a flat note-event schedule.
 * - Synthesizes audio via the already-vendored soundfont-player
 *   (assets/js/vendor/soundfont-player.min.js).
 * - Moves a smooth playhead (playhead.js) from the audio clock.
 * - Renders a transport bar above the score: play/pause, restart, a
 *   measure ruler for seeking, and sound selection.
 * - On coarse-pointer devices, double-tap any chord/measure seeks the
 *   playhead there.
 *
 * Depends on: window.opensheetmusicdisplay, window.Soundfont, window.MusicAudio,
 *             window.__sheetMusic (assets/js/sheet-music/osmd-bridge.js).
 */

(function () {
  if (!window.__sheetMusic) return;
  const bridge = window.__sheetMusic;

  // Wait for OSMD to register the loaded instance with the bridge.
  Promise.resolve(bridge.readyPromise || bridge).then(init);

  function init() {
    const osmd = bridge.osmd;
    const container = bridge.container;
    if (!osmd || !container) return;
    if (!window.Soundfont) {
      console.warn("[playback] Soundfont (soundfont-player) not loaded");
      return;
    }

    const sheetPage = container.closest(".sheet-music-page");
    const renderedPlayback =
      sheetPage && sheetPage.dataset.renderedAudioUrl && sheetPage.dataset.timingUrl
        ? {
            label: sheetPage.dataset.renderedLabel || "Strings file",
            audioUrl: sheetPage.dataset.renderedAudioUrl,
            timingUrl: sheetPage.dataset.timingUrl,
          }
        : null;

    const requestedInstrument = sheetPage && sheetPage.dataset.playbackInstrument;
    const instrumentName = INSTRUMENT_CHOICES.some(([value]) => value === requestedInstrument) ? requestedInstrument : "church_organ";
    const engine = new PlaybackEngine(osmd, renderedPlayback, instrumentName);
    window.__playback = engine; // expose for DevTools poking
    console.log(
      "[playback] schedule built: events=%d, measures=%d, totalSec=%.2f, bpm=%d",
      engine.events.length,
      engine.measureCount,
      engine.totalSec,
      engine.bpm
    );
    if (engine.events.length) {
      const sample = engine.events.slice(0, 6).map((ev) => `midi=${ev.midi}@${ev.startSec.toFixed(2)}s/${ev.durationSec.toFixed(2)}s`);
      console.log("[playback] first events:", sample.join("  "));
      const uniqueStartTimes = new Set(engine.events.map((e) => Math.round(e.startSec * 1000)));
      console.log("[playback] %d distinct start times across %d events", uniqueStartTimes.size, engine.events.length);
      // expose helpers for manual probing
      window.__playbackTest = (n = 5) => {
        if (!engine.audioCtx || !engine.instrument) {
          console.warn("[playbackTest] audio not initialized; click play once first");
          return;
        }
        const now = engine.audioCtx.currentTime;
        for (let i = 0; i < n; i++) {
          engine.instrument.play(60 + i, now + i * 0.4, { duration: 0.35, gain: 2 });
        }
        console.log("[playbackTest] scheduled %d ascending notes", n);
      };
    }
    if (!engine.events.length) {
      console.warn("[playback] no notes scheduled; UI suppressed");
      return;
    }
    new PlaybackUI(container, engine);

    const playhead = window.SheetPlayhead ? new window.SheetPlayhead.Playhead(osmd) : null;
    if (playhead) {
      let shown = false;
      const rebuild = () => {
        playhead.rebuild(engine.measureStarts, engine.totalSec);
        if (shown) playhead.render(engine.currentSec());
      };
      const retime = () => {
        playhead.retime(engine.measureStarts, engine.totalSec);
        if (shown) playhead.render(engine.currentSec());
      };
      rebuild();
      container.addEventListener("sheet-render", rebuild);
      engine.on("timingchange", retime);
      engine.on("modechange", retime);
      engine.on("time", (sec) => {
        shown = true;
        playhead.render(sec, { follow: engine.state === "playing" });
      });
    }

    document.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      // Let focused buttons and links handle Space themselves.
      if (t instanceof Element && t.closest("button, a, [contenteditable]")) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (engine.mode === "live") engine.primeAudio();
        engine.toggle();
      }
    });
  }

  const INSTRUMENT_CHOICES = [
    ["church_organ", "Church organ"],
    ["drawbar_organ", "Drawbar organ"],
    ["reed_organ", "Reed organ"],
    ["accordion", "Accordion"],
    ["harmonica", "Harmonica"],
    ["tango_accordion", "Tango accordion"],
    ["acoustic_grand_piano", "Grand piano"],
    ["bright_acoustic_piano", "Bright piano"],
    ["electric_piano_1", "Electric piano"],
    ["harpsichord", "Harpsichord"],
    ["celesta", "Celesta"],
    ["music_box", "Music box"],
    ["string_ensemble_1", "Strings"],
    ["choir_aahs", "Choir"],
    ["flute", "Flute"],
    ["clarinet", "Clarinet"],
    ["oboe", "Oboe"],
    ["bassoon", "Bassoon"],
    ["violin", "Violin"],
    ["cello", "Cello"],
  ];

  const CLICK_MODE_KEY = "sheet-playback-click-seek";
  // ── Engine ─────────────────────────────────────────────────────────
  function PlaybackEngine(osmd, renderedPlayback, instrumentName) {
    const self = this;
    self.osmd = osmd;
    self.renderedPlayback = renderedPlayback;
    self.audioCtx = null;
    self.audioEl = null;
    self.instrument = null;
    self.instrumentName = instrumentName || "church_organ";
    self.mode = renderedPlayback ? "rendered" : "live";
    self.renderedReady = false;
    self.renderedLoadPromise = null;
    self.events = [];
    self.scoreBpm = 120;
    self.bpm = 120;
    self.playheadSec = 0;
    self.startedAtCtxTime = 0;
    self.totalSec = 0;
    self.measureCount = 0;
    self.measureStarts = [];
    self.liveMeasureStarts = [];
    self.liveTotalSec = 0;
    self.renderedMeasureStarts = [];
    self.renderedTotalSec = 0;
    self.state = "paused";
    self.listeners = {};

    self.on = (event, fn) => {
      (self.listeners[event] = self.listeners[event] || []).push(fn);
    };
    self._emit = (event, ...args) => {
      (self.listeners[event] || []).forEach((fn) => fn(...args));
    };

    // Synchronously create + resume the AudioContext. MUST be invoked
    // from a real user-gesture handler (Safari refuses to resume an
    // AudioContext that was first touched after an await). Returns the
    // context so the caller can verify state if it cares.
    self.primeAudio = function () {
      if (window.MusicAudio) {
        return window.MusicAudio.ensureContext(self, "audioCtx");
      }
      if (!self.audioCtx) {
        self.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (self.audioCtx.state === "suspended") {
        const r = self.audioCtx.resume();
        if (r && typeof r.then === "function") r.catch((err) => console.warn("[playback] resume failed", err));
      }
      return self.audioCtx;
    };

    self.toggle = function () {
      if (self.state === "playing") self.pause();
      else self.play();
    };

    self.setInstrumentName = function (name) {
      if (!name || name === self.instrumentName) return;
      const wasPlaying = self.state === "playing";
      if (wasPlaying) self.pause();
      try {
        self.instrument && self.instrument.stop();
      } catch (_) {}
      self.instrumentName = name;
      self.instrument = null;
      self._emit("instrumentchange", name);
      self.setMode("live", { preservePlayback: false });
      if (wasPlaying) self.play();
    };

    self.setMode = function (mode, opts = {}) {
      if (mode !== "rendered" && mode !== "live") return;
      if (mode === "rendered" && !self.renderedPlayback) return;
      if (mode === self.mode) return;
      const wasPlaying = self.state === "playing";
      if (wasPlaying) self.pause();
      self.mode = mode;
      if (mode === "live") {
        self._silenceRendered();
        self.measureStarts = self.liveMeasureStarts;
        self.totalSec = self.liveTotalSec;
      } else {
        self._silenceLive();
        self._loadRenderedTiming().catch((err) => self._emit("loaderror", err));
        if (self.renderedMeasureStarts.length) {
          self.measureStarts = self.renderedMeasureStarts;
          self.totalSec = self.renderedTotalSec;
        }
      }
      self._emit("modechange", mode);
      if (wasPlaying && opts.preservePlayback !== false) self.play();
    };

    self.play = async function () {
      if (self.state === "playing") return;
      try {
        if (self.mode === "rendered") await self._ensureRenderedAudio();
        else await self._ensureAudio();
      } catch (err) {
        console.warn("[playback] audio load failed", err);
        self._emit("loaderror", err);
        return;
      }
      self.state = "playing";
      self._clockSample = null;
      self._emit("statechange", "playing");
      if (self.mode === "rendered") {
        self._silenceLive();
        self.audioEl.currentTime = Math.min(self.playheadSec, Math.max(0, self.audioEl.duration || self.totalSec));
        try {
          await self.audioEl.play();
        } catch (err) {
          self.state = "paused";
          self._emit("statechange", "paused");
          self._emit("loaderror", err);
          return;
        }
        self._tick();
        return;
      }
      self._silenceRendered();
      self.startedAtCtxTime = self.audioCtx.currentTime;
      // Rolling-lookahead scheduler. Front-loading every instrument.play()
      // saturates soundfont-player's voice pool after ~5s; instead we
      // schedule a small window (LOOKAHEAD_SEC) every SCHEDULER_INTERVAL_MS
      // from a setInterval so the live thread keeps fresh BufferSourceNodes
      // coming.
      self._nextEventIdx = self._findFirstEventIdx(self.playheadSec);
      self._scheduleTick();
      self._schedulerTimer = setInterval(self._scheduleTick, self.SCHEDULER_INTERVAL_MS);
      self._tick();
    };

    self.LOOKAHEAD_SEC = 0.25;
    self.SCHEDULER_INTERVAL_MS = 100;

    self._findFirstEventIdx = function (cutoffSec) {
      // binary search for first event with startSec >= cutoffSec
      const ev = self.events;
      let lo = 0;
      let hi = ev.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ev[mid].startSec < cutoffSec - 0.001) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    self._scheduleTick = function () {
      if (self.state !== "playing" || !self.instrument || !self.audioCtx) return;
      const ctx = self.audioCtx;
      const t0 = self.startedAtCtxTime - self.playheadSec;
      const horizonSec = ctx.currentTime - self.startedAtCtxTime + self.playheadSec + self.LOOKAHEAD_SEC;
      const safety = 0.02;
      const ev = self.events;
      const len = ev.length;
      while (self._nextEventIdx < len) {
        const e = ev[self._nextEventIdx];
        if (e.startSec > horizonSec) break;
        const when = Math.max(ctx.currentTime + safety, t0 + e.startSec);
        try {
          self.instrument.play(e.midi, when, {
            duration: e.durationSec * 0.95,
            gain: 2.0,
          });
        } catch (_) {}
        self._nextEventIdx++;
      }
    };

    self._stopScheduler = function () {
      if (self._schedulerTimer) {
        clearInterval(self._schedulerTimer);
        self._schedulerTimer = null;
      }
    };

    self._silenceLive = function () {
      self._stopScheduler();
      if (window.MusicAudio) {
        window.MusicAudio.stopInstrument(self.instrument);
        window.MusicAudio.closeContext(self, "audioCtx");
      } else {
        try {
          self.instrument && self.instrument.stop();
        } catch (_) {}
        if (self.audioCtx && self.audioCtx.state !== "closed") {
          self.audioCtx.close().catch(() => {});
        }
        self.audioCtx = null;
      }
      self.instrument = null;
    };

    self._silenceRendered = function () {
      if (self.audioEl) self.audioEl.pause();
    };

    self.pause = function () {
      if (self.state !== "playing") return;
      if (self.mode === "rendered" && self.audioEl) {
        self.audioEl.pause();
        self.playheadSec = self.audioEl.currentTime || 0;
      } else {
        const elapsed = self.audioCtx.currentTime - self.startedAtCtxTime;
        self.playheadSec = Math.min(self.totalSec, self.playheadSec + elapsed);
      }
      self.state = "paused";
      self._emit("statechange", "paused");
      if (self.mode === "live") self._silenceLive();
    };

    self.stop = function () {
      if (self.audioEl) {
        self.audioEl.pause();
        self.audioEl.currentTime = 0;
      }
      self._silenceLive();
      self.playheadSec = 0;
      self.state = "paused";
      self._emit("statechange", "paused");
      self._emitPosition(0);
    };

    self.seekToMeasure = function (n) {
      const wasPlaying = self.state === "playing";
      if (wasPlaying) self.pause();
      const idx = Math.max(0, Math.min(self.measureStarts.length - 1, (n | 0) - 1));
      self.playheadSec = self.measureStarts[idx] || 0;
      if (self.audioEl) self.audioEl.currentTime = self.playheadSec;
      self._emitPosition(self.playheadSec);
      if (wasPlaying) self.play();
    };

    self.currentSec = function () {
      if (self.state !== "playing") return self.playheadSec;
      let raw;
      if (self.mode === "rendered" && self.audioEl) raw = self.audioEl.currentTime || 0;
      else if (self.audioCtx) raw = self.playheadSec + (self.audioCtx.currentTime - self.startedAtCtxTime);
      else return self.playheadSec;
      return self._smoothClock(raw);
    };

    // AudioContext.currentTime and <audio>.currentTime advance in coarse
    // steps (audio render quanta, media timeupdate), so several frames can
    // read the same value. Extrapolate from the last change with the frame
    // clock so the playhead keeps moving between steps.
    self._clockSample = null;
    self._smoothClock = function (raw) {
      const now = performance.now();
      const last = self._clockSample;
      if (!last || raw !== last.raw || now - last.at > 250) {
        self._clockSample = { raw, at: now };
        return raw;
      }
      return raw + (now - last.at) / 1000;
    };

    // "time" fires every frame for the playhead and progress line;
    // "positionchange" fires only when the measure changes.
    self._lastMeasure = 0;
    self._emitPosition = function (sec) {
      self._emit("time", sec);
      const m = self._measureAtSec(sec);
      if (m !== self._lastMeasure) {
        self._lastMeasure = m;
        self._emit("positionchange", m);
      }
    };

    self.seekAtPagePoint = function (pageX, pageY, target) {
      const hit = bridge.resolveNoteAt(pageX, pageY, 180, target);
      if (!hit || hit.measureNumber == null) return false;
      self.seekToMeasure(hit.measureNumber);
      return true;
    };

    self._tick = function () {
      if (self.state !== "playing") return;
      const nowSec = self.currentSec();
      if (nowSec >= self.totalSec || (self.mode === "rendered" && self.audioEl && self.audioEl.ended)) {
        self._stopScheduler();
        self.state = "paused";
        self.playheadSec = 0;
        if (self.audioEl) self.audioEl.currentTime = 0;
        self._emit("statechange", "paused");
        self._emit("end");
        self._emitPosition(0);
        return;
      }
      self._emitPosition(nowSec);
      requestAnimationFrame(self._tick);
    };

    self._measureAtSec = function (sec) {
      let m = 1;
      for (let i = 0; i < self.measureStarts.length; i++) {
        if (self.measureStarts[i] <= sec) m = i + 1;
        else break;
      }
      return m;
    };

    self._ensureAudio = async function () {
      if (window.MusicAudio) {
        self.audioCtx = window.MusicAudio.ensureContext(self, "audioCtx");
      } else {
        if (!self.audioCtx) {
          self.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (self.audioCtx.state === "suspended") await self.audioCtx.resume();
      }
      if (!self.instrument) {
        self._emit("loadingchange", true);
        try {
          if (window.MusicAudio) {
            self.instrument = await window.MusicAudio.loadSoundfont(self, {
              contextKey: "audioCtx",
              instrumentKey: "instrument",
              loadingKey: "instrumentLoading",
              failedKey: "instrumentFailed",
              name: self.instrumentName,
              soundfont: "MusyngKite",
            });
          } else {
            self.instrument = await window.Soundfont.instrument(self.audioCtx, self.instrumentName, {
              soundfont: "MusyngKite",
            });
          }
          if (!self.instrument) throw new Error("Soundfont instrument unavailable");
        } finally {
          self._emit("loadingchange", false);
        }
      }
    };

    self._loadRenderedTiming = async function () {
      if (self.renderedReady) return;
      if (self.renderedLoadPromise) return self.renderedLoadPromise;
      if (!self.renderedPlayback) throw new Error("Rendered playback is not configured for this score");
      self.renderedLoadPromise = fetch(self.renderedPlayback.timingUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Timing map failed: ${res.status}`);
          return res.json();
        })
        .then((timing) => {
          const measures = Array.isArray(timing.measures) ? timing.measures : [];
          if (!measures.length) throw new Error("Timing map has no measures");
          self.renderedMeasureStarts = measures.map((m) => Number(m.startSec) || 0);
          self.measureCount = timing.measureCount || measures.length;
          self.renderedTotalSec = Number(timing.audioDurationSec || timing.scoreEndSec || self.totalSec);
          if (self.mode === "rendered") {
            self.measureStarts = self.renderedMeasureStarts;
            self.totalSec = self.renderedTotalSec;
          }
          self.renderedReady = true;
          self._emit("timingchange");
        });
      return self.renderedLoadPromise;
    };

    self._ensureRenderedAudio = async function () {
      await self._loadRenderedTiming();
      if (!self.audioEl) {
        self.audioEl = new Audio(self.renderedPlayback.audioUrl);
        self.audioEl.preload = "auto";
        self.audioEl.addEventListener("ended", () => {
          if (self.state !== "playing") return;
          self.state = "paused";
          self.playheadSec = 0;
          self.audioEl.currentTime = 0;
          self._emit("statechange", "paused");
          self._emitPosition(0);
        });
      }
    };

    self._buildSchedule = function () {
      const sheet = self.osmd.Sheet || self.osmd.sheet;
      if (!sheet) return;
      const measures = sheet.SourceMeasures || sheet.sourceMeasures;
      if (!measures || !measures.length) {
        console.warn("[playback] no SourceMeasures on Sheet", sheet);
        return;
      }
      const scoreBpm = (sheet.HasBPMInfo && sheet.DefaultStartTempoInBpm) || sheet.DefaultStartTempoInBpm || sheet.defaultStartTempoInBpm || 120;
      self.scoreBpm = scoreBpm || 120;
      const bpm = self.bpm || self.scoreBpm;
      self.bpm = bpm;
      const quarterDur = 60 / bpm;
      const events = [];
      const measureStarts = [];
      let t = 0;
      let degradeCount = 0;
      for (const measure of measures) {
        measureStarts.push(t);
        const containers = measure.VerticalSourceStaffEntryContainers || measure.verticalSourceStaffEntryContainers || [];
        for (const c of containers) {
          // OSMD exposes both PascalCase and camelCase getters depending
          // on build; try both before giving up and stacking at t.
          const ts = c.Timestamp || c.timestamp;
          const tsBeats =
            ts && typeof ts.RealValue === "number"
              ? ts.RealValue * 4
              : ts && typeof ts.realValue === "number"
                ? ts.realValue * 4
                : (degradeCount++, 0);
          const startSec = t + tsBeats * quarterDur;
          const staffEntries = c.StaffEntries || c.staffEntries || [];
          for (const sse of staffEntries) {
            if (!sse) continue;
            const voiceEntries = sse.VoiceEntries || sse.voiceEntries || [];
            for (const ve of voiceEntries) {
              const notes = ve.Notes || ve.notes || [];
              for (const note of notes) {
                if (!note) continue;
                const isRest = note.isRestFlag === true || note.IsRestFlag === true || (typeof note.isRest === "function" && note.isRest());
                if (isRest) continue;
                const pitch = note.Pitch || note.pitch;
                if (!pitch) continue;
                const midi = noteToMidi(pitch);
                if (midi == null) continue;
                const len = note.Length || note.length;
                const lenBeats =
                  len && typeof len.RealValue === "number" ? len.RealValue * 4 : len && typeof len.realValue === "number" ? len.realValue * 4 : 1;
                events.push({
                  midi,
                  startSec,
                  durationSec: Math.max(0.05, lenBeats * quarterDur),
                });
              }
            }
          }
        }
        const dur = measure.Duration || measure.duration;
        const measureDurBeats =
          dur && typeof dur.RealValue === "number" ? dur.RealValue * 4 : dur && typeof dur.realValue === "number" ? dur.realValue * 4 : 4;
        t += measureDurBeats * quarterDur;
      }
      if (degradeCount > 0) {
        console.warn("[playback] %d containers had no usable Timestamp; events stacked at measure start", degradeCount);
      }
      self.events = events.sort((a, b) => a.startSec - b.startSec);
      self.measureStarts = measureStarts;
      self.totalSec = t;
      self.liveMeasureStarts = measureStarts;
      self.liveTotalSec = t;
      self.measureCount = measures.length;
    };

    self._buildSchedule();
    if (self.renderedPlayback) {
      self._loadRenderedTiming().catch((err) => {
        console.warn("[playback] rendered timing unavailable; falling back to live synth", err);
        self.mode = "live";
        self._emit("modechange", "live");
      });
    }
  }

  function noteToMidi(pitch) {
    try {
      if (typeof pitch.getHalfTone === "function") {
        return pitch.getHalfTone() + 12;
      }
      const semitone = (pitch.FundamentalNote || 0) + (pitch.AccidentalHalfTones || 0);
      const notationOctave = (pitch.Octave || 0) + 3;
      return (notationOctave + 1) * 12 + semitone;
    } catch (_) {
      return null;
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a.5.5 0 0 0 .76.43l10.4-6.5a.5.5 0 0 0 0-.86L8.76 5.07A.5.5 0 0 0 8 5.5z"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    restart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 6.1v11.8a.5.5 0 0 1-.78.41L9.6 12.41a.5.5 0 0 1 0-.82l8.62-5.9a.5.5 0 0 1 .78.41z"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="10.75" y="5" width="2.5" height="9" rx="1"/><circle cx="12" cy="18" r="1.5"/></svg>',
  };

  function PlaybackUI(container, engine) {
    const root = document.createElement("div");
    root.className = "sheet-transport";
    root.setAttribute("data-sheet-playback", "");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Playback");
    const count = engine.measureCount;
    root.innerHTML = `
      <button type="button" class="sheet-transport__btn sheet-transport__play" data-pb-action="toggle" aria-label="Play">${ICONS.play}</button>
      <button type="button" class="sheet-transport__btn" data-pb-action="reset" aria-label="Back to start" title="Back to start">${
        ICONS.restart
      }</button>
      <div class="sheet-transport__track" data-pb-seek role="slider" tabindex="0" aria-label="Measure"
        aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="1" aria-valuetext="Measure 1 of ${count}">
        <span class="sheet-transport__line"></span>
        <span class="sheet-transport__band" data-pb-band></span>
        <span class="sheet-transport__ticks" data-pb-ticks></span>
        <span class="sheet-transport__progress" data-pb-progress></span>
      </div>
      <span class="sheet-transport__pos" data-pb-pos aria-hidden="true">m. 1 of ${count}</span>
      ${
        engine.renderedPlayback
          ? `<label class="sheet-transport__select">
              <span>Audio</span>
              <select data-pb-mode>
                <option value="rendered">${engine.renderedPlayback.label}</option>
                <option value="live">Live sound</option>
              </select>
            </label>`
          : ""
      }
      <label class="sheet-transport__select">
        <span>Sound</span>
        <select data-pb-instrument>
          ${INSTRUMENT_CHOICES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="sheet-transport__toggle" data-pb-click-seek aria-pressed="false">Click score to jump</button>
    `;
    const host = container.parentElement || container;
    host.insertBefore(root, container);

    const playBtn = root.querySelector('[data-pb-action="toggle"]');
    const resetBtn = root.querySelector('[data-pb-action="reset"]');
    const track = root.querySelector("[data-pb-seek]");
    const band = root.querySelector("[data-pb-band]");
    const ticks = root.querySelector("[data-pb-ticks]");
    const progress = root.querySelector("[data-pb-progress]");
    const posLabel = root.querySelector("[data-pb-pos]");
    const mode = root.querySelector("[data-pb-mode]");
    const instrument = root.querySelector("[data-pb-instrument]");
    const clickSeek = root.querySelector("[data-pb-click-seek]");
    let measure = 1;

    const setIcon = (name, label) => {
      playBtn.innerHTML = ICONS[name];
      if (label) playBtn.setAttribute("aria-label", label);
    };
    const setClickSeek = (on) => {
      clickSeek.setAttribute("aria-pressed", String(on));
      try {
        localStorage.setItem(CLICK_MODE_KEY, on ? "1" : "0");
      } catch (_) {}
    };
    const clickSeekOn = () => clickSeek.getAttribute("aria-pressed") === "true";

    // Barline ticks sit at each measure's start time, so uneven measures
    // (pickups, meter changes, rendered audio) keep true proportions.
    const renderTicks = () => {
      const total = engine.totalSec || 1;
      const starts = engine.measureStarts;
      const marks = starts.slice(1).map((sec, i) => {
        const phrase = (i + 1) % 4 === 0 ? " sheet-transport__tick--phrase" : "";
        return `<span class="sheet-transport__tick${phrase}" style="left:${((sec / total) * 100).toFixed(3)}%"></span>`;
      });
      marks.push('<span class="sheet-transport__tick sheet-transport__tick--final" style="left:100%"></span>');
      ticks.innerHTML = marks.join("");
      track.setAttribute("aria-valuemax", String(engine.measureCount));
    };
    const renderMeasure = (m) => {
      measure = m;
      const total = engine.totalSec || 1;
      const start = engine.measureStarts[m - 1] || 0;
      const end = m < engine.measureStarts.length ? engine.measureStarts[m] : total;
      band.style.left = `${((start / total) * 100).toFixed(3)}%`;
      band.style.width = `${(((end - start) / total) * 100).toFixed(3)}%`;
      posLabel.textContent = `m. ${m} of ${engine.measureCount}`;
      track.setAttribute("aria-valuenow", String(m));
      track.setAttribute("aria-valuetext", `Measure ${m} of ${engine.measureCount}`);
    };
    const renderTime = (sec) => {
      const ratio = engine.totalSec ? Math.min(1, Math.max(0, sec / engine.totalSec)) : 0;
      progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };

    renderTicks();
    renderMeasure(1);
    if (mode) mode.value = engine.mode;
    instrument.value = engine.instrumentName;
    instrument.disabled = engine.mode === "rendered";
    try {
      clickSeek.setAttribute("aria-pressed", String(localStorage.getItem(CLICK_MODE_KEY) === "1"));
    } catch (_) {}

    playBtn.addEventListener("click", () => {
      // Must prime AudioContext inside the user-gesture handler so
      // Safari (and Chrome's autoplay policy) will let it resume.
      if (engine.mode === "live") engine.primeAudio();
      engine.toggle();
    });
    resetBtn.addEventListener("click", () => engine.stop());
    if (mode) mode.addEventListener("change", () => engine.setMode(mode.value));
    instrument.addEventListener("change", () => engine.setInstrumentName(instrument.value));
    clickSeek.addEventListener("click", () => setClickSeek(!clickSeekOn()));

    const measureAtClientX = (clientX) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
      return engine._measureAtSec(ratio * engine.totalSec - 1e-6);
    };
    let dragging = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      track.setPointerCapture(e.pointerId);
      engine.seekToMeasure(measureAtClientX(e.clientX));
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const m = measureAtClientX(e.clientX);
      if (m !== measure) engine.seekToMeasure(m);
    });
    const endDrag = () => {
      dragging = false;
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("keydown", (e) => {
      const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
      let target = null;
      if (e.key in steps) target = measure + steps[e.key];
      else if (e.key === "Home") target = 1;
      else if (e.key === "End") target = engine.measureCount;
      if (target == null) return;
      e.preventDefault();
      engine.seekToMeasure(Math.max(1, Math.min(engine.measureCount, target)));
    });

    container.addEventListener(
      "click",
      (e) => {
        if (!clickSeekOn()) return;
        if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        const target = e.target instanceof Element ? e.target : null;
        if (!target || target.closest("[data-sheet-annotator], [data-sheet-playback], [data-chord-tag], [data-chord-inspector]")) return;
        if (!engine.seekAtPagePoint(e.pageX, e.pageY, target)) return;
        window.__suppressInspectorTap = Date.now() + 600;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    engine.on("statechange", (state) => {
      const playing = state === "playing";
      playBtn.classList.remove("is-error");
      playBtn.removeAttribute("title");
      setIcon(playing ? "pause" : "play", playing ? "Pause" : "Play");
      root.classList.toggle("is-playing", playing);
    });
    engine.on("time", renderTime);
    engine.on("positionchange", renderMeasure);
    engine.on("modechange", (nextMode) => {
      if (mode) mode.value = nextMode;
      instrument.disabled = nextMode === "rendered";
      renderTicks();
      renderMeasure(Math.min(measure, engine.measureCount));
    });
    engine.on("timingchange", () => {
      renderTicks();
      renderMeasure(Math.min(measure, engine.measureCount));
    });
    engine.on("loadingchange", (loading) => {
      playBtn.classList.toggle("is-loading", loading);
      playBtn.setAttribute("aria-busy", String(loading));
    });
    engine.on("loaderror", () => {
      setIcon("error", "Sound failed to load");
      playBtn.title = "The sound could not load. Check your connection, then press again.";
      playBtn.classList.add("is-error");
    });

    // Double-tap-on-score → seek playhead. Coarse-pointer only; on
    // desktop we'd collide with double-click text-selection patterns.
    let lastTap = null;
    container.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length !== 1) {
          lastTap = null;
          return;
        }
        const t = e.changedTouches[0];
        const now = Date.now();
        const point = { x: t.clientX, y: t.clientY, time: now };
        if (lastTap && now - lastTap.time < 350 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 30) {
          e.preventDefault();
          const pageX = t.clientX + window.scrollX;
          const pageY = t.clientY + window.scrollY;
          const target = document.elementFromPoint(t.clientX, t.clientY);
          const hit = bridge.resolveNoteAt(pageX, pageY, 80, target);
          if (hit && hit.measureNumber != null) {
            engine.seekToMeasure(hit.measureNumber);
            window.__suppressInspectorTap = Date.now() + 600;
          }
          lastTap = null;
        } else {
          lastTap = point;
        }
      },
      { passive: false }
    );
  }
})();
