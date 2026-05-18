// Stradella Jam Set List — interactive chord recipe tool
// Uses shared data from stradella-data.js
(function () {
  "use strict";

  var M = window.Music;
  var S = window.StradellaData;

  // ── State ──

  var STORAGE_KEY = "stradella-setlist";
  var state = {
    catalogKey: 0,
    selected: [],
    show: { recipe: true, notes: false, intervals: false, semitones: false, inversions: false },
    hasDim7: true,
    gridView: false,
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      // Migrate v1 format: {key: N, selected: ['id', ...]}
      if (typeof s.key === "number" && Array.isArray(s.selected) && s.selected.length > 0 && typeof s.selected[0] === "string") {
        state.catalogKey = s.key;
        var ids = {};
        S.CHORDS.forEach(function (c) {
          ids[c.id] = true;
        });
        state.selected = s.selected
          .filter(function (id) {
            return ids[id];
          })
          .map(function (id) {
            return { id: id, key: s.key };
          });
        saveState();
        return;
      }
      // v2 format: {catalogKey: N, selected: [{id, key}, ...]}
      if (typeof s.catalogKey === "number") state.catalogKey = s.catalogKey;
      if (typeof s.hasDim7 === "boolean") state.hasDim7 = s.hasDim7;
      if (Array.isArray(s.selected)) {
        var valid = {};
        S.CHORDS.forEach(function (c) {
          valid[c.id] = true;
        });
        state.selected = s.selected.filter(function (e) {
          return e && valid[e.id] && typeof e.key === "number";
        });
      }
    } catch (e) {
      /* ignore */
    }
  }

  function isSelectedAtKey(id, key) {
    return state.selected.some(function (e) {
      return e.id === id && e.key === key;
    });
  }

  function addEntry(id, key, bass) {
    var entry = { id: id, key: key };
    if (typeof bass === "number" && bass >= 0 && bass < 12) entry.bass = bass;
    state.selected.push(entry);
    saveState();
  }

  // Add a chord by typed chord name -- "Am7", "A-7/G", "F#-6/A", "Cmaj9".
  // Returns the added entry on success, null if the name doesn't parse or
  // no Stradella recipe matches the suffix. Caller is responsible for
  // calling renderAll() after a successful add (or any UI feedback).
  function addEntryFromName(name) {
    if (!window.ChordName || !window.StradellaData) return null;
    var parsed = window.ChordName.parseForStradella(name);
    if (!parsed) return null;
    var key = window.ChordName.pcToSemi(parsed.root);
    if (key == null) return null;
    var matches = window.StradellaData.findBySuffix(parsed.suffix);
    if (!matches.length) return null;
    // Pick the first match. Multiple recipes for the same suffix are
    // rare (only maj7 has both root and inversion variants); the
    // canonical first entry is the most general.
    var match = matches[0];
    var bass = null;
    if (parsed.bass) {
      var b = window.ChordName.pcToSemi(parsed.bass);
      if (b != null && b !== key) bass = b;
    }
    addEntry(match.id, key, bass);
    return state.selected[state.selected.length - 1];
  }

  function removeEntry(idx) {
    state.selected.splice(idx, 1);
    saveState();
  }

  // ── Export / Import ──

  function exportString() {
    return M.encodeEntries(state.catalogKey, state.selected);
  }

  function importString(str) {
    var validIds = {};
    S.CHORDS.forEach(function (c) {
      validIds[c.id] = true;
    });
    var result = M.decodeEntries(str, validIds);
    if (!result) return false;
    state.catalogKey = result.prefix;
    state.selected = result.entries;
    saveState();
    return true;
  }

  // ── Rendering ──

  function renderChordName(entry, key, bass) {
    var name = M.noteName(key) + entry.suffix;
    if (typeof bass === "number") name += " / " + M.noteName(bass);
    return name;
  }

  function renderSetList() {
    var el = document.getElementById("stradella-setlist");
    if (!el) return;

    if (state.selected.length === 0) {
      el.innerHTML = '<p class="stradella-empty">No chords selected. Use the catalog to add chords.</p>';
      return;
    }

    var html = "";
    state.selected.forEach(function (entry, i) {
      var c = S.chordById(entry.id);
      if (!c) return;
      var key = entry.key;
      var bass = typeof entry.bass === "number" ? entry.bass : null;
      var disabled = !state.hasDim7 && S.usesD7(c) && !c.fallback;
      html += '<div class="stradella-card' + (disabled ? " is-disabled" : "") + '">';
      html += '<button class="stradella-card__remove" data-action="remove" data-idx="' + i + '" aria-label="Remove">&#10005;</button>';
      html += '<div class="stradella-card__chord">' + M.esc(renderChordName(c, key, bass)) + "</div>";
      if (state.show.recipe) {
        html += '<div class="stradella-card__recipe">' + M.esc(S.renderRecipe(c, key, state.hasDim7, bass)) + "</div>";
      }
      var info = M.chordInfo(key, c.suffix);
      if (info && state.show.notes) {
        html += '<div class="stradella-detail stradella-notes">' + M.esc(info.notes.join(" ")) + "</div>";
      }
      if (state.show.intervals && c.intervals) {
        html += '<div class="stradella-detail stradella-intervals">' + M.esc(c.intervals) + "</div>";
      }
      if (state.show.semitones && c.semitones) {
        html += '<div class="stradella-detail stradella-semitones">' + M.esc(c.semitones) + "</div>";
      }
      if (state.show.inversions) {
        var invs = S.computeInversions(c, key);
        if (invs.length > 0) {
          html += '<div class="stradella-inversions">';
          for (var k = 0; k < invs.length; k++) {
            html += '<span class="stradella-inv-item">' + M.esc(invs[k].label) + "</span>";
          }
          html += "</div>";
        }
      }
      html += "</div>";
    });
    el.innerHTML = html;
  }

  function renderCatalog() {
    var el = document.getElementById("stradella-catalog");
    if (!el) return;

    var families = [];
    var familyMap = {};
    S.CHORDS.forEach(function (c) {
      if (!familyMap[c.family]) {
        familyMap[c.family] = [];
        families.push(c.family);
      }
      familyMap[c.family].push(c);
    });

    var key = state.catalogKey;
    var html = "";
    families.forEach(function (fam) {
      html += '<div class="stradella-catalog-family">';
      html += '<h4 class="stradella-catalog-family__title">' + M.esc(fam) + "</h4>";
      var desc = S.FAMILY_DESC[fam];
      if (desc) {
        html += '<p class="stradella-catalog-family__desc">' + M.esc(desc) + "</p>";
      }
      html += '<div class="stradella-catalog-grid">';
      familyMap[fam].forEach(function (c) {
        html += renderChordButton(c, key);
      });
      html += "</div></div>";
    });
    el.innerHTML = html;
  }

  // Render a single chord button (shared between family and grid views)
  function renderChordButton(c, key) {
    var sel = isSelectedAtKey(c.id, key);
    var d7disabled = !state.hasDim7 && S.usesD7(c);
    var noFallback = d7disabled && !c.fallback;
    var cls = "stradella-catalog-item";
    if (sel) cls += " is-selected";
    if (noFallback) {
      cls += " is-disabled";
    } else if (d7disabled && c.fallbackApprox) {
      cls += " is-approx";
    } else if (d7disabled && c.fallbackUncertain) {
      cls += " is-uncertain";
    } else if (c.bug) {
      cls += " is-bug";
    } else if (c.approx) {
      cls += " is-approx";
    } else if (c.uncertain) {
      cls += " is-uncertain";
    }
    var html = '<button class="' + cls + '" data-id="' + c.id + '">';
    html += '<span class="stradella-catalog-item__name">' + M.esc(c.suffix || "maj") + "</span>";
    if (state.show.recipe) {
      html += '<span class="stradella-catalog-item__recipe">' + M.esc(S.renderRecipe(c, key, state.hasDim7)) + "</span>";
    }
    var info = M.chordInfo(key, c.suffix);
    if (info && state.show.notes) {
      html += '<span class="stradella-detail stradella-notes">' + M.esc(info.notes.join(" ")) + "</span>";
    }
    if (state.show.intervals && c.intervals) {
      html += '<span class="stradella-detail stradella-intervals">' + M.esc(c.intervals) + "</span>";
    }
    if (state.show.semitones && c.semitones) {
      html += '<span class="stradella-detail stradella-semitones">' + M.esc(c.semitones) + "</span>";
    }
    if (state.show.inversions) {
      var invs = S.computeInversions(c, key);
      if (invs.length > 0) {
        html += '<span class="stradella-inversions">';
        for (var k = 0; k < invs.length; k++) {
          html += '<span class="stradella-inv-item">' + M.esc(invs[k].label) + "</span>";
        }
        html += "</span>";
      }
    }
    var warnNote = d7disabled && c.fallbackNote ? c.fallbackNote : c.bugNote || c.approxNote || c.uncertainNote;
    if (warnNote) {
      html += '<span class="stradella-catalog-item__warn">' + M.esc(warnNote) + "</span>";
    }
    html += "</button>";
    return html;
  }

  function renderCatalogGrid() {
    var el = document.getElementById("stradella-catalog");
    if (!el) return;

    var key = state.catalogKey;

    // Build lookup: grid[row][col] = [chord, ...]
    var grid = {};
    S.GRID_ROWS.forEach(function (r) {
      grid[r] = {};
      S.GRID_COLS.forEach(function (c) {
        grid[r][c] = [];
      });
    });
    S.CHORDS.forEach(function (c) {
      if (c.quality && c.extension && grid[c.extension] && grid[c.extension][c.quality]) {
        grid[c.extension][c.quality].push(c);
      }
    });

    var html = '<table class="stradella-grid-table"><thead><tr><th></th>';
    S.GRID_COLS.forEach(function (col) {
      html += "<th>" + M.esc(col) + "</th>";
    });
    html += "</tr></thead><tbody>";

    S.GRID_ROWS.forEach(function (row) {
      // Skip empty rows
      var hasContent = S.GRID_COLS.some(function (col) {
        return grid[row][col].length > 0;
      });
      if (!hasContent) return;

      html += "<tr><th>" + M.esc(row) + "</th>";
      S.GRID_COLS.forEach(function (col) {
        var chords = grid[row][col];
        html += "<td>";
        if (chords.length === 0) {
          html += '<span class="stradella-grid-empty">\u2014</span>';
        } else {
          html += '<div class="stradella-grid-cell">';
          chords.forEach(function (c) {
            html += renderChordButton(c, key);
          });
          html += "</div>";
        }
        html += "</td>";
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    el.innerHTML = html;
  }

  function renderKeyBar() {
    var bar = document.getElementById("stradella-key-bar");
    if (!bar) return;
    var html = "";
    M.NOTES.forEach(function (n, i) {
      var cls = "music-key-btn";
      if (i === state.catalogKey) cls += " is-active";
      html += '<button class="' + cls + '" data-key="' + i + '">' + M.esc(n) + "</button>";
    });
    bar.innerHTML = html;
  }

  function renderShareBox() {
    var el = document.getElementById("stradella-share-text");
    if (!el) return;
    el.value = exportString();
  }

  function renderAll() {
    renderKeyBar();
    renderSetList();
    if (state.gridView) {
      renderCatalogGrid();
    } else {
      renderCatalog();
    }
    renderShareBox();
  }

  // ── Events ──

  function loadFromHash() {
    var hash = window.location.hash || "";
    var match = hash.match(/^#load=(.+)$/);
    if (!match) return false;
    var decoded;
    try {
      decoded = decodeURIComponent(match[1]);
    } catch (e) {
      return false;
    }
    // Combined exercise share strings append ";rh=..." for the RH pattern;
    // strip it before decoding the Stradella chord list.
    var rhIdx = decoded.indexOf(";rh=");
    if (rhIdx !== -1) decoded = decoded.substring(0, rhIdx);
    if (!importString(decoded)) return false;
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {
      /* ignore */
    }
    return true;
  }

  function init() {
    loadState();
    loadFromHash();
    renderAll();

    // dim7 toggle checkbox
    var dim7Check = document.getElementById("stradella-dim7-check");
    if (dim7Check) {
      dim7Check.checked = state.hasDim7;
      dim7Check.addEventListener("change", function () {
        state.hasDim7 = dim7Check.checked;
        saveState();
        renderAll();
      });
    }

    // Grid/Family view toggle
    var viewToggle = document.getElementById("stradella-view-toggle");
    if (viewToggle) {
      viewToggle.addEventListener("click", function () {
        state.gridView = !state.gridView;
        viewToggle.textContent = state.gridView ? "Family view" : "Grid view";
        renderAll();
      });
    }

    // Key bar — delegated click on note buttons
    var keyBar = document.getElementById("stradella-key-bar");
    if (keyBar) {
      keyBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".music-key-btn");
        if (!btn) return;
        state.catalogKey = parseInt(btn.getAttribute("data-key"), 10);
        saveState();
        renderAll();
      });
    }

    // Toggle buttons (multi-select)
    var toggleGroup = document.getElementById("stradella-toggle-group");
    if (toggleGroup) {
      toggleGroup.addEventListener("click", function (e) {
        var btn = e.target.closest(".music-toggle-btn");
        if (!btn) return;
        var layer = btn.dataset.layer;
        if (!state.show.hasOwnProperty(layer)) return;
        state.show[layer] = !state.show[layer];
        btn.classList.toggle("is-active", state.show[layer]);
        renderAll();
      });
    }

    // Set list remove (delegated)
    var setListEl = document.getElementById("stradella-setlist");
    if (setListEl) {
      setListEl.addEventListener("click", function (e) {
        var btn = e.target.closest('[data-action="remove"]');
        if (!btn) return;
        removeEntry(parseInt(btn.getAttribute("data-idx"), 10));
        renderAll();
      });
    }

    // Catalog click — add chord at current catalog key
    var catalogEl = document.getElementById("stradella-catalog");
    if (catalogEl) {
      catalogEl.addEventListener("click", function (e) {
        var item = e.target.closest(".stradella-catalog-item");
        if (!item || item.classList.contains("is-disabled")) return;
        var id = item.getAttribute("data-id");
        addEntry(id, state.catalogKey);
        renderAll();
      });
    }

    // Share: copy button
    var copyBtn = document.getElementById("stradella-share-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var el = document.getElementById("stradella-share-text");
        if (!el) return;
        el.select();
        navigator.clipboard.writeText(el.value).then(function () {
          copyBtn.textContent = "Copied!";
          setTimeout(function () {
            copyBtn.textContent = "Copy";
          }, 1500);
        });
      });
    }

    // Share: load button
    var loadBtn = document.getElementById("stradella-share-load");
    if (loadBtn) {
      loadBtn.addEventListener("click", function () {
        var el = document.getElementById("stradella-share-text");
        if (!el) return;
        if (importString(el.value)) {
          renderAll();
          loadBtn.textContent = "Loaded!";
          setTimeout(function () {
            loadBtn.textContent = "Load";
          }, 1500);
        } else {
          loadBtn.textContent = "Invalid";
          setTimeout(function () {
            loadBtn.textContent = "Load";
          }, 1500);
        }
      });
    }

    var saveSongBtn = document.getElementById("stradella-save-song");
    if (saveSongBtn) {
      saveSongBtn.addEventListener("click", function () {
        if (!window.MusicSongs || typeof window.MusicSongs.saveCurrentStradellaAs !== "function") {
          window.alert("Songs module not loaded.");
          return;
        }
        if (state.selected.length === 0) {
          window.alert("Add some chords first.");
          return;
        }
        var name = window.prompt("Song name:");
        if (!name) return;
        var notes = window.prompt("Notes (optional):", "") || "";
        var song = window.MusicSongs.saveCurrentStradellaAs(name, notes);
        if (!song) {
          window.alert("Could not save.");
          return;
        }
        saveSongBtn.textContent = "Saved!";
        setTimeout(function () {
          saveSongBtn.textContent = "Save as song…";
        }, 1500);
      });
    }
  }

  window.StradellaTool = {
    getSnapshot: function () {
      return JSON.parse(JSON.stringify(state));
    },
    loadSnapshot: function (snap) {
      if (!snap || typeof snap !== "object") return false;
      if (typeof snap.catalogKey === "number") state.catalogKey = snap.catalogKey;
      if (Array.isArray(snap.selected)) state.selected = snap.selected.slice();
      if (snap.show && typeof snap.show === "object") state.show = Object.assign({}, state.show, snap.show);
      if (typeof snap.hasDim7 === "boolean") state.hasDim7 = snap.hasDim7;
      if (typeof snap.gridView === "boolean") state.gridView = snap.gridView;
      saveState();
      renderAll();
      return true;
    },
    // Public hooks used by /music/build/'s chord-name search input and
    // by the recognizer's "Add to set list" affordance. They go through
    // the same code path as a catalog click, including saveState and
    // a follow-up renderAll so the new entry is visible immediately.
    addEntry: function (id, key, bass) {
      addEntry(id, key, bass);
      renderAll();
      return state.selected[state.selected.length - 1];
    },
    addEntryFromName: function (name) {
      var added = addEntryFromName(name);
      if (added) renderAll();
      return added;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      S.verify();
    });
  } else {
    init();
    S.verify();
  }
})();
