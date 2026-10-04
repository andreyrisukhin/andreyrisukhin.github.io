---
layout: page
title: Outfit palette
permalink: /color/outfit/
description: "Plan an outfit’s colors and how much of the look each one covers."
---

Pick a color for each piece, then size it by how much of you it covers. Olive shorts cover less than olive chinos, so the same white tee and olive bottoms make a different look. Compare the two examples below. Lock the pieces you already own, and the ideas will build around them.

<div class="outfit" data-outfit>
  <div class="outfit-panel">
    <h2>Color</h2>
    <p class="outfit-selected" id="outfit-selected-label"></p>
    <canvas id="outfit-wheel" class="outfit-wheel" role="img" aria-label="Color wheel. Click to set the selected piece’s hue and saturation; drag a dot to move that piece."></canvas>
    <div class="outfit-field">
      <label for="outfit-value">Lightness <output id="outfit-value-out"></output></label>
      <input id="outfit-value" type="range" min="0" max="100" step="1">
    </div>
    <div class="outfit-field outfit-hex-row">
      <input id="outfit-color-input" type="color" aria-label="Pick color">
      <input id="outfit-hex" type="text" spellcheck="false" aria-label="Hex color">
    </div>
    <div class="outfit-field">
      <span class="outfit-field__label">Clothing colors</span>
      <div class="outfit-swatches" id="outfit-swatches"></div>
    </div>
    <div class="outfit-field">
      <label for="outfit-harmony">Single colors from the anchor</label>
      <select id="outfit-harmony">
        <option value="complementary">Complementary</option>
        <option value="analogous">Analogous</option>
        <option value="split">Split complementary</option>
        <option value="triadic">Triadic</option>
        <option value="monochrome">Lighter and darker</option>
        <option value="neutrals" selected>Neutrals</option>
      </select>
      <div class="outfit-swatches" id="outfit-suggestions"></div>
    </div>
  </div>
  <div class="outfit-workspace">
    <section class="outfit-section" aria-labelledby="outfit-bar-title">
      <h2 id="outfit-bar-title">The look</h2>
      <div class="outfit-bar" id="outfit-bar"></div>
      <p class="outfit-hint"><span id="outfit-auto-note"></span> <button type="button" class="outfit-link-button" id="outfit-auto" hidden>Reset to garment sizes</button></p>
    </section>
    <section class="outfit-section" aria-labelledby="outfit-ideas-title">
      <div class="outfit-section__head">
        <h2 id="outfit-ideas-title">Ideas</h2>
        <button type="button" id="outfit-more">More ideas</button>
      </div>
      <p class="outfit-hint outfit-hint--top" id="outfit-ideas-note"></p>
      <ul class="outfit-ideas" id="outfit-ideas"></ul>
    </section>
    <div class="outfit-split">
      <section class="outfit-section" aria-labelledby="outfit-pieces-title">
        <h2 id="outfit-pieces-title">Pieces</h2>
        <ol class="outfit-pieces" id="outfit-pieces"></ol>
        <div class="outfit-add">
          <select id="outfit-add-garment" aria-label="Garment to add"></select>
          <button type="button" id="outfit-add">Add piece</button>
        </div>
        <ul class="outfit-notes" id="outfit-notes" aria-live="polite"></ul>
      </section>
      <section class="outfit-section outfit-figure-wrap" aria-label="Preview">
        <svg class="outfit-figure" id="outfit-figure" viewBox="0 0 160 312" role="img" aria-label="Figure wearing the outfit">
          <g class="outfit-figure__skin">
            <path data-region="skin" d="M54 62 L42 66 L30 150 L40 152 L52 92 Z" />
            <path data-region="skin" d="M106 62 L118 66 L130 150 L120 152 L108 92 Z" />
            <circle data-region="skin" cx="35" cy="157" r="6" />
            <circle data-region="skin" cx="125" cy="157" r="6" />
            <path data-region="skin" d="M52 150 L108 150 L107 292 L85 292 L80 196 L75 292 L53 292 Z" />
            <rect data-region="skin" x="73" y="48" width="14" height="14" />
          </g>
          <path data-region="top" d="M54 60 Q80 54 106 60 L110 152 L50 152 Z" />
          <path data-region="sleeve-long" d="M54 62 L42 66 L31 146 L41 148 L52 92 Z M106 62 L118 66 L129 146 L119 148 L108 92 Z" />
          <path data-region="sleeve-short" d="M54 62 L42 66 L37 102 L49 104 L52 84 Z M106 62 L118 66 L123 102 L111 104 L108 84 Z" />
          <path data-region="bottom-long" d="M50 148 L110 148 L112 292 L84 292 L80 196 L76 292 L48 292 Z" />
          <path data-region="bottom-short" d="M50 148 L110 148 L112 214 L84 214 L80 192 L76 214 L48 214 Z" />
          <path data-region="socks" d="M53 280 L75 280 L75 292 L53 292 Z M85 280 L107 280 L107 292 L85 292 Z" />
          <path data-region="shoes" d="M52 290 L76 290 L77 303 L42 303 Q42 293 52 290 Z M108 290 L84 290 L83 303 L118 303 Q118 293 108 290 Z" />
          <path data-region="boots" d="M51 270 L77 270 L77 303 L42 303 Q42 292 51 288 Z M109 270 L83 270 L83 303 L118 303 Q118 292 109 288 Z" />
          <rect data-region="belt" x="50" y="146" width="60" height="7" />
          <path data-region="outer" d="M54 60 Q64 57 72 58 L74 158 L47 158 Z M106 60 Q96 57 88 58 L86 158 L113 158 Z" />
          <path data-region="coat" d="M54 60 Q64 57 72 58 L75 222 L44 222 Z M106 60 Q96 57 88 58 L85 222 L116 222 Z" />
          <path data-region="outer-sleeve" d="M54 61 L41 66 L30 144 L42 147 L53 92 Z M106 61 L119 66 L130 144 L118 147 L107 92 Z" />
          <path data-region="outer-sleeve-short" d="M54 61 L41 66 L36 103 L50 106 L53 84 Z M106 61 L119 66 L124 103 L110 106 L107 84 Z" />
          <path data-region="bag" d="M60 62 L126 140 L123 142 L58 65 Z M114 138 L138 138 L138 162 L114 162 Z" />
          <circle data-region="skin" cx="80" cy="34" r="18" />
          <path data-region="hat" d="M62 24 Q62 8 80 8 Q98 8 98 24 Z M54 24 L106 24 L106 28 L54 28 Z" />
        </svg>
        <div class="outfit-field">
          <span class="outfit-field__label">Skin</span>
          <div class="outfit-swatches outfit-swatches--small" id="outfit-skin"></div>
        </div>
      </section>
    </div>
    <section class="outfit-section" aria-labelledby="outfit-saved-title">
      <h2 id="outfit-saved-title">Outfits</h2>
      <span class="outfit-field__label">Examples</span>
      <ul class="outfit-chips" id="outfit-examples"></ul>
      <ul class="outfit-chips" id="outfit-saved" hidden></ul>
      <div class="outfit-save">
        <input id="outfit-save-name" type="text" placeholder="Name this outfit" aria-label="Outfit name">
        <button type="button" id="outfit-save">Save</button>
        <button type="button" id="outfit-copy">Copy link</button>
      </div>
      <p class="outfit-hint" id="outfit-status" role="status"></p>
    </section>
  </div>
</div>

<script defer src="{{ '/assets/js/color-outfit/model.js' | relative_url | bust_file_cache }}"></script>
<script defer src="{{ '/assets/js/color-outfit/main.js' | relative_url | bust_file_cache }}"></script>
