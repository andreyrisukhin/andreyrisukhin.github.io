---
layout: page
title: "Sheet Music: Cogwork Dancers"
permalink: /music/sheet/cogwork-dancers/
---

Arranged for organ by Christopher Larkin. Rendered from MusicXML via
[OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/). Source `.mscz` and
converted `.musicxml` live under `/assets/music/sheet-music/cogwork-dancers/`.

<div class="sheet-music-page sheet-music-page--flexoki">
<div class="sheet-music-controls">
  <button id="osmd-zoom-out" class="music-share-btn" type="button">−</button>
  <button id="osmd-zoom-reset" class="music-share-btn" type="button">Reset zoom</button>
  <button id="osmd-zoom-in" class="music-share-btn" type="button">+</button>
  <button id="osmd-stradella-toggle" class="music-share-btn" type="button" data-pressed="false">Show Stradella</button>
  <button id="osmd-focus-toggle" class="music-share-btn" type="button" data-pressed="false">Focus score</button>
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.mscz' | relative_url }}" download>Download .mscz</a>
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.musicxml' | relative_url }}" download>Download MusicXML</a>
</div>

<div id="osmd-container" class="sheet-music-container"></div>
<p id="osmd-status" class="sheet-music-status">Loading score…</p>

<noscript><p>This page renders sheet music client-side with JavaScript. Download the MusicXML or `.mscz` above to view it in another application.</p></noscript>

</div>

<link rel="stylesheet" href="{{ '/assets/js/sheet-music/dev-annotator.css?v=4' | relative_url }}">

<script>
  window.StradellaButtons = {
    {% for btn in site.data.music.stradella_buttons.buttons %}
    {{ btn.id | jsonify }}: {{ btn.offsets | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/chord-name.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-recipe.js' | relative_url }}"></script>
<script src="{{ '/assets/js/sheet-music/osmd-bridge.js' | relative_url }}"></script>
<script src="{{ '/assets/js/vendor/soundfont-player.min.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/chord-inspector.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/stradella-overlay.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/dev-annotator.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/playback.js?v=4' | relative_url }}"></script>

<script src="{{ '/assets/js/vendor/opensheetmusicdisplay.min.js' | relative_url }}"></script>
<script>
(function () {
  const sheetPage = document.querySelector('.sheet-music-page');
  const container = document.getElementById('osmd-container');
  const status = document.getElementById('osmd-status');
  const url = '{{ "/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.musicxml" | relative_url }}';

  if (!window.opensheetmusicdisplay) {
    status.textContent = 'OSMD failed to load from CDN.';
    return;
  }

  // autoResize listens to window resize, which on mobile Safari fires on
  // every URL-bar collapse/expand. Each fire calls render(), which rebuilds
  // the SVG tree and loses the scroll anchor -- the page jumps to the top.
  // We do width-only reflow ourselves below.
  const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
    backend: 'svg',
    drawTitle: true,
    drawComposer: true,
    drawChordSymbols: false,
    autoResize: false,
  });

  // Belt-and-braces: drawChordSymbols isn't honored on every OSMD release;
  // EngravingRules.RenderChordSymbols is the canonical knob.
  if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = false;

  const renderPreservingScroll = () => {
    const y = window.scrollY;
    osmd.render();
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' in window ? 'instant' : 'auto' });
    watchAndHide();
  };

  const mobileQ = window.matchMedia('(max-width: 768px)');
  const fitZoom = () => (mobileQ.matches ? 0.4 : 1.0);
  let userZoomed = false;
  let zoom = fitZoom();
  const applyZoom = () => { osmd.Zoom = zoom; renderPreservingScroll(); };
  mobileQ.addEventListener('change', () => {
    if (userZoomed) return;
    zoom = fitZoom();
    applyZoom();
  });

  // Width-only reflow: ignore pure-height changes (mobile URL bar), only
  // re-render when the container's actual width changes meaningfully.
  let lastWidth = container.clientWidth;
  let resizeTimer = null;
  const onWidthChange = () => {
    const w = container.clientWidth;
    if (Math.abs(w - lastWidth) < 4) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderPreservingScroll, 120);
  };
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(onWidthChange).observe(container);
  } else {
    window.addEventListener('resize', onWidthChange, { passive: true });
  }

  // Hide stray chord-symbol-shaped text rendered as score directions
  // (musicxml <direction>/<words>), which OSMD's RenderChordSymbols
  // option doesn't gate. We surface chord names via the dynamic hover
  // label, so the static text is now duplicate noise.
  // Chord-name shape check shared with stradella-overlay and the
  // recipe lookup -- see assets/js/music/chord-name.js. Falls back
  // to a permissive accept if ChordName isn't loaded yet (the MO
  // can fire before scripts finish parsing on slow first paints).
  const looksLikeChord = (s) => {
    if (window.ChordName && window.ChordName.looksValid) return window.ChordName.looksValid(s);
    return false;
  };
  const hideStaticChordText = () => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    for (const t of svg.querySelectorAll('g.vf-text > text, text.vf-chord, text')) {
      const s = (t.textContent || '').trim();
      if (!s || !looksLikeChord(s)) continue;
      const wrap = t.closest('g.vf-text') || t;
      if (wrap.hasAttribute('data-test-injected')) continue;
      wrap.setAttribute('data-hidden-chord-text', s);
      wrap.style.display = 'none';
    }
  };

  // OSMD adds elements after the .then() resolves (autoResize, layout
  // reflows). MutationObserver catches the late additions cheaply.
  let chordHideObs = null;
  const watchAndHide = () => {
    if (chordHideObs) chordHideObs.disconnect();
    hideStaticChordText();
    chordHideObs = new MutationObserver(hideStaticChordText);
    chordHideObs.observe(container, {childList: true, subtree: true});
  };

  osmd.load(url)
    .then(() => {
      status.textContent = '';
      if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = false;
      osmd.Zoom = zoom;
      renderPreservingScroll();
      lastWidth = container.clientWidth;
      if (window.__sheetMusic) window.__sheetMusic.register(osmd, container);
    })
    .catch((err) => {
      console.error(err);
      status.textContent = 'Could not load score: ' + err;
    });

  document.getElementById('osmd-zoom-in').addEventListener('click', () => { userZoomed = true; zoom = Math.min(zoom + 0.1, 3); applyZoom(); });
  document.getElementById('osmd-zoom-out').addEventListener('click', () => { userZoomed = true; zoom = Math.max(zoom - 0.1, 0.3); applyZoom(); });
  document.getElementById('osmd-zoom-reset').addEventListener('click', () => { userZoomed = false; zoom = fitZoom(); applyZoom(); });
  const focusBtn = document.getElementById('osmd-focus-toggle');
  const setFocusMode = (on) => {
    sheetPage.classList.toggle('sheet-music-page--focus', on);
    document.documentElement.classList.toggle('sheet-music-focus-open', on);
    focusBtn.setAttribute('data-pressed', on ? 'true' : 'false');
    focusBtn.classList.toggle('is-pressed', on);
    focusBtn.textContent = on ? 'Exit focus' : 'Focus score';
    lastWidth = 0;
    setTimeout(onWidthChange, 80);
  };
  focusBtn.addEventListener('click', () => setFocusMode(!sheetPage.classList.contains('sheet-music-page--focus')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheetPage.classList.contains('sheet-music-page--focus')) {
      setFocusMode(false);
    }
  });
})();
</script>
