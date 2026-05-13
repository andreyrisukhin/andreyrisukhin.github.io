---
layout: page
title: 'Sheet Music: Cogwork Dancers'
permalink: /music/sheet/cogwork-dancers/
---

Arranged for organ by Christopher Larkin. Rendered from MusicXML via
[OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/). Source `.mscz` and
converted `.musicxml` live under `/assets/music/sheet-music/cogwork-dancers/`.

<div class="sheet-music-controls">
  <button id="osmd-zoom-out" class="music-share-btn" type="button">−</button>
  <button id="osmd-zoom-reset" class="music-share-btn" type="button">Reset zoom</button>
  <button id="osmd-zoom-in" class="music-share-btn" type="button">+</button>
  <button id="osmd-stradella-toggle" class="music-share-btn" type="button" data-pressed="false">Show Stradella</button>
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.mscz' | relative_url }}" download>Download .mscz</a>
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.musicxml' | relative_url }}" download>Download MusicXML</a>
</div>

<div id="osmd-container" class="sheet-music-container"></div>
<p id="osmd-status" class="sheet-music-status">Loading score…</p>

<noscript><p>This page renders sheet music client-side with JavaScript. Download the MusicXML or `.mscz` above to view it in another application.</p></noscript>

<link rel="stylesheet" href="{{ '/assets/js/sheet-music/dev-annotator.css' | relative_url }}">

<script>
  window.StradellaButtons = {
    {% for btn in site.data.music.stradella_buttons.buttons %}
    {{ btn.id | jsonify }}: {{ btn.offsets | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-recipe.js' | relative_url }}"></script>
<script src="{{ '/assets/js/sheet-music/osmd-bridge.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/chord-inspector.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/stradella-overlay.js' | relative_url }}"></script>
<script defer src="{{ '/assets/js/sheet-music/dev-annotator.js' | relative_url }}"></script>

<script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.0/build/opensheetmusicdisplay.min.js"></script>
<script>
(function () {
  const container = document.getElementById('osmd-container');
  const status = document.getElementById('osmd-status');
  const url = '{{ "/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.musicxml" | relative_url }}';

  if (!window.opensheetmusicdisplay) {
    status.textContent = 'OSMD failed to load from CDN.';
    return;
  }

  const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
    backend: 'svg',
    drawTitle: true,
    drawComposer: true,
    drawChordSymbols: false,
    autoResize: true,
  });

  // Belt-and-braces: drawChordSymbols isn't honored on every OSMD release;
  // EngravingRules.RenderChordSymbols is the canonical knob.
  if (osmd.EngravingRules) osmd.EngravingRules.RenderChordSymbols = false;

  let zoom = 1.0;
  const applyZoom = () => { osmd.Zoom = zoom; osmd.render(); watchAndHide(); };

  // Hide stray chord-symbol-shaped text rendered as score directions
  // (musicxml <direction>/<words>), which OSMD's RenderChordSymbols
  // option doesn't gate. We surface chord names via the dynamic hover
  // label, so the static text is now duplicate noise.
  const CHORD_TEXT_RE = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|m6|m7|maj7|7|9|11|13|\u00b0|\u00f8)?(?:\/[A-G][#b]?)?$/;
  const hideStaticChordText = () => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    for (const t of svg.querySelectorAll('g.vf-text > text, text.vf-chord, text')) {
      const s = (t.textContent || '').trim();
      if (!s || !CHORD_TEXT_RE.test(s)) continue;
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
      osmd.render();
      watchAndHide();
      if (window.__sheetMusic) window.__sheetMusic.register(osmd, container);
    })
    .catch((err) => {
      console.error(err);
      status.textContent = 'Could not load score: ' + err;
    });

  document.getElementById('osmd-zoom-in').addEventListener('click', () => { zoom = Math.min(zoom + 0.1, 3); applyZoom(); });
  document.getElementById('osmd-zoom-out').addEventListener('click', () => { zoom = Math.max(zoom - 0.1, 0.3); applyZoom(); });
  document.getElementById('osmd-zoom-reset').addEventListener('click', () => { zoom = 1.0; applyZoom(); });
})();
</script>

<style>
  .sheet-music-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0;
    align-items: center;
  }
  .sheet-music-container {
    width: 100%;
    overflow-x: auto;
    background: var(--global-bg-color, #fff);
    padding: 1rem 0;
  }
  .sheet-music-status {
    color: var(--global-text-color-light, #888);
    font-style: italic;
    min-height: 1.25em;
  }
</style>
