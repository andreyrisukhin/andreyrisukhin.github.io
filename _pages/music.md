---
layout: music
title: Bayan notebook
nav_title: music
nav: true
nav_order: 4
permalink: /music/
description: Tools, sheets, and references for bayan and harmony.
keywords: Andrey Bayan, bayandrey, accordion, stradella bass, bayan, music theory, chord recognizer, set list
---

<script>
  // Share links used to point at /music/; the workbench now lives at /music/workbench/.
  if (new URLSearchParams(location.search).has("chords")) {
    location.replace("{{ '/music/workbench/' | relative_url }}" + location.search + location.hash);
  }
</script>

<section class="music-hub-section" id="tools" aria-labelledby="tools-title">
  <h2 id="tools-title">Tools</h2>
  <div class="music-landing-grid">
    <a class="music-landing-card" href="{{ '/music/workbench/' | relative_url }}">
      <span class="music-landing-card__title">Workbench</span>
      <span class="music-landing-card__desc">Build a progression and see each chord as notes, buttons, and sound.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/chord-recognizer/' | relative_url }}">
      <span class="music-landing-card__title">Chord recognizer</span>
      <span class="music-landing-card__desc">Enter notes to name the chord and see its inversions.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/build/' | relative_url }}">
      <span class="music-landing-card__title">Set-list builder</span>
      <span class="music-landing-card__desc">Type a chord like Am7 or A-7/G and get the Stradella voicing.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/stradella/' | relative_url }}">
      <span class="music-landing-card__title">Stradella recipes</span>
      <span class="music-landing-card__desc">Build chords from left-hand bass buttons.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/bass-patterns/' | relative_url }}">
      <span class="music-landing-card__title">Bass patterns</span>
      <span class="music-landing-card__desc">Write a left-hand pattern, assign fingers, and keep a pattern code.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/exercises/' | relative_url }}">
      <span class="music-landing-card__title">Exercises</span>
      <span class="music-landing-card__desc">Practice loops with right-hand patterns and theory notes.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/blues/' | relative_url }}">
      <span class="music-landing-card__title">12-bar blues</span>
      <span class="music-landing-card__desc">Pick a key, see the progression and blues scale.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/bayan-simulator/' | relative_url }}">
      <span class="music-landing-card__title">Bayan simulator</span>
      <span class="music-landing-card__desc">Play a B-system button keyboard with Minecraft note-block sounds.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/songs/' | relative_url }}">
      <span class="music-landing-card__title">Saved songs</span>
      <span class="music-landing-card__desc">Stradella set lists, synced back to the site repo.</span>
    </a>
  </div>
</section>

<section class="music-hub-section" id="sheets" aria-labelledby="sheets-title">
  <h2 id="sheets-title">Sheets</h2>
  <div class="music-landing-grid">
    <a class="music-landing-card" href="{{ '/music/sheet/cogwork-dancers/' | relative_url }}">
      <span class="music-landing-card__title">Cogwork Dancers</span>
      <span class="music-landing-card__desc">Christopher Larkin’s music, arranged for organ.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/sheet/reclaiming-entropy/' | relative_url }}">
      <span class="music-landing-card__title">Reclaiming Entropy</span>
      <span class="music-landing-card__desc">James Primate’s music from Rain World.</span>
    </a>
    <a class="music-landing-card" href="{{ '/music/sheet/reconstructing-more-science/' | relative_url }}">
      <span class="music-landing-card__title">Reconstructing More Science</span>
      <span class="music-landing-card__desc">From the Portal 2 soundtrack. Eight-bar two-hand exercise in F minor.</span>
    </a>
  </div>
</section>

<section class="music-hub-section" id="field-notes" aria-labelledby="notes-title">
  <h2 id="notes-title">References</h2>
  <ul class="music-index">
    <li><a href="{{ '/music/scales/' | relative_url }}">Scales &amp; modes</a></li>
    <li><a href="{{ '/music/chords/' | relative_url }}">Chords from scales</a></li>
    <li><a href="{{ '/music/intervals/' | relative_url }}">Intervals</a></li>
    <li><a href="{{ '/music/stradella/' | relative_url }}">Stradella catalog</a></li>
  </ul>
  <p class="music-small">Made by Andrey Risukhin, also known as Andrey Bayan / @bayandrey.</p>
</section>
