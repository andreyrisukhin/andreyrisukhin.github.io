---
layout: music
title: Bayan Simulator
permalink: /music/bayan-simulator/
description: A browser-based B-system bayan keyboard for auditioning melodies and chords with Minecraft note-block samples.
keywords: B-system bayan, accordion keyboard, note block sounds
---

<div class="bayan-sim" id="bayan-sim">
  <section class="bayan-sim-keyboard-wrap" aria-label="Bayan keyboard">
    <div class="bayan-sim-range" id="bayan-sim-range">Range: F♯3 to F♯5</div>
    <div class="bayan-sim-keyboard" id="bayan-sim-keyboard"></div>
  </section>

  <section class="bayan-sim-panel" aria-label="Bayan simulator controls">
    <p class="bayan-sim-readout" id="bayan-sim-readout">F♯3 B♭3 D♭4</p>

    <div class="bayan-sim-actions">
      <div class="music-toggle-group" aria-label="Play mode">
        <button class="music-toggle-btn is-active" type="button" id="bayan-sim-build-mode">Build chord</button>
        <button class="music-toggle-btn" type="button" id="bayan-sim-live-mode">Live play</button>
      </div>
      <button class="music-share-btn" type="button" id="bayan-sim-play">Play chord</button>
      <button class="music-share-btn" type="button" id="bayan-sim-roll">Roll up</button>
      <button class="music-share-btn" type="button" id="bayan-sim-clear">Clear</button>
    </div>

    <p class="bayan-sim-label">Quick chords</p>
    <div class="bayan-sim-presets" aria-label="Quick chords">
      <button type="button" data-quality="major">maj</button>
      <button type="button" data-quality="minor">min</button>
      <button type="button" data-quality="sus2">sus2</button>
      <button type="button" data-quality="sus4">sus4</button>
      <button type="button" data-quality="dim">dim</button>
      <button type="button" data-quality="aug">aug</button>
      <button type="button" data-quality="maj7">maj7</button>
      <button type="button" data-quality="min7">min7</button>
      <button type="button" data-quality="dom7">dom7</button>
      <button type="button" data-quality="add9">add9</button>
      <button type="button" data-quality="root">root</button>
      <button type="button" data-quality="octave">octave</button>
    </div>

    <p class="bayan-sim-status" id="bayan-sim-status">
      B-system bayan: bottom-left is the lowest note for the selected Minecraft instrument. Type <code>q a z w s x e d c</code> for chromatic ascending.
    </p>

    <details class="bayan-sim-settings">
      <summary>Sound and range</summary>
      <div class="bayan-sim-actions">
        <button class="music-share-btn" type="button" id="bayan-sim-oct-down">Lower octave</button>
        <button class="music-share-btn" type="button" id="bayan-sim-oct-up">Raise octave</button>
        <button class="music-share-btn" type="button" id="bayan-sim-fit">Fit range</button>
      </div>
      <div class="bayan-sim-controls">
        <label>
          Instrument
          <select id="bayan-sim-instrument"></select>
        </label>
        <label>
          Velocity
          <input id="bayan-sim-velocity" type="range" min="1" max="127" value="100">
          <output id="bayan-sim-velocity-out">100</output>
        </label>
        <label>
          Duration ms
          <input id="bayan-sim-duration" type="range" min="100" max="1800" step="50" value="900">
          <output id="bayan-sim-duration-out">900</output>
        </label>
        <label>
          Gain
          <input id="bayan-sim-gain" type="range" min="0.1" max="2.5" step="0.05" value="0.8">
          <output id="bayan-sim-gain-out">0.8</output>
        </label>
        <label>
          Roll delay ms
          <input id="bayan-sim-roll-delay" type="range" min="20" max="300" step="10" value="70">
          <output id="bayan-sim-roll-delay-out">70</output>
        </label>
      </div>
    </details>

  </section>
</div>

<noscript><p>This interactive tool requires JavaScript.</p></noscript>

<script src="{{ '/assets/js/music/bayan-keyboard.js' | relative_url }}"></script>
<script src="{{ '/assets/js/tactus/audio.js?v=1' | relative_url }}"></script>
<script src="{{ '/assets/js/music/bayan-simulator.js?v=5' | relative_url }}"></script>
