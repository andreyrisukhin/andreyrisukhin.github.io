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
      url.searchParams.set("workspace", mode);
      url.searchParams.delete("practice");
      url.searchParams.delete("song");
      // Do not leave a hidden set-list section as the current scroll target.
      if (!setlist && ["#recognize", "#recipes", "#setlist-search"].includes(url.hash)) url.hash = "";
      history.replaceState(null, "", url);
    }
  }

  function init() {
    var mode =
      initial.searchParams.get("workspace") === "setlist" ||
      initial.searchParams.has("song") ||
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
      history.replaceState(null, "", url);
    } catch (error) {
      document.getElementById("workspace-status").textContent = error.message + " Your saved data has not been changed.";
    }
    if (["#recognize", "#recipes", "#setlist-search"].includes(initial.hash)) {
      document.querySelector(initial.hash).scrollIntoView();
    }
    window.addEventListener("hashchange", function () {
      if (["#recognize", "#recipes", "#setlist-search"].includes(location.hash)) choose("setlist", true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
