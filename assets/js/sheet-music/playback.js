/* Shared sheet reader controller. The transport never owns audio or score timing. */
(function () {
  const page = document.querySelector(".sheet-reader");
  const bridge = window.__sheetMusic;
  if (!page || page.dataset.playback !== "true" || !bridge) return;
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
      window.SheetReader = null;
      bridge.stradellaReading = null;
    };
    try {
      const osmd = bridge.osmd;
      const timeline = window.SheetPracticeTimeline.fromXML(bridge.xml);
      const score = window.SheetScore.build(osmd, timeline, {
        stradellaBass: page.dataset.playbackStradella === "true",
      });
      player = window.SheetPracticePlayer.create(score, {
        audioUrl: page.dataset.renderedAudioUrl,
        timingUrl: page.dataset.timingUrl,
        instrument: page.dataset.playbackInstrument || "church_organ",
        instruments: window.SheetScore.instruments.map(([name]) => name),
        gain: Number(page.dataset.playbackGain) || 1,
      });
      window.SheetReader = { player, score };
      bridge.stradellaReading = (note) => score.stradellaReadings.get(note) || null;
      const key = window.SheetScore.readScoreKey(osmd, page.dataset.keyMode);
      controls = window.SheetTransport.mount(page, player, key, bridge);
      playhead = new window.SheetPlayhead.Playhead(osmd);
      let map,
        transpose = 0,
        clock;
      const rebuild = () => {
        const state = player.snapshot();
        playhead.rebuild(state.starts, state.duration);
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
  if (page.dataset.localFile === "true") {
    page.addEventListener("sheet-score-ready", mount);
    ["sheet-clear", "sheet-score-changing"].forEach((name) => document.getElementById("osmd-container").addEventListener(name, () => dispose()));
  } else {
    bridge.readyPromise.then(mount);
  }
})();
