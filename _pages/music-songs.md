---
layout: music
title: Song library
permalink: /music/songs/
---

Saved studies and Stradella set lists, kept in this browser. Open either in [Workbench]({{ '/music/workbench/' | relative_url }}). Their original formats stay intact: studies keep note order, hand choices, and progression settings; set lists keep chord durations, meter, and recipes.

<p id="songs-library-status" role="status"></p>
<div id="songs-list" class="songs-list" data-workbench-url="{{ '/music/workbench/' | relative_url }}"></div>
<div class="music-share">
  <button type="button" id="songs-export-study" class="music-share-btn">Export studies</button>
  <button type="button" id="songs-export-setlist" class="music-share-btn">Export set lists</button>
</div>
<p class="music-small">Study backups can be imported from Workbench’s Saved practice drawer. Set-list backups keep the original song records. Backups contain no sync credentials.</p>

<h2 id="song-charts-heading">Song charts</h2>

<p>Open a whole song or one section in Workbench’s timed editor. Chord lengths, section labels, and meter stay intact. Loading a chart replaces the current timed draft; Undo restores it.</p>
<div id="song-charts" class="song-charts" data-workbench-url="{{ '/music/workbench/' | relative_url }}"></div>
<p id="song-charts-status" class="song-charts-status" role="status"></p>

<details><summary>Set-list sync</summary>

<p>Optional sync sends Stradella set lists to the <code>songs-inbox</code> branch so the laptop can pull them with <code>bin/songs-pull</code>. Studies stay local and are not included in sync.</p>

<p class="songs-sync-help">
  Create a fine-grained GitHub token at <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a>, scope it to <em>only</em> this repo, grant <strong>Contents: Read and write</strong>, then paste it below. The token stays in this browser's local storage; the page never sends it anywhere except <code>api.github.com</code>.
</p>

<div class="songs-sync-grid">
  <label class="songs-sync-row">
    <span>GitHub token</span>
    <input type="password" id="songs-sync-pat" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
  </label>
  <label class="songs-sync-row">
    <span>Owner</span>
    <input type="text" id="songs-sync-owner" autocomplete="off" spellcheck="false">
  </label>
  <label class="songs-sync-row">
    <span>Repo</span>
    <input type="text" id="songs-sync-repo" autocomplete="off" spellcheck="false">
  </label>
  <label class="songs-sync-row">
    <span>Branch</span>
    <input type="text" id="songs-sync-branch" autocomplete="off" spellcheck="false">
  </label>
</div>

<div class="songs-sync-actions">
  <button id="songs-sync-save" class="music-share-btn">Save settings</button>
  <button id="songs-sync-verify" class="music-share-btn">Verify</button>
  <button id="songs-sync-push" class="music-share-btn">Sync now</button>
  <button id="songs-sync-clear-pat" class="music-share-btn">Forget token</button>
</div>

<dl class="songs-sync-info">
  <dt>Last sync</dt><dd id="songs-sync-last">never</dd>
  <dt>Pending</dt><dd id="songs-sync-pending">0</dd>
</dl>

<p id="songs-sync-status" class="songs-sync-status"></p>

</details>

<noscript><p>This page needs JavaScript.</p></noscript>

<script src="{{ '/assets/js/vendor/tonal.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/common.js' | relative_url }}"></script>
<script src="{{ '/assets/js/workbench/model.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/chord-name.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music/stradella-data.js' | relative_url }}"></script>
<script>window.SongChartData = {{ site.data.music.song_charts.charts | jsonify }};</script>
<script src="{{ '/assets/js/music-build/charts.js?v=4' | relative_url }}"></script>
<script src="{{ '/assets/js/music-songs/library.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-songs/sync.js' | relative_url }}"></script>
<script src="{{ '/assets/js/music-songs/main.js?v=2' | relative_url }}"></script>

<style>
  .songs-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
  .songs-empty { color: var(--global-text-color-light, #888); font-style: italic; }
  .songs-card { border: 1px solid var(--global-divider-color, #ddd); border-radius: 6px; padding: 0.75rem 1rem; }
  .songs-card__header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .songs-card__name { margin: 0; font-size: 1.1rem; }
  .songs-card__badge { font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
  .songs-card__badge.is-pending { background: #fef3c7; color: #92400e; }
  .songs-card__badge.is-synced { background: #dcfce7; color: #166534; }
  .songs-card__meta { display: grid; grid-template-columns: max-content 1fr; column-gap: 0.5rem; row-gap: 0.1rem; margin: 0.4rem 0; font-size: 0.875rem; }
  .songs-card__meta dt { color: var(--global-text-color-light, #888); }
  .songs-card__meta dd { margin: 0; }
  .songs-card__notes { font-size: 0.875rem; margin: 0.4rem 0; white-space: pre-wrap; }
  .songs-card__actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .songs-sync-help { font-size: 0.875rem; color: var(--global-text-color-light, #555); }
  .songs-sync-grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; max-width: 480px; }
  .songs-sync-row { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.875rem; }
  .songs-sync-row input { padding: 0.4rem 0.5rem; border: 1px solid var(--global-divider-color, #ccc); border-radius: 4px; font-family: inherit; }
  .songs-sync-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
  .songs-sync-info { display: grid; grid-template-columns: max-content 1fr; column-gap: 0.5rem; row-gap: 0.1rem; font-size: 0.875rem; margin-top: 0.6rem; }
  .songs-sync-info dt { color: var(--global-text-color-light, #888); }
  .songs-sync-info dd { margin: 0; }
  .songs-sync-status { font-size: 0.875rem; min-height: 1.2em; margin-top: 0.4rem; }
  .songs-sync-status.is-ok { color: #166534; }
  .songs-sync-status.is-err { color: #b91c1c; }
</style>
