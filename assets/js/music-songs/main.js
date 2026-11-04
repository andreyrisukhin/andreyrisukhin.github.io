// Songs list + sync UI for /music/songs/.
// Storage shape:
//   localStorage["stradella-songs"] = [
//     { id, name, notes, savedAt, updatedAt, syncedAt?, syncSha?, snapshot }
//   ]
// snapshot.tool === "stradella" today; the field is present so future
// tools (blues, exercises) can share the same store + sync pipe.
(function () {
  "use strict";

  var STORAGE_KEY = "stradella-songs";
  var Sync = window.MusicSongsSync;
  var Library = window.MusicLibrary;
  var songsReadError = "";
  var renderedStudies = null;

  function loadSongs() {
    if (Library) {
      var store = Library.read("setlist");
      songsReadError = store.error;
      return store.entries;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveSongs(songs) {
    if (songsReadError) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
      return true;
    } catch (_) {
      setStatus("Could not save changes. Existing data has not been changed.", "err");
      return false;
    }
  }

  function newId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDate(iso) {
    if (!iso) return "N/A";
    try {
      var d = new Date(iso);
      return d.toLocaleString();
    } catch (_) {
      return iso;
    }
  }

  function pendingCount(songs) {
    return songs.filter(function (s) {
      return !s.syncedAt || (s.updatedAt && s.updatedAt > s.syncedAt);
    }).length;
  }

  function chordCount(song) {
    return song && song.snapshot && Array.isArray(song.snapshot.selected) ? song.snapshot.selected.length : 0;
  }

  function renderSongList(songs) {
    var el = document.getElementById("songs-list");
    if (!el) return;
    renderedStudies = Library.read("study");
    var status = document.getElementById("songs-library-status");
    if (status) status.textContent = [renderedStudies.error, songsReadError].filter(Boolean).join(" ");
    var base = el.dataset.workbenchUrl;
    if (songs.length === 0 && renderedStudies.entries.length === 0) {
      el.innerHTML = '<p class="songs-empty">No readable saved items. Save a named copy in <a href="' + esc(base) + '">Workbench</a>.</p>';
      return;
    }
    var html = "";
    renderedStudies.entries.forEach(function (item, index) {
      var model = window.WorkbenchModel.savedItems(JSON.stringify([item]))[0];
      html += '<div class="songs-card" data-practice-index="' + index + '">';
      html += '<h3 class="songs-card__name">' + esc(item.name) + "</h3>";
      html +=
        '<p class="music-small">' +
        (model.mode === "progression" ? "Progression study" : "Chord / notes study") +
        " · " +
        model.chords.length +
        " chords · " +
        model.bpm +
        " BPM · local only</p>";
      html +=
        '<div class="songs-card__actions"><a class="music-share-btn" href="' +
        esc(base) +
        "?practice=" +
        index +
        '">Open in Workbench</a><button type="button" class="music-share-btn" data-action="rename">Rename</button>' +
        '<button type="button" class="music-share-btn" data-action="delete">Delete</button></div></div>';
    });
    songs
      .slice()
      .sort(function (a, b) {
        return (b.updatedAt || b.savedAt || "").localeCompare(a.updatedAt || a.savedAt || "");
      })
      .forEach(function (song) {
        var pending = !song.syncedAt || (song.updatedAt && song.updatedAt > song.syncedAt);
        html += '<div class="songs-card" data-id="' + esc(song.id) + '">';
        html += '<div class="songs-card__header">';
        html += '<h3 class="songs-card__name">' + esc(song.name || "(untitled)") + "</h3>";
        html += '<span class="songs-card__badge ' + (pending ? "is-pending" : "is-synced") + '">' + (pending ? "unsynced" : "synced") + "</span>";
        html += "</div>";
        html += '<dl class="songs-card__meta">';
        html += "<dt>Type</dt><dd>Stradella set list</dd>";
        html += "<dt>Chords</dt><dd>" + chordCount(song) + "</dd>";
        html += "<dt>Saved</dt><dd>" + esc(formatDate(song.savedAt)) + "</dd>";
        if (song.updatedAt && song.updatedAt !== song.savedAt) {
          html += "<dt>Updated</dt><dd>" + esc(formatDate(song.updatedAt)) + "</dd>";
        }
        if (song.syncedAt) {
          html += "<dt>Synced</dt><dd>" + esc(formatDate(song.syncedAt)) + "</dd>";
        }
        html += "</dl>";
        if (song.notes) {
          html += '<p class="songs-card__notes">' + esc(song.notes) + "</p>";
        }
        html += '<div class="songs-card__actions">';
        html +=
          '<a class="music-share-btn" href="' + esc(base) + "?workspace=setlist&amp;song=" + encodeURIComponent(song.id) + '">Open in Workbench</a>';
        html += '<button class="music-share-btn" data-action="rename">Rename</button>';
        html += '<button class="music-share-btn" data-action="delete">Delete</button>';
        html += "</div>";
        html += "</div>";
      });
    el.innerHTML = html;
  }

  function setStatus(msg, kind) {
    var el = document.getElementById("songs-sync-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "songs-sync-status" + (kind ? " is-" + kind : "");
  }

  function renderSyncPanel() {
    var s = Sync.getSettings();
    var patEl = document.getElementById("songs-sync-pat");
    var ownerEl = document.getElementById("songs-sync-owner");
    var repoEl = document.getElementById("songs-sync-repo");
    var branchEl = document.getElementById("songs-sync-branch");
    if (patEl && s.pat) patEl.value = s.pat;
    if (ownerEl) ownerEl.value = s.owner || "";
    if (repoEl) repoEl.value = s.repo || "";
    if (branchEl) branchEl.value = s.branch || "";
    var lastEl = document.getElementById("songs-sync-last");
    if (lastEl) lastEl.textContent = s.lastSyncAt ? formatDate(s.lastSyncAt) : "never";
    var pendEl = document.getElementById("songs-sync-pending");
    if (pendEl) pendEl.textContent = pendingCount(loadSongs());
  }

  function persistSettingsFromForm() {
    var pat = (document.getElementById("songs-sync-pat") || {}).value || "";
    var owner = (document.getElementById("songs-sync-owner") || {}).value || "";
    var repo = (document.getElementById("songs-sync-repo") || {}).value || "";
    var branch = (document.getElementById("songs-sync-branch") || {}).value || "songs-inbox";
    Sync.setSettings({
      pat: pat || undefined,
      owner: owner || undefined,
      repo: repo || undefined,
      branch: branch || undefined,
    });
  }

  function attachEvents() {
    var listEl = document.getElementById("songs-list");
    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action]");
        if (!btn) return;
        var card = btn.closest(".songs-card");
        if (!card) return;
        if (card.hasAttribute("data-practice-index")) {
          var studyIndex = Number(card.dataset.practiceIndex);
          var study = renderedStudies.entries[studyIndex];
          if (!study) return;
          var name = null;
          if (btn.dataset.action === "rename") {
            name = window.prompt("New name:", study.name);
            if (name == null || !name.trim()) return;
            name = name.trim();
          } else if (!window.confirm('Delete study "' + study.name + '"?')) return;
          try {
            Library.changeStudy(studyIndex, renderedStudies.raw, name);
            renderSongList(loadSongs());
          } catch (error) {
            document.getElementById("songs-library-status").textContent = error.message;
          }
          return;
        }
        var id = card.getAttribute("data-id");
        var songs = loadSongs();
        var idx = songs.findIndex(function (x) {
          return x.id === id;
        });
        if (idx < 0) return;
        var song = songs[idx];
        var action = btn.getAttribute("data-action");
        if (action === "delete") {
          if (!window.confirm('Delete song "' + (song.name || song.id) + '"? This does not remove it from the repo.')) return;
          songs.splice(idx, 1);
          if (!saveSongs(songs)) return;
          renderSongList(loadSongs());
          renderSyncPanel();
        } else if (action === "rename") {
          var nm = window.prompt("New name:", song.name || "");
          if (nm == null) return;
          song.name = nm.trim() || song.name;
          song.updatedAt = new Date().toISOString();
          if (!saveSongs(songs)) return;
          renderSongList(loadSongs());
          renderSyncPanel();
        }
      });
    }

    var saveBtn = document.getElementById("songs-sync-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        persistSettingsFromForm();
        setStatus("Settings saved.", "ok");
      });
    }

    var clearBtn = document.getElementById("songs-sync-clear-pat");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Forget the GitHub token stored in this browser?")) return;
        Sync.clearPat();
        var patEl = document.getElementById("songs-sync-pat");
        if (patEl) patEl.value = "";
        setStatus("Token forgotten.", "ok");
      });
    }

    var verifyBtn = document.getElementById("songs-sync-verify");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", function () {
        persistSettingsFromForm();
        setStatus("Verifying…");
        Sync.verify().then(
          function (r) {
            setStatus("OK: " + r.fullName + " (default: " + r.defaultBranch + ")", "ok");
          },
          function (err) {
            setStatus("Failed: " + (err.message || err), "err");
          }
        );
      });
    }

    var pushBtn = document.getElementById("songs-sync-push");
    if (pushBtn) {
      pushBtn.addEventListener("click", function () {
        persistSettingsFromForm();
        var songs = loadSongs();
        var pending = pendingCount(songs);
        if (pending === 0) {
          setStatus("Nothing to sync.", "ok");
          return;
        }
        setStatus("Syncing 0/" + pending + "…");
        Sync.pushAll(songs, function (p) {
          setStatus("Syncing " + p.index + "/" + p.total + "… " + (p.song && p.song.name ? p.song.name : ""));
        }).then(
          function (r) {
            saveSongs(songs);
            Sync.setSettings({ lastSyncAt: new Date().toISOString(), lastSyncStatus: "ok" });
            setStatus("Done. Pushed " + r.ok + " song" + (r.ok === 1 ? "" : "s") + ".", "ok");
            renderSongList(loadSongs());
            renderSyncPanel();
          },
          function (err) {
            saveSongs(songs);
            Sync.setSettings({ lastSyncStatus: "error: " + (err.message || err) });
            setStatus("Failed: " + (err.message || err), "err");
            renderSongList(loadSongs());
            renderSyncPanel();
          }
        );
      });
    }
  }

  function init() {
    if (!Sync) return;
    renderSongList(loadSongs());
    renderSyncPanel();
    attachEvents();
    ["study", "setlist"].forEach(function (kind) {
      var button = document.getElementById("songs-export-" + kind);
      if (!button) return;
      button.addEventListener("click", function () {
        var store = Library.read(kind);
        if (store.error) {
          document.getElementById("songs-library-status").textContent = store.error;
          return;
        }
        var url = URL.createObjectURL(new Blob([JSON.stringify(store.entries, null, 2)], { type: "application/json" }));
        var link = document.createElement("a");
        link.href = url;
        link.download = kind === "study" ? "bayan-practice.json" : "stradella-songs.json";
        link.click();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      });
    });
    window.addEventListener("storage", function (event) {
      if (["musicWorkbenchSetlist", STORAGE_KEY, null].includes(event.key)) {
        renderSongList(loadSongs());
        renderSyncPanel();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MusicSongs = {
    load: loadSongs,
    save: saveSongs,
    newId: newId,
    saveCurrentStradellaAs: function (name, notes) {
      var T = window.StradellaTool;
      if (!T || typeof T.getSnapshot !== "function") {
        return null;
      }
      var snap = T.getSnapshot();
      var now = new Date().toISOString();
      var song = {
        id: newId(),
        name: (name || "").trim() || "(untitled)",
        notes: (notes || "").trim(),
        savedAt: now,
        updatedAt: now,
        snapshot: Object.assign({ tool: "stradella", version: 1 }, snap),
      };
      var songs = loadSongs();
      songs.push(song);
      return saveSongs(songs) ? song : null;
    },
  };
})();
