---
layout: page
title: Ditherer
permalink: /ditherer/
description: "Image ditherer with interleaved gradient noise."
---

<div class="ditherer">
  <div class="ditherer-workspace">
    <figure class="ditherer-stage">
      <div class="ditherer-viewport" id="ditherer-viewport">
        <canvas class="ditherer-canvas" id="ditherer-output" role="img" aria-label="Dithered image"></canvas>
      </div>
      <figcaption class="ditherer-caption">
        <span class="ditherer-source">
          <canvas class="ditherer-canvas" id="ditherer-source" role="img" aria-label="Source image"></canvas>
          <span class="tool-label">Source</span>
        </span>
        <span class="ditherer-status" id="ditherer-status" role="status">Load an image to start.</span>
        <button class="tool-button--primary" id="ditherer-download" type="button" disabled>Download PNG</button>
      </figcaption>
    </figure>
  </div>

  <div class="ditherer-panel">
    <h2 class="sr-only">Controls</h2>

    <div class="tool-group">
      <span class="tool-label" id="ditherer-samples-label">Image</span>
      <div class="ditherer-samples" role="group" aria-labelledby="ditherer-samples-label">
        <button class="ditherer-sample" type="button" data-sample="flymeaccorded" data-url="{{ '/assets/img/ditherer/FlyMeAccorded.jpg' | relative_url }}" aria-pressed="false">
          <img src="{{ '/assets/img/ditherer/FlyMeAccorded.jpg' | relative_url }}" alt="Accordion and guitar on a small stage">
        </button>
        <button class="ditherer-sample" type="button" data-sample="llamamerc" data-url="{{ '/assets/img/ditherer/llamamerc.png' | relative_url }}" aria-pressed="false">
          <img src="{{ '/assets/img/ditherer/llamamerc.png' | relative_url }}" alt="Voxel farm with a field of crops">
        </button>
        <button class="ditherer-sample" type="button" data-sample="brightsignals" data-url="{{ '/assets/img/ditherer/BrightSignals.jpg' | relative_url }}" aria-pressed="false">
          <img src="{{ '/assets/img/ditherer/BrightSignals.jpg' | relative_url }}" alt="Traffic lights against a blue sky">
        </button>
      </div>
      <input id="ditherer-file" type="file" accept="image/*" aria-label="Upload your own image">
    </div>

    <div class="tool-group">
      <label class="tool-label" for="ditherer-preset">Palette</label>
      <select id="ditherer-preset">
        <option value="custom" selected>Custom</option>
        <option value="bw">Black / White</option>
        <option value="rgb">Red / Gray / Black</option>
        <option value="gameboy">Game Boy</option>
      </select>
      <div class="ditherer-palette-editor" id="ditherer-palette-editor" aria-label="Palette colors"></div>
      <input id="ditherer-color-picker" class="ditherer-color-picker" type="color" tabindex="-1" aria-hidden="true">
    </div>

    <div class="tool-group">
      <label class="tool-label" for="ditherer-pixel">Pixel size <output id="ditherer-pixel-value">6</output></label>
      <input id="ditherer-pixel" type="range" min="2" max="24" step="1" value="6">
    </div>

    <details class="tool-group tool-more">
      <summary>More controls</summary>

      <div class="ditherer-field">
        <label class="tool-label" for="ditherer-method">Mapping</label>
        <select id="ditherer-method">
          <option value="bands" selected>Luminance bands</option>
          <option value="closest">Closest RGB</option>
        </select>
      </div>

      <div class="ditherer-field" id="ditherer-stochastic-row">
        <label class="ditherer-check">
          <input id="ditherer-stochastic" type="checkbox">
          Stochastic mix (top-2)
        </label>
      </div>

      <div class="ditherer-field">
        <label class="tool-label" for="ditherer-k">Colors used (0 = all)</label>
        <input id="ditherer-k" type="number" min="0" step="1" value="0">
      </div>

      <div class="ditherer-field">
        <label class="tool-label" for="ditherer-blur">Blur <output id="ditherer-blur-value">0</output></label>
        <input id="ditherer-blur" type="range" min="0" max="0" step="1" value="0">
      </div>

      <div class="ditherer-field">
        <span class="tool-label">Palette order</span>
        <div class="ditherer-palette-actions" aria-label="Palette actions">
          <button id="ditherer-palette-undo" type="button" disabled>Undo</button>
          <button id="ditherer-palette-redo" type="button" disabled>Redo</button>
          <span class="ditherer-palette-actions ditherer-sort-buttons">
            <button type="button" data-sort="luminance">Luminance</button>
            <button type="button" data-sort="hue">Hue</button>
            <button type="button" data-sort="saturation">Saturation</button>
          </span>
        </div>
      </div>

      <div class="ditherer-field">
        <label class="tool-label" for="ditherer-palette">Palette as text</label>
        <input id="ditherer-palette" type="text" value="#000000, #ffffff" spellcheck="false">
      </div>

      <div class="ditherer-field">
        <button class="ditherer-reset" id="ditherer-reset" type="button">Reset controls</button>
      </div>
    </details>

  </div>
</div>

<details class="tool-footnote tool-more">
  <summary>Why this exists</summary>
  <p>Why make this? I needed a custom four-wool sweater design to look good.</p>
  <p>Why interleaved gradient noise? It is <a href="https://youtu.be/au9pce-xg5s?si=yZml3XrG--6LF-a-&t=1177">the best</a>.</p>
</details>

<script type="module" src="{{ '/assets/js/ditherer/main.js' | relative_url | bust_file_cache }}"></script>
