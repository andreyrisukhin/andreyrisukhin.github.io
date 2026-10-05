---
layout: page
title: chess
permalink: /chess/
description: "Set up chess positions, play out lines, and share them as links."
---

The link holds every move, branch, and arrow, so whoever opens it sees the same scenario.

Examples: <a href="{{ '/chess/' | relative_url }}#t=Fried%20Liver&m=e2e4.e7e5.g1f3.b8c6.f1c4.g8f6.f3g5.d7d5.e4d5.f6d5(c6a5.c4b5.c7c6)g5f7.e8f7.d1f3.f7e6.b1c3&at=14&a=14:rf7d8,rf7h8">Fried Liver</a>, <a href="{{ '/chess/' | relative_url }}#t=Back-rank%20mate&fen=6k1/5ppp/8/8/8/8/5PPP/3R2K1_w_-_-_0_1&m=d1d8&a=0:gd1d8">back-rank mate</a>, <a href="{{ '/chess/' | relative_url }}#t=an%20interesting%20situation&o=b&fen=r4rk1/3n1pp1/p4n1p/2pP1Q2/P1B1p3/q7/1bPB1PPP/1R3RK1_b_-_-_0_1">an interesting situation</a>.

<div class="chess-app" data-chess-app data-assets="{{ '/assets/js/vendor/cm-chessboard/assets/' | relative_url }}">
  <div class="chess-app__board-column">
    <div class="chess-material" data-chess-material="top"></div>
    <div class="chess-board" data-chess-board></div>
    <div class="chess-material" data-chess-material="bottom"></div>
    <div class="chess-nav" role="group" aria-label="Step through moves">
      <button type="button" data-chess-action="start" aria-label="First position" title="First position (Up)">&#x23EE;</button>
      <button type="button" data-chess-action="back" aria-label="Previous move" title="Previous move (Left)">&#x25C0;</button>
      <button type="button" data-chess-action="forward" aria-label="Next move" title="Next move (Right)">&#x25B6;</button>
      <button type="button" data-chess-action="end" aria-label="Last position" title="Last position (Down)">&#x23ED;</button>
      <button type="button" data-chess-action="flip" aria-label="Flip board" title="Flip board (F)">&#x21C5;</button>
    </div>
    <p class="chess-status" data-chess-status aria-live="polite"></p>
    <p class="chess-hint">Arrow keys or the scroll wheel over the board step through moves. Right-drag draws an arrow, right-click circles a square. Hold Shift for red, Alt for blue, both for orange.</p>
  </div>

  <div class="chess-app__panel">
    <label class="chess-label" for="chess-title">Scenario name</label>
    <input class="chess-title" id="chess-title" type="text" placeholder="Untitled scenario" maxlength="80" data-chess-title>

    <div class="chess-moves" data-chess-moves aria-label="Moves"></div>

    <div class="chess-actions">
      <button type="button" class="chess-button chess-button--primary" data-chess-action="copy-link">Copy link</button>
      <button type="button" class="chess-button" data-chess-action="save">Save</button>
      <button type="button" class="chess-button" data-chess-action="save-new">Save as new</button>
      <button type="button" class="chess-button" data-chess-action="branch" title="Start a new scenario whose first position is the one on the board">New from here</button>
    </div>
    <div class="chess-actions chess-actions--quiet">
      <button type="button" class="chess-button" data-chess-action="promote" title="Make this branch the main line">Promote line</button>
      <button type="button" class="chess-button" data-chess-action="delete" title="Delete this move and everything after it">Delete from here</button>
      <button type="button" class="chess-button" data-chess-action="clear-notes">Clear arrows</button>
      <button type="button" class="chess-button" data-chess-action="setup">Set up position</button>
      <button type="button" class="chess-button" data-chess-action="copy-pgn">Copy PGN</button>
      <button type="button" class="chess-button" data-chess-action="reset">New game</button>
    </div>
    <p class="chess-toast" data-chess-toast role="status"></p>

    <section class="chess-setup" data-chess-setup hidden>
      <h2>Set up position</h2>
      <p>Drag pieces to move them, or drag one off the board to remove it. Pick a piece below to place it with a click.</p>
      <div class="chess-palette" role="group" aria-label="Placement tool">
        <button type="button" data-chess-tool="move" aria-pressed="true" title="Move pieces">&#x270B;</button>
        <button type="button" data-chess-tool="wk" aria-pressed="false" title="White king">&#x2654;</button>
        <button type="button" data-chess-tool="wq" aria-pressed="false" title="White queen">&#x2655;</button>
        <button type="button" data-chess-tool="wr" aria-pressed="false" title="White rook">&#x2656;</button>
        <button type="button" data-chess-tool="wb" aria-pressed="false" title="White bishop">&#x2657;</button>
        <button type="button" data-chess-tool="wn" aria-pressed="false" title="White knight">&#x2658;</button>
        <button type="button" data-chess-tool="wp" aria-pressed="false" title="White pawn">&#x2659;</button>
        <button type="button" data-chess-tool="erase" aria-pressed="false" title="Remove pieces">&#x2715;</button>
        <button type="button" data-chess-tool="bk" aria-pressed="false" title="Black king">&#x265A;</button>
        <button type="button" data-chess-tool="bq" aria-pressed="false" title="Black queen">&#x265B;</button>
        <button type="button" data-chess-tool="br" aria-pressed="false" title="Black rook">&#x265C;</button>
        <button type="button" data-chess-tool="bb" aria-pressed="false" title="Black bishop">&#x265D;</button>
        <button type="button" data-chess-tool="bn" aria-pressed="false" title="Black knight">&#x265E;</button>
        <button type="button" data-chess-tool="bp" aria-pressed="false" title="Black pawn">&#x265F;</button>
      </div>
      <label class="chess-label" for="chess-turn">Side to move</label>
      <select id="chess-turn" class="chess-select" data-chess-turn>
        <option value="w">White</option>
        <option value="b">Black</option>
      </select>
      <div class="chess-actions">
        <button type="button" class="chess-button chess-button--primary" data-chess-action="setup-done">Use this position</button>
        <button type="button" class="chess-button" data-chess-action="setup-start">Starting position</button>
        <button type="button" class="chess-button" data-chess-action="setup-clear">Empty board</button>
        <button type="button" class="chess-button" data-chess-action="setup-cancel">Cancel</button>
      </div>
    </section>

    <section class="chess-saved">
      <h2>Saved in this browser</h2>
      <ul data-chess-saved></ul>
    </section>

  </div>
</div>

<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/chessboard.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/markers/markers.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/arrows/arrows.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/js/vendor/cm-chessboard/assets/extensions/promotion-dialog/promotion-dialog.css' | relative_url }}">
<script type="module" src="{{ '/assets/js/chess/main.js' | relative_url | bust_file_cache }}"></script>
