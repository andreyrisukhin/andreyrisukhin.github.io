// Workbench is the only chord-tool destination. Keep its two document types intact.
(function () {
  "use strict";
  var buttons = [...document.querySelectorAll("[data-workspace]")];
  if (!buttons.length) return;
  // Capture the hash before the set-list importer consumes a legacy share link.
  var initial = new URL(location.href);

  function choose(mode, updateUrl) {
    var setlist = mode === "setlist";
    window.WorkbenchPlayer.stop();
    window.StradellaTool.stop();
    document.getElementById("workspace-study").hidden = setlist;
    document.getElementById("workspace-setlist").hidden = !setlist;
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.workspace === mode));
    });
    if (updateUrl) {
      var url = new URL(location.href);
      ["chart", "section", "chartkey"].forEach(function (key) {
        url.searchParams.delete(key);
      });
      url.searchParams.set("workspace", mode);
      url.searchParams.delete("practice");
      url.searchParams.delete("song");
      // Do not leave a hidden set-list section as the current scroll target.
      if (!setlist && ["#recognize", "#recipes", "#setlist-search"].includes(url.hash)) url.hash = "";
      history.replaceState(null, "", url);
    }
  }

  function revealAnchor(hash) {
    if (!["#recognize", "#recipes", "#setlist-search"].includes(hash)) return;
    var target = document.querySelector(hash);
    for (var node = target; node; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
    }
    // A target already visible from the top keeps the page title and section links in view.
    var top = target.getBoundingClientRect().top + window.scrollY;
    if (top + 160 < window.innerHeight) window.scrollTo(0, 0);
    else target.scrollIntoView();
  }

  function init() {
    var mode =
      initial.searchParams.get("workspace") === "setlist" ||
      initial.searchParams.has("song") ||
      initial.searchParams.has("chart") ||
      initial.hash.startsWith("#load=") ||
      ["#recognize", "#recipes", "#setlist-search"].includes(initial.hash)
        ? "setlist"
        : "study";
    choose(mode, false);
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        choose(button.dataset.workspace, true);
      });
    });
    try {
      if (initial.searchParams.has("practice")) {
        var index = initial.searchParams.get("practice");
        if (!/^\d+$/.test(index) || !window.WorkbenchStudy.loadSaved(Number(index))) throw new Error("Saved study not found.");
      } else if (initial.searchParams.has("chart")) {
        var snapshot = window.SongCharts.snapshotFor(
          window.SongChartData,
          initial.searchParams.get("chart"),
          initial.searchParams.get("section"),
          initial.searchParams.get("chartkey")
        );
        var previous = window.StradellaTool.getSnapshot();
        window.StradellaTool.loadSnapshot(snapshot);
        var status = document.getElementById("workspace-status");
        status.textContent = "Chart loaded. ";
        var undo = document.createElement("button");
        undo.type = "button";
        undo.className = "music-share-btn";
        undo.id = "chart-undo";
        undo.textContent = "Undo chart load";
        undo.addEventListener("click", function () {
          window.StradellaTool.loadSnapshot(previous);
          status.textContent = "Restored the previous timed draft.";
        });
        status.appendChild(undo);
      } else if (initial.searchParams.has("song")) {
        var library = window.MusicLibrary.read("setlist");
        if (library.error) throw new Error(library.error);
        var song = library.entries.find(function (entry) {
          return entry.id === initial.searchParams.get("song");
        });
        if (!song || song.snapshot?.tool !== "stradella") throw new Error("This saved song cannot be opened as a set list.");
        window.StradellaTool.loadSnapshot(window.MusicLibrary.stradellaSnapshot(song.snapshot));
      }
      // Named library loads happen once. Reload then recovers the edited draft.
      var url = new URL(location.href);
      url.searchParams.delete("practice");
      url.searchParams.delete("song");
      url.searchParams.set("workspace", mode);
      ["chart", "section", "chartkey"].forEach(function (key) {
        url.searchParams.delete(key);
      });
      history.replaceState(null, "", url);
    } catch (error) {
      document.getElementById("workspace-status").textContent = error.message + " Your saved data has not been changed.";
    }
    if (["#recognize", "#recipes", "#setlist-search"].includes(initial.hash)) {
      revealAnchor(initial.hash);
    } else if (mode === "setlist" && document.querySelector("#stradella-setlist .stradella-empty")) {
      // An empty set list has nothing to show, so start with the catalog that fills it.
      document.getElementById("recipes").open = true;
    }
    window.addEventListener("hashchange", function () {
      if (["#recognize", "#recipes", "#setlist-search"].includes(location.hash)) {
        choose("setlist", true);
        revealAnchor(location.hash);
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
