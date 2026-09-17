// Two independent musical documents behind one shared inspector.
window.WorkbenchSession = (function () {
  "use strict";
  var Model = window.WorkbenchModel;
  var FIELDS = ["items", "index", "key", "keyMode", "keyTonic", "gap", "degrees", "label", "bpm", "loop", "sound", "input"];
  function create() {
    var documents = {
      chord: { items: [Model.fromName("Am7")], index: 0, key: 9, degrees: null, label: "", bpm: 96, loop: false, input: "Am7" },
      progression: {
        items: ["2", "5", "1"].map(function (d) {
          return Model.fromDegree(d, 7);
        }),
        index: 0,
        key: 7,
        degrees: ["2", "5", "1"],
        label: "ii–V–I",
        bpm: 96,
        loop: false,
        input: "",
      },
    };
    var state = Object.assign({ mode: "chord" }, documents.chord);
    Object.values(documents).forEach(function (doc) {
      doc.keyMode = "major";
      doc.keyTonic = window.Music.asciiNoteName(doc.key);
      doc.gap = doc.items.length;
      doc.sound = "chords";
    });
    Object.assign(state, documents.chord);
    function switchView(mode) {
      if (!documents[mode] || mode === state.mode) return;
      FIELDS.forEach(function (key) {
        documents[state.mode][key] = state[key];
      });
      Object.assign(state, documents[mode], { mode: mode });
    }
    function set(items, options) {
      options = options || {};
      if (
        !Array.isArray(items) ||
        items.some(function (m) {
          return !m;
        }) ||
        items.length > 128
      )
        throw new Error("Invalid musical selection.");
      var mode = options.mode || state.mode;
      if (mode !== "chord" && mode !== "progression") throw new Error("Invalid view.");
      if (mode === "chord" && items.length > 1) throw new Error("Open a sequence in Progression view.");
      switchView(mode);
      state.items = items.slice();
      state.index = Math.max(0, Math.min(options.index || 0, items.length - 1));
      state.key = options.key == null ? (items[0] ? items[0].root : 0) : options.key;
      state.keyMode = options.keyMode === "minor" ? "minor" : "major";
      state.keyTonic = window.Tonal.Note.chroma(options.keyTonic || "") === state.key ? options.keyTonic : window.Music.asciiNoteName(state.key);
      state.gap = Number.isInteger(options.gap) ? Math.max(0, Math.min(options.gap, items.length)) : items.length;
      state.degrees = options.degrees || null;
      state.label = options.label || "";
    }
    function insert(items, replace) {
      if (state.mode !== "progression" || !items.length || (replace && (items.length !== 1 || !state.items.length))) return false;
      if (!replace && state.items.length + items.length > 128) return false;
      var next = state.items.slice();
      items = items.map(function (model) {
        var copy = Model.restore(Model.entry(model));
        copy.roman = "";
        return copy;
      });
      var index = replace ? state.index : next.length;
      next.splice(index, replace ? 1 : 0, ...items);
      set(next, { key: state.key, keyMode: state.keyMode, keyTonic: state.keyTonic, index: index });
      return true;
    }
    function remove() {
      if (state.mode !== "progression") return;
      var next = state.items.slice();
      next.splice(state.index, 1);
      set(next, { key: state.key, keyMode: state.keyMode, keyTonic: state.keyTonic, index: state.index });
    }
    function move(delta) {
      var index = state.index + delta;
      if (state.mode !== "progression" || index < 0 || index >= state.items.length) return;
      var next = state.items.slice();
      var selected = next.splice(state.index, 1)[0];
      next.splice(index, 0, selected);
      set(next, { key: state.key, keyMode: state.keyMode, keyTonic: state.keyTonic, index: index });
    }
    function snapshot() {
      FIELDS.forEach(function (key) {
        documents[state.mode][key] = state[key];
      });
      var result = { version: 1, mode: state.mode, documents: {} };
      Object.keys(documents).forEach(function (mode) {
        result.documents[mode] = Object.assign({}, documents[mode], { items: documents[mode].items.map(Model.entry) });
      });
      return JSON.parse(JSON.stringify(result));
    }
    function restore(snapshot) {
      if (!snapshot || snapshot.version !== 1 || !["chord", "progression"].includes(snapshot.mode)) throw new Error("Invalid practice draft.");
      var restored = {};
      ["chord", "progression"].forEach(function (mode) {
        var value = snapshot.documents && snapshot.documents[mode];
        if (!value || !Array.isArray(value.items) || value.items.length > (mode === "chord" ? 1 : 128)) throw new Error("Invalid draft selection.");
        var items = value.items.map(Model.restore);
        if (
          items.some(function (item) {
            return !item;
          }) ||
          !Number.isInteger(value.key) ||
          value.key < 0 ||
          value.key > 11
        )
          throw new Error("Invalid draft notes.");
        restored[mode] = {
          items: items,
          key: value.key,
          keyMode: value.keyMode === "minor" ? "minor" : "major",
          keyTonic: window.Tonal.Note.chroma(value.keyTonic || "") === value.key ? value.keyTonic : window.Music.asciiNoteName(value.key),
          index: Number.isInteger(value.index) ? Math.max(0, Math.min(value.index, Math.max(0, items.length - 1))) : 0,
          gap: Number.isInteger(value.gap) ? Math.max(0, Math.min(value.gap, items.length)) : items.length,
          bpm: Number.isFinite(value.bpm) && value.bpm >= 40 && value.bpm <= 200 ? value.bpm : 96,
          loop: value.loop === true,
          input: typeof value.input === "string" ? value.input.slice(0, 500) : "",
          sound: value.sound === "hands" ? "hands" : "chords",
          label: typeof value.label === "string" ? value.label.slice(0, 120) : "",
          degrees: null,
        };
      });
      documents = restored;
      Object.assign(state, documents[snapshot.mode], { mode: snapshot.mode });
    }
    return { state: state, switchView: switchView, set: set, insert: insert, remove: remove, move: move, snapshot: snapshot, restore: restore };
  }
  return { create: create };
})();
