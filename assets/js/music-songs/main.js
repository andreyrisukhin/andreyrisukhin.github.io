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

  function loadSongs() {
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch (_) {
      /* quota / private mode */
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
    if (!iso) return "—";
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
    if (songs.length === 0) {
      el.innerHTML = '<p class="songs-empty">No saved songs yet. Save one from the <a href="/music/stradella/">Stradella tool</a>.</p>';
      return;
    }
    var html = "";
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
        html += '<button class="music-share-btn" data-action="load">Load into Stradella</button>';
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
          saveSongs(songs);
          renderSongList(loadSongs());
          renderSyncPanel();
        } else if (action === "rename") {
          var nm = window.prompt("New name:", song.name || "");
          if (nm == null) return;
          song.name = nm.trim() || song.name;
          song.updatedAt = new Date().toISOString();
          saveSongs(songs);
          renderSongList(loadSongs());
          renderSyncPanel();
        } else if (action === "load") {
          if (!song.snapshot || song.snapshot.tool !== "stradella") {
            window.alert("This song was saved by a different tool.");
            return;
          }
          try {
            localStorage.setItem("stradella-setlist", JSON.stringify(song.snapshot));
          } catch (_) {
            window.alert("Could not write to localStorage.");
            return;
          }
          window.location.href = "/music/stradella/";
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
            setStatus("OK — " + r.fullName + " (default: " + r.defaultBranch + ")", "ok");
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
      saveSongs(songs);
      return song;
    },
  };
})();
