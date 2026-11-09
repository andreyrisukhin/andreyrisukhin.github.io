(function () {
  const sheetPage = document.querySelector(".sheet-music-page");
  const container = document.getElementById("osmd-container");
  const status = document.getElementById("osmd-status");

  if (!sheetPage || !container || !status) return;

  const url = sheetPage.dataset.musicxmlUrl;
  const localFile = sheetPage.dataset.localFile === "true";
  const scoreHeading = !localFile && sheetPage.dataset.scoreHeading !== "false";

  if (!window.opensheetmusicdisplay) {
    status.textContent = "The notation renderer failed to load. Reload this page to try again.";
    return;
  }

  if (!url && !localFile) {
    status.textContent = "Missing MusicXML URL.";
    return;
  }

  const createOsmd = (target = container) =>
    new opensheetmusicdisplay.OpenSheetMusicDisplay(target, {
      backend: "svg",
      drawTitle: scoreHeading,
      drawComposer: scoreHeading,
      drawSubtitle: scoreHeading,
      drawPartNames: scoreHeading,
      drawPartAbbreviations: scoreHeading,
      drawChordSymbols: localFile,
      autoResize: false,
      // Flexoki cyan instead of OSMD's neon green; callers scroll it themselves.
      cursorsOptions: [{ type: 0, color: "#24837B", alpha: 0.35, follow: false }],
    });

  let osmd = localFile ? null : createOsmd();

  const renderPreservingScroll = () => {
    if (!osmd?.Sheet) return;
    const y = window.scrollY;
    container.dispatchEvent(new CustomEvent("sheet-before-render"));
    osmd.render();
    if (window.scrollY !== y) {
      window.scrollTo({ top: y, behavior: "instant" in window ? "instant" : "auto" });
    }
    if (!localFile) watchAndHide();
    container.dispatchEvent(new CustomEvent("sheet-render"));
  };

  const mobileQ = window.matchMedia("(max-width: 768px)");
  const fitZoom = () => (mobileQ.matches ? 0.8 : 1.0);
  let userZoomed = false;
  let zoom = fitZoom();
  const applyZoom = () => {
    if (!osmd?.Sheet) return;
    osmd.Zoom = zoom;
    renderPreservingScroll();
  };
  mobileQ.addEventListener("change", () => {
    if (userZoomed) return;
    zoom = fitZoom();
    applyZoom();
  });

  let lastWidth = container.clientWidth;
  let resizeTimer = null;
  const onWidthChange = () => {
    const w = container.clientWidth;
    if (Math.abs(w - lastWidth) < 4) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderPreservingScroll, 120);
  };
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(onWidthChange).observe(container);
  } else {
    window.addEventListener("resize", onWidthChange, { passive: true });
  }

  const looksLikeChord = (s) => {
    if (window.ChordName && window.ChordName.looksValid) return window.ChordName.looksValid(s);
    return false;
  };

  const hideStaticChordText = () => {
    const svg = container.querySelector("svg");
    if (!svg) return;
    for (const t of svg.querySelectorAll("g.vf-text > text, text.vf-chord, text")) {
      const s = (t.textContent || "").trim();
      if (!s || !looksLikeChord(s)) continue;
      // Rehearsal marks ("A", "B") parse as chord names; OSMD draws them bold
      // and chord symbols in regular weight.
      if (t.getAttribute("font-weight") === "bold") continue;
      const wrap = t.closest("g.vf-text") || t;
      if (wrap.hasAttribute("data-test-injected")) continue;
      wrap.setAttribute("data-hidden-chord-text", s);
      wrap.style.display = "none";
    }
  };

  let chordHideObs = null;
  const watchAndHide = () => {
    if (chordHideObs) chordHideObs.disconnect();
    hideStaticChordText();
    chordHideObs = new MutationObserver(hideStaticChordText);
    chordHideObs.observe(container, { childList: true, subtree: true });
  };

  function showScore() {
    if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = localFile;
    osmd.Zoom = zoom;
    renderPreservingScroll();
    lastWidth = container.clientWidth;
    window.__sheetMusic.register(osmd, container, { rerender: renderPreservingScroll });
  }

  if (localFile) {
    const input = document.getElementById("sheet-file");
    const close = document.getElementById("sheet-file-clear");
    const controls = sheetPage.querySelectorAll(".sheet-music-controls button");
    const bridge = window.__sheetMusic;
    const heading = sheetPage.closest("article")?.querySelector("h1");
    const originalHeading = heading?.textContent;
    const replaceButton = sheetPage.querySelector("[data-sheet-replace]");
    replaceButton.addEventListener("click", () => input.click());
    let generation = 0;
    const setControls = (enabled) => {
      sheetPage.querySelector(".sheet-view-options").hidden = !enabled;
      controls.forEach((button) => {
        button.disabled = !enabled;
      });
    };
    function clearScore() {
      generation++;
      window.WorkbenchPlayer?.stop();
      const dialog = document.getElementById("sheet-inspector");
      if (dialog.open) dialog.close();
      if (sheetPage.classList.contains("sheet-music-page--focus")) document.getElementById("osmd-focus-toggle").click();
      clearTimeout(resizeTimer);
      osmd = null;
      bridge.osmd = bridge.xml = null;
      bridge.localFileName = null;
      bridge.ready = false;
      container.dispatchEvent(new CustomEvent("sheet-clear"));
      container.replaceChildren();
      container.hidden = true;
      container.removeAttribute("aria-busy");
      input.value = "";
      close.disabled = true;
      sheetPage.dataset.scoreLoaded = "false";
      replaceButton.hidden = true;
      if (heading) heading.textContent = originalHeading;
      setControls(false);
      status.textContent = "Choose a MusicXML file to begin.";
    }
    close.addEventListener("click", () => {
      if (window.SheetCorrections?.confirmDiscard() !== false) clearScore();
    });
    bridge.replaceLocalXML = async (doc) => {
      const request = generation;
      const previous = { osmd, xml: bridge.xml, scrollY: window.scrollY };
      if (!previous.osmd) return false;
      window.SheetReader?.player?.pause();
      const state = window.SheetReader?.player?.snapshot();
      container.dispatchEvent(new CustomEvent("sheet-score-changing"));
      previous.nodes = [...container.childNodes];
      window.WorkbenchPlayer?.stop();
      const dialog = document.getElementById("sheet-inspector");
      if (dialog.open) dialog.close();
      container.setAttribute("aria-busy", "true");
      const publish = (nodes) => {
        container.replaceChildren(...nodes);
        bridge.osmd = osmd;
        showScore();
        window.scrollTo({ top: previous.scrollY, behavior: "instant" });
        sheetPage.dispatchEvent(new CustomEvent("sheet-score-ready", { detail: { correction: true } }));
        const player = window.SheetReader?.player;
        if (player && state) {
          player.setRate(state.rate);
          player.setInstrument(state.instrument);
          player.setLoop(state.loop.start, state.loop.end, state.loop.enabled);
          player.seek(state.measure);
        }
      };
      try {
        const surface = document.createElement("div");
        const next = createOsmd(surface);
        await next.load(doc);
        if (request !== generation) return false;
        osmd = next;
        bridge.xml = doc;
        publish([surface]);
        return true;
      } catch (_) {
        if (request !== generation) return false;
        osmd = previous.osmd;
        bridge.xml = previous.xml;
        publish(previous.nodes);
        throw new Error("The renderer could not display that correction. The previous score was restored.");
      } finally {
        if (request === generation) container.removeAttribute("aria-busy");
      }
    };
    async function openFile(file, preset) {
      if (!file) return;
      if (window.SheetCorrections?.confirmDiscard() === false) {
        input.value = "";
        return;
      }
      clearScore();
      sheetPage.dataset.playbackInstrument = preset?.instrument || "acoustic_grand_piano";
      if (preset?.key_mode) sheetPage.dataset.keyMode = preset.key_mode;
      else delete sheetPage.dataset.keyMode;
      if (preset?.stradella) sheetPage.dataset.playbackStradella = "true";
      else delete sheetPage.dataset.playbackStradella;
      const request = generation;
      close.disabled = false;
      status.textContent = "Opening score…";
      container.setAttribute("aria-busy", "true");
      let doc;
      try {
        doc = await window.SheetLocalFile.read(file);
      } catch (err) {
        if (request !== generation) return;
        clearScore();
        status.textContent = err.message;
        return;
      }
      if (request !== generation) return;
      try {
        container.hidden = false;
        const next = createOsmd();
        await next.load(doc);
        if (request !== generation) return;
        osmd = next;
        bridge.osmd = next;
        bridge.xml = doc;
        bridge.localFileName = file.name;
        userZoomed = false;
        zoom = fitZoom();
        showScore();
        setControls(true);
        sheetPage.dataset.scoreLoaded = "true";
        replaceButton.hidden = false;
        if (heading) heading.textContent = doc.querySelector("work-title, movement-title")?.textContent || "Local score";
        container.removeAttribute("aria-busy");
        const count = next.Sheet.SourceMeasures.length;
        status.textContent = count + (count === 1 ? " measure" : " measures") + " · Browser only";
        sheetPage.dispatchEvent(new CustomEvent("sheet-score-ready"));
        if (preset) sheetPage.querySelector("[data-correction-toggle]").click();
        sheetPage.scrollIntoView({ block: "start", behavior: "instant" });
      } catch (_) {
        if (request !== generation) return;
        clearScore();
        status.textContent = "Could not render this MusicXML. Try exporting it again.";
      }
    }
    input.addEventListener("change", () => openFile(input.files[0]));
    clearScore();
    const scoreId = new URLSearchParams(location.search).get("score");
    if (scoreId) {
      const known = JSON.parse(document.getElementById("sheet-public-scores").textContent);
      const preset = Object.prototype.hasOwnProperty.call(known, scoreId) && known[scoreId];
      if (!preset) status.textContent = "Unknown public score. Choose a file on your device instead.";
      else {
        const request = generation;
        close.disabled = false;
        status.textContent = "Opening a local copy of the public score…";
        const publicURL = new URL(preset.url, location.origin);
        if (publicURL.origin === location.origin)
          fetch(publicURL.href)
            .then(async (response) => {
              if (!response.ok) throw new Error("The public score could not be downloaded.");
              const content = await response.blob();
              if (request !== generation) return;
              await openFile(new File([content], scoreId + ".musicxml"), preset);
            })
            .catch((error) => {
              if (request === generation) {
                clearScore();
                status.textContent = error.message;
              }
            });
      }
    }
  } else {
    const source = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Score could not be downloaded.");
        return response.text();
      })
      .then((xml) => {
        window.__sheetMusic.xml = new DOMParser().parseFromString(xml, "application/xml");
        return xml;
      });
    source
      .then((xml) => osmd.load(xml))
      .then(() => {
        status.textContent = "";
        showScore();
      })
      .catch((err) => {
        console.error(err);
        status.textContent = "Could not load score: " + err;
      });
  }

  document.getElementById("osmd-zoom-in").addEventListener("click", () => {
    userZoomed = true;
    zoom = Math.min(zoom + 0.1, 3);
    applyZoom();
  });
  document.getElementById("osmd-zoom-out").addEventListener("click", () => {
    userZoomed = true;
    zoom = Math.max(zoom - 0.1, 0.3);
    applyZoom();
  });
  document.getElementById("osmd-zoom-reset").addEventListener("click", () => {
    userZoomed = false;
    zoom = fitZoom();
    applyZoom();
  });

  const focusBtn = document.getElementById("osmd-focus-toggle");
  if (focusBtn) {
    const setFocusMode = (on) => {
      sheetPage.classList.toggle("sheet-music-page--focus", on);
      document.documentElement.classList.toggle("sheet-music-focus-open", on);
      focusBtn.setAttribute("data-pressed", on ? "true" : "false");
      focusBtn.setAttribute("aria-pressed", String(on));
      focusBtn.classList.toggle("is-pressed", on);
      focusBtn.textContent = on ? "Exit focus" : "Focus score";
      lastWidth = 0;
      setTimeout(onWidthChange, 80);
    };
    focusBtn.addEventListener("click", () => setFocusMode(!sheetPage.classList.contains("sheet-music-page--focus")));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sheetPage.classList.contains("sheet-music-page--focus")) {
        if (document.querySelector("#sheet-inspector[open], #sheet-correction-dialog[open]")) return;
        setFocusMode(false);
      }
    });
  }
})();
