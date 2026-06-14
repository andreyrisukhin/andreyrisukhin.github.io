(function () {
  const sheetPage = document.querySelector(".sheet-music-page");
  const container = document.getElementById("osmd-container");
  const status = document.getElementById("osmd-status");

  if (!sheetPage || !container || !status) return;

  const url = sheetPage.dataset.musicxmlUrl;

  if (!window.opensheetmusicdisplay) {
    status.textContent = "OSMD failed to load from CDN.";
    return;
  }

  if (!url) {
    status.textContent = "Missing MusicXML URL.";
    return;
  }

  const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
    backend: "svg",
    drawTitle: true,
    drawComposer: true,
    drawChordSymbols: false,
    autoResize: false,
  });

  if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = false;

  const renderPreservingScroll = () => {
    const y = window.scrollY;
    osmd.render();
    if (window.scrollY !== y) {
      window.scrollTo({ top: y, behavior: "instant" in window ? "instant" : "auto" });
    }
    watchAndHide();
  };

  const mobileQ = window.matchMedia("(max-width: 768px)");
  const fitZoom = () => (mobileQ.matches ? 0.4 : 1.0);
  let userZoomed = false;
  let zoom = fitZoom();
  const applyZoom = () => {
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

  osmd
    .load(url)
    .then(() => {
      status.textContent = "";
      if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = false;
      osmd.Zoom = zoom;
      renderPreservingScroll();
      lastWidth = container.clientWidth;
      if (window.__sheetMusic) window.__sheetMusic.register(osmd, container);
    })
    .catch((err) => {
      console.error(err);
      status.textContent = "Could not load score: " + err;
    });

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
      focusBtn.classList.toggle("is-pressed", on);
      focusBtn.textContent = on ? "Exit focus" : "Focus score";
      lastWidth = 0;
      setTimeout(onWidthChange, 80);
    };
    focusBtn.addEventListener("click", () => setFocusMode(!sheetPage.classList.contains("sheet-music-page--focus")));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sheetPage.classList.contains("sheet-music-page--focus")) {
        setFocusMode(false);
      }
    });
  }
})();
