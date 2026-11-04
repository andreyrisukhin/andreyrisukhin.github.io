---
layout: music
title: Bayan workbench
permalink: /music/workbench/
description: Study harmony or build a timed Stradella set list, with notes, buttons, notation, and sound.
---

<div class="wb-workspace-switch" role="group" aria-label="Workbench mode">
  <button type="button" id="workspace-study-button" data-workspace="study" aria-pressed="true" aria-controls="workspace-study">Study</button>
  <button type="button" id="workspace-setlist-button" data-workspace="setlist" aria-pressed="false" aria-controls="workspace-setlist">Set list</button>
  <a href="{{ '/music/songs/' | relative_url }}">Song library</a>
</div>
<p id="workspace-help" class="music-small">Study chords and harmony. Set list keeps song charts, timed chords, recognition, and Stradella recipes together.</p>
<p id="workspace-status" role="status" class="music-small"></p>
<section id="workspace-study" aria-labelledby="workspace-study-button">
  {% include music-workbench.liquid %}
</section>
<section id="workspace-setlist" aria-labelledby="workspace-setlist-button" hidden>
  {% capture setlist %}{% include music-setlist.liquid %}{% endcapture %}
  {{ setlist | markdownify }}
</section>
<script src="{{ '/assets/js/workbench/workspaces.js' | relative_url }}"></script>
