---
layout: page
title: Chord Recognizer
permalink: /music/chord-recognizer/
---

Enter notes to identify the chord. The first note is treated as the bass — reorder to see inversions.

<div class="recognizer-note-buttons" id="recognizer-note-buttons"></div>

<div class="recognizer-input-row">
  <input type="text" id="recognizer-text-input" class="music-share-text"
         placeholder="e.g. E G C">
  <button id="recognizer-undo" class="music-share-btn">Undo</button>
  <button id="recognizer-clear" class="music-share-btn">Clear</button>
</div>

<div id="recognizer-result" class="recognizer-result"></div>

<div id="recognizer-staff" class="recognizer-staff"></div>

<noscript><p>This interactive tool requires JavaScript.</p></noscript>
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
<script src="{{ '/assets/js/chord-recognizer/main.js' | relative_url }}"></script>
