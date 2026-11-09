---
layout: page
title: Color
permalink: /color/
description: "Tools for picking colors and putting them to work."
---

<div class="color-hub">
  <a class="color-hub__card" href="{{ '/color/outfit/' | relative_url }}">
    <span class="color-hub__swatch" aria-hidden="true">
      <span style="flex-basis: 49%; background: #5b6236"></span>
      <span style="flex-basis: 41%; background: #f4f2ec"></span>
      <span style="flex-basis: 10%; background: #5c4033"></span>
    </span>
    <span class="color-hub__title">Outfit palette</span>
    <span class="color-hub__desc">Pick each piece’s color on a wheel and see how much of the look it takes.</span>
  </a>
  <a class="color-hub__card" href="{{ '/ditherer/' | relative_url }}">
    <span class="color-hub__swatch" aria-hidden="true">
      <img src="{{ '/assets/img/ditherer/hub-preview.png' | relative_url }}" alt="" width="604" height="192" loading="lazy">
    </span>
    <span class="color-hub__title">Ditherer</span>
    <span class="color-hub__desc">Reduce an image to a few colors with interleaved gradient noise.</span>
  </a>
</div>
