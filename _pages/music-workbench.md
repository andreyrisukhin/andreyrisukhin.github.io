---
layout: music
title: Bayan workbench
permalink: /music/workbench/
description: Write a chord progression, hear it, and see how to play it on bayan.
---

<p><a href="{{ '/music/songs/' | relative_url }}">Song library and charts</a></p>
<p id="workspace-status" role="status" class="music-small"></p>
<section id="workspace-study" aria-label="Progression editor">
  {% include music-workbench.liquid %}
</section>
<section id="workspace-setlist" aria-label="Timed set-list editor" hidden>
  {% capture setlist %}{% include music-setlist.liquid %}{% endcapture %}
  {{ setlist | markdownify }}
</section>
<details id="workspace-tools"><summary>Other editors</summary>
<div class="wb-workspace-switch" role="group" aria-label="Workbench mode">
  <button type="button" id="workspace-study-button" data-workspace="study" aria-pressed="true" aria-controls="workspace-study">Progression editor</button>
  <button type="button" id="workspace-setlist-button" data-workspace="setlist" aria-pressed="false" aria-controls="workspace-setlist">Timed set-list editor</button>
</div>
<p class="music-small">Timed songs keep their original chord lengths, meter, and Stradella recipes.</p>
</details>
<script src="{{ '/assets/js/workbench/workspaces.js' | relative_url }}"></script>
