// Song charts for /music/build/: turns chord-name bar charts from
// _data/music/song_charts.json into set list entries ({id, key, bass,
// beats, label}) and loads them through window.StradellaTool.
(function () {
  "use strict";

  function resolveChord(name, offset) {
    var CN = window.ChordName;
    var S = window.StradellaData;
    var parsed = CN.parseForStradella(name);
    if (!parsed) return null;
    var root = CN.pcToSemi(parsed.root);
    if (root == null) return null;
    var matches = S.findBySuffix(parsed.suffix);
    if (!matches.length) return null;
    var entry = { id: matches[0].id, key: (root + offset + 12) % 12 };
    if (parsed.bass) {
      var bass = CN.pcToSemi(parsed.bass);
      if (bass != null && bass !== root) entry.bass = (bass + offset + 12) % 12;
    }
    return entry;
  }

  // A bar is "Am7" (whole bar) or "A7 Gdim7" (split evenly across the bar).
  function barEntries(bar, beatsPerBar, offset) {
    var names = String(bar).trim().split(/\s+/);
    var beats = beatsPerBar / names.length;
    return names.map(function (name) {
      var entry = resolveChord(name, offset);
      if (!entry) throw new Error("Unknown chord in song chart: " + name);
      entry.beats = beats;
      return entry;
    });
  }

  function sectionById(chart, id) {
    for (var i = 0; i < chart.sections.length; i++) if (chart.sections[i].id === id) return chart.sections[i];
    return null;
  }

  // sectionIds defaults to the chart's full form.
  function buildEntries(chart, sectionIds, offset) {
    var ids = sectionIds || chart.form;
    var beatsPerBar = chart.beats_per_bar || 4;
    var entries = [];
    ids.forEach(function (id) {
      var section = sectionById(chart, id);
      if (!section) throw new Error("Unknown section in song chart: " + id);
      section.bars.forEach(function (bar, b) {
        barEntries(bar, beatsPerBar, offset || 0).forEach(function (entry, k) {
          if (b === 0 && k === 0) entry.label = section.label;
          entries.push(entry);
        });
      });
    });
    return entries;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderCharts(el, charts) {
    var html = "";
    charts.forEach(function (chart, ci) {
      html += '<div class="song-chart" data-chart="' + ci + '">';
      html += '<div class="song-chart__title">' + esc(chart.title) + "</div>";
      html += '<div class="song-chart__meta">';
      if (chart.source_url) {
        html += '<a href="' + esc(chart.source_url) + '" target="_blank" rel="noopener">' + esc(chart.source) + "</a>";
      } else if (chart.source) {
        html += esc(chart.source);
      }
      html += " \u00b7 " + chart.bpm + " BPM</div>";
      if (chart.keys.length > 1) {
        html += '<div class="music-toggle-group song-chart__keys">';
        chart.keys.forEach(function (k, ki) {
          html +=
            '<button type="button" class="music-toggle-btn' +
            (ki === 0 ? " is-active" : "") +
            '" data-action="key" data-key="' +
            ki +
            '">' +
            esc(k.label) +
            "</button>";
        });
        html += "</div>";
      } else {
        html += '<div class="song-chart__meta">Key: ' + esc(chart.keys[0].label) + "</div>";
      }
      html += '<div class="song-chart__buttons">';
      html += '<button type="button" class="music-share-btn song-chart__load-all" data-action="load">Load whole song</button>';
      chart.sections.forEach(function (section) {
        html +=
          '<button type="button" class="music-share-btn" data-action="load" data-section="' +
          esc(section.id) +
          '">' +
          esc(section.label) +
          "</button>";
      });
      html += "</div></div>";
    });
    el.innerHTML = html;
  }

  function init() {
    var el = document.getElementById("song-charts");
    var charts = window.SongChartData;
    if (!el || !Array.isArray(charts) || !charts.length) return;
    var keyChoice = charts.map(function () {
      return 0;
    });
    renderCharts(el, charts);
    var status = document.getElementById("song-charts-status");

    el.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var box = btn.closest(".song-chart");
      var ci = parseInt(box.getAttribute("data-chart"), 10);
      var chart = charts[ci];
      if (btn.getAttribute("data-action") === "key") {
        keyChoice[ci] = parseInt(btn.getAttribute("data-key"), 10);
        box.querySelectorAll('[data-action="key"]').forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        return;
      }
      var T = window.StradellaTool;
      if (!T) return;
      var current = T.getSnapshot().selected || [];
      var hasOwnChords = current.some(function (entry) {
        return typeof entry.beats !== "number";
      });
      if (hasOwnChords && !window.confirm("Replace the current set list? Save it as a song first if you want to keep it.")) return;
      var sectionId = btn.getAttribute("data-section");
      var key = chart.keys[keyChoice[ci]];
      var entries = buildEntries(chart, sectionId ? [sectionId] : null, key.offset);
      T.loadSnapshot({ selected: entries, bpm: chart.bpm });
      if (status) {
        var what = sectionId ? sectionById(chart, sectionId).label : "whole song";
        status.textContent = "Loaded " + chart.title + " (" + what + ", " + key.label + "). Press Play to hear it.";
      }
    });
  }

  window.SongCharts = { buildEntries: buildEntries, resolveChord: resolveChord };

  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
