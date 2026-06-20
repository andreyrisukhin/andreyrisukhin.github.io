---
layout: page
title: Sheet Builder
permalink: /music/sheet-builder/
---

Build a piano score from the Fearless First countermelody, then enter the bassline with a B-system bayan keyboard. The draft saves in this browser; copy the JSON when it is ready to commit.

<div id="sheet-builder-root" class="sheet-builder-root"></div>

<noscript><p>This interactive tool requires JavaScript.</p></noscript>

<script>
  window.SheetBuilderExercises = {{ site.data.music.exercises.exercises | jsonify }};
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/vendor/opensheetmusicdisplay.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/sheet-builder/main.js' | relative_url }}"></script>
