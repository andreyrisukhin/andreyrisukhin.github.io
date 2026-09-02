---
layout: page
title: Music Exercises
permalink: /music/exercises/
---

Hardcoded practice loops with chord progression, suggested right-hand pattern, and a theory note. Use the key bar on each card to transpose.

<div id="exercises-root" class="exercises-root"></div>

<noscript><p>This interactive tool requires JavaScript. The exercise titles and theory notes still render without it, but the chord recipes and transposition will not.</p></noscript>

<script>
  window.MusicExercises = {{ site.data.music.exercises.exercises | jsonify }};
  window.StradellaButtons = {
    {% for btn in site.data.music.stradella_buttons.buttons %}
    {{ btn.id | jsonify }}: {{ btn.offsets | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/audio.js?v=1' | relative_url }}"></script>
<script src="{{ '/assets/js/vendor/soundfont-player.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-exercises/main.js' | relative_url }}"></script>
