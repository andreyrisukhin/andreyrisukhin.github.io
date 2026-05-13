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
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.mscz' | relative_url }}" download>Download .mscz</a>
  <a class="music-share-btn" href="{{ '/assets/music/sheet-music/cogwork-dancers/cogwork-dancers.musicxml' | relative_url }}" download>Download MusicXML</a>
</div>

<div id="osmd-container" class="sheet-music-container"></div>
<p id="osmd-status" class="sheet-music-status">Loading score…</p>

<noscript><p>This page renders sheet music client-side with JavaScript. Download the MusicXML or `.mscz` above to view it in another application.</p></noscript>

<link rel="stylesheet" href="{{ '/assets/js/sheet-music/dev-annotator.css' | relative_url }}">
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
    autoResize: true,
  });

  let zoom = 1.0;
  const applyZoom = () => { osmd.Zoom = zoom; osmd.render(); };

  osmd.load(url)
    .then(() => { status.textContent = ''; osmd.render(); })
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
