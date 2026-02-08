---
layout: page
permalink: /music/blues/
---

# 12-Bar Blues Jam Helper

Pick a key and progression variant to see the 12-bar form with real chord names. Use the blues scale below for improvisation — the highlighted note is the **blue note** (♭5).

<div class="blues-controls">
  <label for="blues-key">Key:</label>
  <select id="blues-key"></select>

  <div class="blues-variant-group">
    <button class="blues-variant-btn is-active" data-variant="standard">Standard</button>
    <button class="blues-variant-btn" data-variant="quickChange">Quick-Change</button>
    <button class="blues-variant-btn" data-variant="jazz">Jazz</button>
  </div>
</div>

<div id="blues-grid" class="blues-grid"></div>

<h2>Blues Scale</h2>

<div id="blues-scale-notes" class="blues-scale-notes"></div>

<noscript>
  <p>This interactive tool requires JavaScript to run.</p>
</noscript>

<script src="{{ '/assets/js/blues/main.js' | relative_url }}"></script>
