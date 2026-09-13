// Two independent musical documents behind one shared inspector.
window.WorkbenchSession = (function () {
  "use strict";
  var Model = window.WorkbenchModel;
  var FIELDS = ["items", "index", "key", "degrees", "label", "bpm", "loop", "input"];
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
      state.degrees = options.degrees || null;
      state.label = options.label || "";
    }
    function insert(items, replace) {
      if (state.mode !== "progression" || !items.length || (replace && items.length !== 1)) return false;
      if (!replace && state.items.length + items.length > 128) return false;
      var next = state.items.slice();
      items = items.map(function (model) {
        var copy = Model.restore(Model.entry(model));
        copy.roman = "";
        return copy;
      });
      var index = replace ? state.index : next.length;
      next.splice(index, replace ? 1 : 0, ...items);
      set(next, { key: state.key, index: index });
      return true;
    }
    function remove() {
      if (state.mode !== "progression") return;
      var next = state.items.slice();
      next.splice(state.index, 1);
      set(next, { key: state.key, index: state.index });
    }
    function move(delta) {
      var index = state.index + delta;
      if (state.mode !== "progression" || index < 0 || index >= state.items.length) return;
      var next = state.items.slice();
      var selected = next.splice(state.index, 1)[0];
      next.splice(index, 0, selected);
      set(next, { key: state.key, index: index });
    }
    return { state: state, switchView: switchView, set: set, insert: insert, remove: remove, move: move };
  }
  return { create: create };
})();
