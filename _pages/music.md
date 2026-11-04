---
layout: music
title: Bayan notebook
nav_title: music
nav: true
nav_order: 4
permalink: /music/
description: Tools, sheets, and references for bayan and harmony.
keywords: bayan, accordion, stradella bass, music theory
---

<script>
  // Share links used to point at /music/; the workbench now lives at /music/workbench/.
  if (new URLSearchParams(location.search).has("chords")) {
    location.replace("{{ '/music/workbench/' | relative_url }}" + location.search + location.hash);
  }
</script>

{% include music-hub.liquid %}
