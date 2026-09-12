---
layout: page
title: Music Workbench
permalink: /music/workbench/
---

One box. Type notes, a chord name, or paste a link — the right tool appears.

<div class="workbench-input-row">
  <input type="text" id="workbench-input" class="workbench-input"
         placeholder="C E G &nbsp;·&nbsp; Am7 &nbsp;·&nbsp; paste a tab or MuseScore link"
         autocomplete="off" spellcheck="false">
</div>

<div id="workbench-hint" class="workbench-hint">
  <span class="workbench-hint-label">Try:</span>
  <button class="workbench-chip" data-example="C E G">C E G</button>
  <button class="workbench-chip" data-example="Am7">Am7</button>
  <button class="workbench-chip" data-example="2 5 1 in G">2 5 1 in G</button>
  <button class="workbench-chip" data-example="Fd7/C">Fd7/C</button>
</div>

<div id="workbench-library" class="workbench-hint workbench-library"></div>

<div class="workbench-layout">
  <div class="workbench-main">
    <div id="workbench-sheet" class="workbench-sheet" style="display: none"></div>
    <div id="workbench-result" class="workbench-result"></div>
    <div id="workbench-matrix" class="workbench-matrix" style="display: none"></div>
  </div>
  <aside id="workbench-setlist" class="workbench-setlist" style="display: none"></aside>
</div>

<noscript><p>This interactive tool requires JavaScript.</p></noscript>

<script>
  window.MusicExercises = {{ site.data.music.exercises.exercises | jsonify }};
  window.StradellaButtons = {
    {% for btn in site.data.music.stradella_buttons.buttons %}
    {{ btn.id | jsonify }}: {{ btn.offsets | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/vendor/abcjs-basic-min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/workbench/classify.js' | relative_url }}"></script>
<script src="{{ '/assets/js/workbench/main.js' | relative_url }}"></script>
