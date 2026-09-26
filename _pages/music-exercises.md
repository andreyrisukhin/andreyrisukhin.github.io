---
layout: music
title: Music Exercises
permalink: /music/exercises/
---

Practice a progression with a right-hand pattern and a theory note. Use the key bar to transpose.

Score exercise: [Reconstructing More Science]({{ '/music/sheet/reconstructing-more-science/' | relative_url }}) from the _Portal 2_ soundtrack, eight bars of two-hand accordion practice in F minor.

<div id="exercises-root" class="exercises-root"></div>

<noscript><p>Playback and transposition need JavaScript. Try the <a href="/music/scales/">scale reference</a> for a printable practice companion.</p></noscript>

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
<script src="{{ '/assets/js/tactus/audio.js?v=1' | relative_url }}"></script>
<script src="{{ '/assets/js/vendor/soundfont-player.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-exercises/main.js' | relative_url }}"></script>
