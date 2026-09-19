window.ChordCanvasBoard = (function () {
  "use strict";
  function color(chord) {
    var hue = (35 + ((chord.root * 7) % 12) * 30) % 360;
    var suffix = chord.suffix || "";
    var minor = /^m(?!aj)/.test(suffix);
    var diminished = /dim|m7b5/.test(suffix);
    var dominant = /^([79]|11|13)/.test(suffix);
    return "hsl(" + hue + " " + (dominant ? 62 : 42) + "% " + (diminished ? 72 : minor ? 77 : 84) + "%)";
  }
  function create() {
    var cells = [],
      past = [],
      future = [],
      nextId = 1;
    function copy(value) {
      return value.map(function (c) {
        return Object.assign({}, c);
      });
    }
    function group(x, y) {
      return cells
        .filter(function (c) {
          return c.x === x && c.y === y;
        })
        .sort(function (a, b) {
          return a.slot - b.slot;
        });
    }
    function at(x, y, slot) {
      var members = group(x, y);
      return (
        members.find(function (c) {
          return c.slot === slot;
        }) || members[0]
      );
    }
    function expand(x, y) {
      var members = group(x, y);
      if (members.length === 1) members[0].slot = null;
    }
    function destination(id, x, y, side) {
      var cell = cells.find(function (c) {
        return c.id === id;
      });
      if (!cell || !valid(x, y)) return { kind: "blocked" };
      side = side === 0 ? 0 : 1;
      if (cell.x === x && cell.y === y) {
        return { kind: cell.slot !== null && cell.slot !== side ? "reorder" : "same", side: side };
      }
      var members = group(x, y);
      return { kind: members.length === 2 ? "blocked" : members.length ? "merge" : "move", side: side };
    }
    function remember() {
      past.push(copy(cells));
      if (past.length > 100) past.shift();
      future = [];
    }
    function valid(x, y) {
      return Number.isSafeInteger(x) && Number.isSafeInteger(y);
    }
    return {
      all: function () {
        return copy(cells).sort(function (a, b) {
          return a.y - b.y || a.x - b.x || a.slot - b.slot;
        });
      },
      at: function (x, y, slot) {
        var c = at(x, y, slot);
        return c ? Object.assign({}, c) : null;
      },
      destination: destination,
      put: function (x, y, text, id) {
        if (!valid(x, y)) return null;
        var chord = window.WorkbenchModel.fromName(text);
        if (!chord) return null;
        var members = group(x, y);
        var old =
          id == null
            ? members[0]
            : members.find(function (c) {
                return c.id === id;
              });
        if ((id != null && !old) || (id == null && members.length > 1)) return null;
        if (old && old.name === chord.name) return Object.assign({}, old);
        remember();
        var cell = { id: old ? old.id : nextId++, x: x, y: y, slot: old ? old.slot : null, name: chord.name, fill: color(chord) };
        if (old) cells[cells.indexOf(old)] = cell;
        else cells.push(cell);
        return Object.assign({}, cell);
      },
      move: function (id, x, y, side) {
        var cell = cells.find(function (c) {
          return c.id === id;
        });
        var plan = destination(id, x, y, side);
        if (plan.kind === "blocked" || plan.kind === "same") return false;
        remember();
        if (plan.kind === "reorder") {
          var partner = group(x, y).find(function (c) {
            return c.id !== id;
          });
          partner.slot = cell.slot;
          cell.slot = plan.side;
          return true;
        }
        var previous = { x: cell.x, y: cell.y };
        var other = at(x, y);
        cell.slot = other ? plan.side : null;
        if (other) other.slot = 1 - plan.side;
        cell.x = x;
        cell.y = y;
        expand(previous.x, previous.y);
        return true;
      },
      remove: function (id) {
        var cell = cells.find(function (c) {
          return c.id === id;
        });
        if (!cell) return false;
        remember();
        cells = cells.filter(function (c) {
          return c.id !== id;
        });
        expand(cell.x, cell.y);
        return true;
      },
      undo: function () {
        if (!past.length) return false;
        future.push(copy(cells));
        cells = past.pop();
        return true;
      },
      redo: function () {
        if (!future.length) return false;
        past.push(copy(cells));
        cells = future.pop();
        return true;
      },
      get canUndo() {
        return past.length > 0;
      },
      get canRedo() {
        return future.length > 0;
      },
    };
  }
  return { create: create, color: color };
})();
