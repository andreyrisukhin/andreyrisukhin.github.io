---
layout: page
title: Endgame practice
permalink: /chess/endgames/
description: Find the winning continuation in 1,000 positions from real games.
---

<div class="chess-app" id="endgames" data-assets="{{ '/assets/js/vendor/cm-chessboard/assets/' | relative_url }}">
  <div>
    <p class="endgame-turn" id="eg-turn" aria-live="polite"></p>
    <div class="endgame-stage">
      <div class="chess-board" id="eg-board" aria-label="Practice board"></div>
      <div class="endgame-result" id="eg-result" hidden>
        <strong id="eg-outcome"></strong>
        <button class="chess-button chess-button--primary" id="eg-next">Next position</button>
      </div>
    </div>
    <p class="chess-status" role="status" id="eg-status">Loading the first position…</p>
    <p class="chess-hint" id="eg-line"></p>
  </div>
  <section class="chess-app__panel">
    <h2 id="eg-heading">Practice queue</h2>
    <p id="eg-count"></p>
    <form id="eg-form">
      <label for="eg-input">Move on the board or enter notation</label>
      <div class="chess-actions"><input id="eg-input" placeholder="e.g. Kf6" autocomplete="off" size="10" spellcheck="false"><button class="chess-button">Play</button></div>
    </form>
    <div class="chess-actions">
      <button class="chess-button" id="eg-hint">Hint</button>
      <button class="chess-button" id="eg-show">Show line</button>
    </div>
    <p id="eg-lesson"></p>
    <a id="eg-analyze" href="{{ '/chess/' | relative_url }}" hidden>Explore this line on the scenario board</a>
    <p class="chess-hint" id="eg-save">Progress stays in this browser. Hints and misses return in 10 minutes. Clean solves return after a day, then at longer intervals.</p>
  </section>
</div>

<noscript>Enable JavaScript to play the positions.</noscript>

Positions from the [Lichess open puzzle database](https://database.lichess.org/#puzzles) (CC0). Inspired by Thomas Willemze’s [1001 Chess Endgame Exercises for Beginners](https://www.newinchess.com/media/wysiwyg/product_pdf/9117_1.pdf).

<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/chessboard.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/markers/markers.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/arrows/arrows.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/promotion-dialog/promotion-dialog.css' | relative_url }}">
<script type="module" src="{{ '/assets/js/chess/endgames.js' | relative_url | bust_file_cache }}"></script>
