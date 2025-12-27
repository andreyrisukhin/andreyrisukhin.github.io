---
layout: page
title: ditherer
permalink: /ditherer/
description: "Image ditherer with interleaved gradient noise."
---

# Ditherer

Upload an image, pick a palette, set pixel size, and preview interleaved gradient noise dithering.

<div class="ditherer">
  <div class="ditherer-panel">
    <h2>Controls</h2>

    <div class="ditherer-field">
      <label for="ditherer-file">Image</label>
      <input id="ditherer-file" type="file" accept="image/*">
    </div>

    <div class="ditherer-field">
      <label for="ditherer-preset">Palette preset</label>
      <select id="ditherer-preset">
        <option value="custom" selected>Custom</option>
        <option value="bw">Black / White</option>
        <option value="rgb">Red / Gray / Black</option>
        <option value="gameboy">Game Boy</option>
      </select>
    </div>

    <div class="ditherer-field">
      <label for="ditherer-palette">Palette colors (comma-separated)</label>
      <input id="ditherer-palette" type="text" value="#000000, #ffffff">
      <div class="ditherer-swatches" id="ditherer-swatches" aria-hidden="true"></div>
    </div>

    <div class="ditherer-field">
      <label for="ditherer-k">k colors (0 = all)</label>
      <input id="ditherer-k" type="number" min="0" step="1" value="0">
    </div>

    <div class="ditherer-field">
      <label for="ditherer-pixel">Pixel size</label>
      <input id="ditherer-pixel" type="range" min="2" max="24" step="1" value="6">
      <span id="ditherer-pixel-value">6</span>
    </div>

    <div class="ditherer-field">
      <label for="ditherer-method">Mapping</label>
      <select id="ditherer-method">
        <option value="bands" selected>Luminance bands</option>
        <option value="closest">Closest RGB</option>
      </select>
    </div>

    <div class="ditherer-actions">
      <button id="ditherer-reset" type="button">Reset</button>
      <button id="ditherer-download" type="button" disabled>Download PNG</button>
    </div>

    <p class="ditherer-status" id="ditherer-status">Load an image to start.</p>
  </div>

  <div class="ditherer-output">
    <div>
      <strong>Source preview</strong>
      <canvas class="ditherer-canvas" id="ditherer-source"></canvas>
    </div>
    <div>
      <strong>Dithered output</strong>
      <canvas class="ditherer-canvas" id="ditherer-output"></canvas>
    </div>
  </div>
</div>

<script type="module" src="{{ '/assets/js/ditherer/main.js' | relative_url }}"></script>
