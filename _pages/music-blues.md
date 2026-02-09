---
layout: page
permalink: /music/blues/
---

# 12-Bar Blues Jam Helper

Pick a key and progression variant to see the 12-bar form with real chord names.

<div class="music-key-bar" id="blues-key-bar"></div>

<div class="blues-variant-group">
  <button class="blues-variant-btn is-active" data-variant="standard">Standard</button>
  <button class="blues-variant-btn" data-variant="quickChange">Quick-Change</button>
  <button class="blues-variant-btn" data-variant="jazz">Jazz</button>
</div>

<div class="music-toggle-group" id="blues-toggle-group">
  <button class="music-toggle-btn is-active" data-layer="degree">Degree</button>
  <button class="music-toggle-btn" data-layer="notes">Notes</button>
  <button class="music-toggle-btn" data-layer="intervals">Intervals</button>
  <button class="music-toggle-btn" data-layer="semitones">Semitones</button>
</div>

<div id="blues-grid" class="blues-grid"></div>

<div class="music-share">
  <label>Stradella:</label>
  <input type="text" id="blues-share-text" class="music-share-text" readonly>
  <button id="blues-stradella-copy" class="music-share-btn">Copy for Stradella</button>
</div>

<h2>Blues Scale</h2>

<p>Use for improvisation over the progression. The highlighted note is the <strong>blue note</strong> (♭5) — a chromatic passing tone that gives the blues its characteristic sound.</p>

<div id="blues-scale-notes" class="blues-scale-notes"></div>

<div id="blues-scale-staff" class="blues-scale-staff"></div>

<noscript>
  <p>This interactive tool requires JavaScript to run.</p>
</noscript>

<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/blues/main.js' | relative_url }}"></script>
