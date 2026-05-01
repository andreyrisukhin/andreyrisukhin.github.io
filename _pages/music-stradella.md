---
layout: page
title: Stradella Chord Recipes
permalink: /music/stradella/
---

How to create chords out of root and major, minor, 7th, and dim7 triads.
Format: **Triad + Triad + … / Bass**.
Example: `Em / C` = press C bass + E minor chord.

## Set List

<div class="music-share">
  <label>Share:</label>
  <input type="text" id="stradella-share-text" class="music-share-text">
  <button id="stradella-share-copy" class="music-share-btn">Copy</button>
  <button id="stradella-share-load" class="music-share-btn">Load</button>
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
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stradella/main.js' | relative_url }}"></script>

## Notes

- Some multi-triad stacks (11, 13, altered) are **theoretical full sets**, not ergonomic LH voicings.
- For actual playing: use **1 or 2 triads max**; bring extra tensions in the **right hand**.
- Use the **Key** dropdown above to transpose all recipes to any key.

## Practically

How to identify what chord a stack of notes is? Example: Db, E, A.

1. Root note tells us "X-something" chord. Ex: Db-something.
2. Count semitones from root to other notes. Ex: Db, +3 semitones to E (minor 3rd), +5 semitones to A (minor 6th).
3.

A triad (A C# E) fits this?

### Stradella Chords

- 7th - omits 5th, plays only 1 3 b7
- Implies dim7 can be made ... hmm. Ddim7: D,F,Ab,B G7: G,B,\_,F +

But wait [there's more](https://accordionchords.com/stradella-bass-layouts/60-bass-accordion-chart/)

- Another resource for [chord combos](https://georgewhitfield.co.uk/chord-combinations-on-stradella-basses/)
- Jazz Accordion Solos [youtube](https://www.youtube.com/channel/UCbTwGWrQQJ20odJ7Rpeljrg) [blog](https://accordionchords.com/tutorials/jazz-accordion-solos/)
- Book I wish I had when starting out [blog to pdf](https://accordionchords.com/tutorials/stradella-xtensions-harmonic-technique-for-the-accordion/), [Stradella Xtensions](https://sites.google.com/view/download-book/home) by Evan Perry-Giblin, former owner of Brooklyn Bellows
