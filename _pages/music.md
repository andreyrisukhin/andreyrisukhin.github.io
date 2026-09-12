---
layout: music
title: Bayan workbench
nav_title: music
nav: true
nav_order: 4
permalink: /music/
description: Explore a chord as notes, buttons, notation, and sound.
keywords: Andrey Bayan, bayandrey, accordion, stradella bass, bayan, music theory
---

{% include music-workbench.liquid %}

<section class="music-shelf" id="practice-notebook" aria-labelledby="practice-title">
  <h2 id="practice-title">From the practice notebook</h2>
  <div class="music-shelf-grid">
    <a class="music-shelf-item" href="{{ '/music/exercises/' | relative_url }}">
      <span>Two notes, changing harmony <span aria-hidden="true">↗</span></span>
      <span class="music-small">Reno di Bono’s cycle-of-fifths turnaround. Keep the right hand still; let the bass change its meaning.</span>
    </a>
    <a class="music-shelf-item" href="{{ '/music/sheet/cogwork-dancers/' | relative_url }}">
      <span>Cogwork Dancers <span aria-hidden="true">↗</span></span>
      <span class="music-small">Christopher Larkin’s music, arranged for organ. Read the score and explore its harmony.</span>
    </a>
    <a class="music-shelf-item" href="{{ '/music/blues/' | relative_url }}">
      <span>Twelve bars to play with <span aria-hidden="true">↗</span></span>
      <span class="music-small">A blues progression and its scale, in any key.</span>
    </a>
    <a class="music-shelf-item" href="{{ '/music/bayan-simulator/' | relative_url }}">
      <span>Meet the B-system <span aria-hidden="true">↗</span></span>
      <span class="music-small">A diagonal button keyboard. Try the layout with Minecraft note-block sounds.</span>
    </a>
  </div>
</section>

<section class="music-shelf" id="field-notes" aria-labelledby="notes-title">
  <h2 id="notes-title">Field notes</h2>
  <ul class="music-index">
    <li><a href="{{ '/music/scales/' | relative_url }}">Scales &amp; modes</a></li>
    <li><a href="{{ '/music/chords/' | relative_url }}">Chords from scales</a></li>
    <li><a href="{{ '/music/intervals/' | relative_url }}">Intervals</a></li>
    <li><a href="{{ '/music/stradella/' | relative_url }}">Stradella catalog</a></li>
  </ul>
  <details class="workbench-disclosure">
    <summary>Earlier tools &amp; saved songs</summary>
    <ul class="music-index">
      <li><a href="{{ '/music/build/' | relative_url }}">Set-list builder</a></li>
      <li><a href="{{ '/music/chord-recognizer/' | relative_url }}">Chord recognizer</a></li>
      <li><a href="{{ '/music/songs/' | relative_url }}">Saved songs</a></li>
      <li><a href="{{ '/music/sheet/reclaiming-entropy/' | relative_url }}">Reclaiming Entropy</a></li>
    </ul>
    <p class="music-small">Existing song libraries and shared links still work. Workbench practice is saved separately in this browser.</p>
  </details>
  <p class="music-small">Made by Andrey Risukhin, also known as Andrey Bayan / @bayandrey.</p>
</section>
