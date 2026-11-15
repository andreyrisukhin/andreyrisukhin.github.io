/* Shared sheet reader controller. The transport never owns audio or score timing. */
(function () {
  const page = document.querySelector(".sheet-reader");
  const bridge = window.__sheetMusic;
  if (!page || page.dataset.playback !== "true" || !bridge) return;
  const localFile = page.dataset.localFile === "true";
  const stradellaToggle = page.querySelector("[data-practice-stradella]");
  const timestampsToggle = page.querySelector("[data-practice-timestamps]");
  const updateTimestamps = () => {
    page.querySelectorAll(".sheet-measure-times").forEach((layer) => {
      layer.hidden = timestampsToggle ? !timestampsToggle.checked : false;
    });
  };
  timestampsToggle?.addEventListener("change", updateTimestamps);
  // Opened files have no page settings: the reader chooses Stradella playback
  // for each new file, and the toggle or a correction keeps that choice.
  let stradellaChoice = null;
  let dispose = () => {};
  const mount = () => {
    dispose();
    const events = new AbortController();
    let player, controls, playhead, unsubscribe;
    dispose = () => {
      dispose = () => {};
      events.abort();
      unsubscribe?.();
      controls?.dispose();
      player?.dispose();
      playhead?.hide();
      playhead?.el?.remove();
      playhead?.timeLabels?.remove();
      window.SheetReader = null;
      bridge.stradellaReading = null;
    };
    try {
      const osmd = bridge.osmd;
      const timeline = window.SheetPracticeTimeline.fromXML(bridge.xml);
      const profile = window.SheetScore.profileXml(bridge.xml, timeline);
      const detected = localFile && stradellaChoice === null;
      if (detected) stradellaChoice = profile.stradella;
      const stradella = localFile ? stradellaChoice : page.dataset.playbackStradella === "true";
      if (localFile) page.dataset.playbackStradella = String(stradella);
      if (stradellaToggle) stradellaToggle.checked = stradella;
      const score = window.SheetScore.build(osmd, timeline, { stradellaBass: stradella });
      player = window.SheetPracticePlayer.create(score, {
        audioUrl: page.dataset.renderedAudioUrl,
        timingUrl: page.dataset.timingUrl,
        instrument: detected && stradella ? "accordion" : page.dataset.playbackInstrument || "church_organ",
        instruments: window.SheetScore.instruments.map(([name]) => name),
        gain: Number(page.dataset.playbackGain) || 1,
      });
      window.SheetReader = { player, score };
      bridge.stradellaReading = (note) => score.stradellaReadings.get(note) || null;
      const key = window.SheetScore.readScoreKey(osmd, page.dataset.keyMode, { ...profile, infer: localFile });
      controls = window.SheetTransport.mount(page, player, key, bridge);
      playhead = new window.SheetPlayhead.Playhead(osmd);
      let map,
        transpose = 0,
        clock;
      const rebuild = () => {
        const state = player.snapshot();
        playhead.rebuild(state.starts, state.duration);
        updateTimestamps();
        playhead.render(state.time);
      };
      bridge.container.addEventListener("sheet-render", rebuild, { signal: events.signal });
      rebuild();
      unsubscribe = player.subscribe((state) => {
        if (state.transpose !== transpose) {
          transpose = state.transpose;
          if (!osmd.TransposeCalculator) osmd.TransposeCalculator = window.SheetScore.spellingTransposer(window.opensheetmusicdisplay);
          osmd.Sheet.Transpose = transpose;
          window.SheetScore.restoreWrittenKeys(osmd.Sheet);
          osmd.updateGraphic();
          bridge.rerender();
        }
        if (map !== state.starts) {
          map = state.starts;
          playhead.retime(state.starts, state.duration);
        }
        const now = performance.now();
        if (!clock || state.state !== "playing" || state.time !== clock.raw || now - clock.at > 250) clock = { raw: state.time, at: now };
        const time = state.time + (state.state === "playing" ? ((now - clock.at) / 1000) * state.rate : 0);
        playhead.render(time, { follow: state.state === "playing" && controls.follow() });
      });
      document.addEventListener(
        "keydown",
        (event) => {
          if (
            event.defaultPrevented ||
            event.code !== "Space" ||
            event.target.closest("button, input, select, textarea, summary, a, dialog, [role=button], [contenteditable]")
          )
            return;
          event.preventDefault();
          player.toggle();
        },
        { signal: events.signal }
      );
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.hidden) {
            player.pause();
            controls.save();
          }
        },
        { signal: events.signal }
      );
      window.addEventListener(
        "pagehide",
        (event) => {
          player.pause();
          controls.save();
          if (!event.persisted) {
            dispose();
          }
        },
        { signal: events.signal }
      );
      page.dispatchEvent(new CustomEvent("sheet-player-ready"));
    } catch (error) {
      dispose();
      document.getElementById("osmd-status").textContent = "Playback unavailable: " + error.message;
    }
  };
  if (localFile) {
    page.addEventListener("sheet-score-ready", (event) => {
      if (!event.detail?.correction) stradellaChoice = null;
      mount();
    });
    ["sheet-clear", "sheet-score-changing"].forEach((name) => document.getElementById("osmd-container").addEventListener(name, () => dispose()));
    stradellaToggle?.addEventListener("change", () => {
      const previous = window.SheetReader?.player;
      if (!previous) return;
      previous.pause();
      const state = previous.snapshot();
      const settings = page.querySelector(".practice-settings");
      const follow = page.querySelector("[data-practice-follow]");
      const following = follow.checked;
      stradellaChoice = stradellaToggle.checked;
      mount();
      settings.open = true;
      follow.checked = following;
      stradellaToggle.focus({ preventScroll: true });
      const player = window.SheetReader?.player;
      if (!player) return;
      player.setRate(state.rate);
      player.setInstrument(state.instrument);
      player.setTranspose(state.transpose);
      player.setLoop(state.loop.start, state.loop.end, state.loop.enabled);
      player.seek(state.measure);
    });
  } else {
    bridge.readyPromise.then(mount);
  }
})();
