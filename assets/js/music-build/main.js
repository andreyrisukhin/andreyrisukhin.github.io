// Chord-name search input for the /music/build/ workflow page.
//
// Listens on an input field and an add button, exposes typed chord
// names (Am7, A-7/G, F#-6/A, Cmaj9, ...) as additions to the shared
// Stradella set list. Parsing + suffix lookup happens through the
// shared ChordName + StradellaData modules; this file is just the
// UI shim.
//
// DOM contract (all optional -- module is a no-op when missing):
//   #chord-search-input    : the text input
//   #chord-search-add      : submit button (also fires on Enter)
//   #chord-search-result   : live preview of what would be added
//   #chord-search-status   : transient success/failure text
//
// Depends on window.StradellaTool.addEntryFromName, exposed by
// assets/js/stradella/main.js. Listed AFTER stradella/main.js in
// the page so StradellaTool is ready by init().
(function () {
  "use strict";

  function findInput() {
    return document.getElementById("chord-search-input");
  }
  function findAddBtn() {
    return document.getElementById("chord-search-add");
  }
  function findResult() {
    return document.getElementById("chord-search-result");
  }
  function findStatus() {
    return document.getElementById("chord-search-status");
  }

  // Build the inline preview shown beneath the input as the user types.
  // Three states:
  //   * empty input               -> blank
  //   * parses + has recipe       -> "Will add: <name> in <key> -- recipe: <recipe>"
  //   * parses, no Stradella row  -> "No recipe for suffix '<x>'"
  //   * doesn't parse             -> "Not a chord name"
  function previewFor(value) {
    var v = (value || "").trim();
    if (!v) return "";
    if (!window.ChordName || !window.StradellaData || !window.Music) return "";
    var parsed = window.ChordName.parseForStradella(v);
    if (!parsed) return "Not a chord name";
    var key = window.ChordName.pcToSemi(parsed.root);
    if (key == null) return "Not a chord name (bad root)";
    var matches = window.StradellaData.findBySuffix(parsed.suffix);
    if (!matches.length) {
      return "No Stradella recipe for suffix " + JSON.stringify(parsed.suffix);
    }
    var c = matches[0];
    var bass = null;
    if (parsed.bass) {
      var b = window.ChordName.pcToSemi(parsed.bass);
      if (b != null && b !== key) bass = b;
    }
    var displayName = window.Music.noteName(key) + c.suffix;
    if (bass != null) displayName += " / " + window.Music.noteName(bass);
    var recipe = window.StradellaData.renderRecipe(c, key, true, bass);
    return "Will add: " + displayName + "  -- recipe: " + recipe;
  }

  function setStatus(text, kind) {
    var el = findStatus();
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind || "";
    if (text) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(function () {
        var live = findStatus();
        if (live) {
          live.textContent = "";
          live.dataset.kind = "";
        }
      }, 2000);
    }
  }

  function setPreview(text) {
    var el = findResult();
    if (!el) return;
    el.textContent = text;
  }

  function attemptAdd() {
    var input = findInput();
    if (!input) return;
    var value = input.value.trim();
    if (!value) return;
    if (!window.StradellaTool || typeof window.StradellaTool.addEntryFromName !== "function") {
      setStatus("Set list not loaded", "error");
      return;
    }
    var added = window.StradellaTool.addEntryFromName(value);
    if (!added) {
      setStatus("Could not add: " + value, "error");
      return;
    }
    setStatus("Added", "success");
    input.value = "";
    setPreview("");
    input.focus();
  }

  function init() {
    var input = findInput();
    var addBtn = findAddBtn();
    if (!input && !addBtn) return; // page doesn't host the search input
    if (input) {
      input.addEventListener("input", function () {
        setPreview(previewFor(input.value));
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          attemptAdd();
        }
      });
    }
    if (addBtn) {
      addBtn.addEventListener("click", function (e) {
        e.preventDefault();
        attemptAdd();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
