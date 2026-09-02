// Chord-name search input for the /music/build/ workflow page.
//
// Wires a <form> + <input> into window.StradellaTool.addEntryFromName so
// typed chord names (Am7, A-7/G, F#-6/A, Cmaj9, ...) land in the shared
// set list. Parsing + suffix lookup happens through ChordName +
// StradellaData; this file is the UI shim only.
//
// Submit-via-form, not keydown intercept:
//   Earlier versions hooked input.keydown and called preventDefault on
//   Enter. On iOS Safari that handler interacted badly with the soft
//   keyboard in ways that suppressed Backspace on some devices. The
//   form-submit path is more native: the system "Go" / "Return" key
//   fires submit, the browser handles every other key (including
//   Backspace) natively, and the inputmode + autocorrect + autocapitalize
//   attributes on the <input> tell iOS to skip the heuristics that fight
//   chord-shorthand text.
//
// DOM contract (all optional -- module is a no-op when missing):
//   #chord-search-form           : the wrapping form
//   #chord-search-input          : the text input
//   #chord-search-add            : submit button
//   #chord-search-result-name    : preview chord-name (top row)
//   #chord-search-result-recipe  : preview recipe (second row)
//   #chord-search-result-message : preview message for not-a-chord cases
//   #chord-search-status         : transient success/failure text
//
// Depends on window.StradellaTool.addEntryFromName (exposed by
// assets/js/stradella/main.js). The page lists this script AFTER
// stradella/main.js so StradellaTool is ready by init().
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  // Build the structured preview shown beneath the input as the user
  // types. Returns one of:
  //   * null                       -> empty input, preview hidden
  //   * { message }                -> not-a-chord / no-recipe -- shown in message slot
  //   * { name, recipe }           -> matched chord -- shown in two rows
  function previewFor(value) {
    var v = (value || "").trim();
    if (!v) return null;
    if (!window.ChordName || !window.StradellaData || !window.Music) return null;
    var parsed = window.ChordName.parseForStradella(v);
    if (!parsed) return { message: "Not a chord name" };
    var key = window.ChordName.pcToSemi(parsed.root);
    if (key == null) return { message: "Not a chord name (bad root)" };
    var matches = window.StradellaData.findBySuffix(parsed.suffix);
    if (!matches.length) {
      return { message: "No Stradella recipe for " + JSON.stringify(parsed.suffix) };
    }
    var c = matches[0];
    var bass = null;
    if (parsed.bass) {
      var b = window.ChordName.pcToSemi(parsed.bass);
      if (b != null && b !== key) bass = b;
    }
    var name = window.Music.noteName(key) + c.suffix;
    if (bass != null) name += " / " + window.Music.noteName(bass);
    var recipe = window.StradellaData.renderRecipe(c, key, true, bass);
    return { name: name, recipe: recipe };
  }

  function setPreview(preview) {
    var nameEl = $("chord-search-result-name");
    var recipeEl = $("chord-search-result-recipe");
    var msgEl = $("chord-search-result-message");
    if (nameEl) nameEl.textContent = "";
    if (recipeEl) recipeEl.textContent = "";
    if (msgEl) msgEl.textContent = "";
    if (!preview) return;
    if (preview.message) {
      if (msgEl) msgEl.textContent = preview.message;
      return;
    }
    if (nameEl) nameEl.textContent = preview.name;
    if (recipeEl) recipeEl.textContent = preview.recipe;
  }

  function setStatus(text, kind) {
    var el = $("chord-search-status");
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind || "";
    if (text) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(function () {
        var live = $("chord-search-status");
        if (live) {
          live.textContent = "";
          live.dataset.kind = "";
        }
      }, 2000);
    }
  }

  function attemptAdd() {
    var input = $("chord-search-input");
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
    setPreview(null);
    input.focus();
  }

  function init() {
    var form = $("chord-search-form");
    var input = $("chord-search-input");
    if (!form && !input) return; // page doesn't host the search input
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        attemptAdd();
      });
    }
    if (input) {
      // Only an "input" listener -- never "keydown" -- so the browser
      // handles every key (including Backspace, arrow keys, IME
      // composition) natively. See the file-header comment for why.
      input.addEventListener("input", function () {
        setPreview(previewFor(input.value));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
