---
layout: page
title: Build a Set List
permalink: /music/build/
---

Three ways to add chords: type a name, pick notes, or browse the catalog. Everything lands in the set list below.

## Search by chord name

Examples: `Am7`, `A-7/G` (jazz minus), `F#-6/A`, `Cmaj9`, `Cdim7`.

<div class="music-share">
  <input type="text" id="chord-search-input" class="music-share-text" placeholder="Type a chord name and press Enter (e.g. A-7/G)" spellcheck="false" autocomplete="off">
  <button id="chord-search-add" class="music-share-btn">Add</button>
</div>
<div id="chord-search-result" class="chord-search-result"></div>
<div id="chord-search-status" class="chord-search-status"></div>

## Set list

<div class="music-share">
  <label>Share:</label>
  <input type="text" id="stradella-share-text" class="music-share-text">
  <button id="stradella-share-copy" class="music-share-btn">Copy</button>
  <button id="stradella-share-load" class="music-share-btn">Load</button>
</div>

<div class="music-share">
  <button id="stradella-save-song" class="music-share-btn">Save as song…</button>
  <a id="stradella-songs-link" class="music-share-btn" href="{{ '/music/songs/' | relative_url }}">Manage songs</a>
</div>

<div class="stradella-options">
  <div class="music-toggle-group" id="stradella-toggle-group">
    <button class="music-toggle-btn is-active" data-layer="recipe">Recipe</button>
    <button class="music-toggle-btn" data-layer="notes">Notes</button>
    <button class="music-toggle-btn" data-layer="intervals">Intervals</button>
    <button class="music-toggle-btn" data-layer="semitones">Semitones</button>
    <button class="music-toggle-btn" data-layer="inversions">Inversions</button>
  </div>
  <label class="stradella-dim7-toggle">
    <input type="checkbox" id="stradella-dim7-check" checked>
    dim7 column
  </label>
</div>

<div id="stradella-setlist" class="stradella-setlist"></div>

## Recognize from notes

Enter notes to identify the chord. The first note is treated as the bass — reorder to see inversions.

<div class="recognizer-note-buttons" id="recognizer-note-buttons"></div>

<div class="recognizer-input-row">
  <input type="text" id="recognizer-text-input" class="music-share-text"
         placeholder="e.g. E G C or Fd7/C">
  <button id="recognizer-undo" class="music-share-btn">Undo</button>
  <button id="recognizer-clear" class="music-share-btn">Clear</button>
</div>

<div id="recognizer-result" class="recognizer-result"></div>

<div id="recognizer-staff" class="recognizer-staff"></div>

## Browse chord types

Click a chord to add it to the set list at the current key.

<div class="stradella-options">
  <button id="stradella-view-toggle" class="music-share-btn">Grid view</button>
</div>

<div class="music-key-bar" id="stradella-key-bar"></div>
<div id="stradella-catalog" class="stradella-catalog"></div>

<noscript><p>This interactive tool requires JavaScript.</p></noscript>

<script>
  window.StradellaButtons = {
    {% for btn in site.data.music.stradella_buttons.buttons %}
    {{ btn.id | jsonify }}: {{ btn.offsets | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/chord-name.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-recipe.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stradella/main.js' | relative_url }}"></script>
<script src="{{ '/assets/js/chord-recognizer/main.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-build/main.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-songs/sync.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-songs/main.js' | relative_url }}"></script>
