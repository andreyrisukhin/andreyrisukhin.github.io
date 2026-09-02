---
layout: page
title: "Dry River Walk: Zion"
permalink: /trails/zion-dry-river-walk/
description: >-
  A not-well-known walk through a dry riverbed in Zion National Park.
nav: false
sitemap: false
---

{% comment %}
Unlisted page. Anyone with the link can view it, but it isn't listed
in site nav and won't be indexed by search engines (noindex meta
emitted below). Drop the URL only with people you trust to respect
the spot.
{% endcomment %}

<meta name="robots" content="noindex, nofollow">

<noscript>
This page is an interactive map and requires JavaScript.
</noscript>

<link rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="" />
<link rel="stylesheet" href="{{ '/assets/js/map/leaflet-map.css' | relative_url }}">

<div class="trail-map-wrap">
  <div id="trail-map" class="trail-map is-loading">Loading map…</div>
</div>
<p id="trail-status" class="trail-status"></p>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
<script src="{{ '/assets/js/map/leaflet-map.js' | relative_url }}"></script>

<script>
  // Inline the committed JSON so the page works offline (and so the
  // public reader doesn't need a fetch round-trip on first paint).
  // Editor mode (?dev=1) re-saves to the same file via the sidecar.
  (function () {
    {%- assign trailsRoot = site.data["zion-paths"] -%}
    {%- assign trail = trailsRoot["dry-river-walk"] -%}
    var data = {{ trail | jsonify }};
    var controller = window.TrailMap.init({
      slug: 'dry-river-walk',
      data: data,
      mapId: 'trail-map',
      statusId: 'trail-status',
    });
    window.__trailMap = controller;
  })();
</script>

<script src="{{ '/assets/js/map/leaflet-editor.js' | relative_url }}"></script>
