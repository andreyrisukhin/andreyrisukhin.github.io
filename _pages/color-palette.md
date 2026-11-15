---
layout: page
title: Color palette
permalink: /color/palette/
breadcrumbs: false
description: "Find colors that work together, then try them on this website."
---

<div class="palette-tool" data-palette-tool>
  <section class="palette-preview" aria-label="Selected palette preview">
    <div id="palette-strip" class="palette-strip"></div>
    <div class="palette-sample" id="palette-sample">
      <span class="tool-label">Paper, ink, and a little color</span>
      <h2>A place for your ideas</h2>
      <p>A quiet background, readable text, and an accent that gives the eye somewhere to land.</p>
      <a href="#palette-controls">Explore the colors</a>
    </div>
  </section>
  <div class="palette-actions">
    <button type="button" class="tool-button--primary" id="palette-apply">Apply to website</button>
    <button type="button" id="palette-reset">Reset website colors</button>
  </div>
  <p id="palette-status" role="status">Your choice changes only this browser.</p>
  <form class="palette-controls tool-group" id="palette-controls">
    <div>
      <label for="palette-seed">Starting color</label>
      <div class="palette-seed">
        <input type="color" id="palette-seed" value="#80533f">
        <input type="text" id="palette-hex" value="#80533f" aria-label="Starting color hex code" spellcheck="false" maxlength="7" pattern="#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})" required>
      </div>
    </div>
    <div>
      <label for="palette-harmony">Color relationship</label>
      <select id="palette-harmony">
        <option value="analogous">Analogous</option>
        <option value="complementary">Complementary</option>
        <option value="split">Split complementary</option>
        <option value="triadic">Triadic</option>
      </select>
    </div>
  </form>
  <section class="tool-group" aria-labelledby="palette-ideas-title">
    <h2 id="palette-ideas-title">Suggested palettes</h2>
    <p id="palette-explanation"></p>
    <div class="palette-ideas" id="palette-ideas"></div>
  </section>
  <details class="tool-more">
    <summary>Color values and readability</summary>
    <p>The starting color sets the hue. Paper, ink, and link colors use adjusted lightness for readable light and dark themes.</p>
    <ul id="palette-values" class="palette-values"></ul>
    <p id="palette-contrast"></p>
  </details>
  <noscript>Enable JavaScript to generate palettes and recolor the website.</noscript>
</div>
<script defer src="{{ '/assets/js/color-palette/main.js' | relative_url | bust_file_cache }}"></script>
