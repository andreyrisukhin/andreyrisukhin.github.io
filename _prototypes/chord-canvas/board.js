window.ChordCanvasBoard = (function () {
  "use strict";
  var F = window.ChordFractions;
  var zero = F.make(0, 1),
    one = F.make(1, 1);
  function color(chord) {
    var hue = (35 + ((chord.root * 7) % 12) * 30) % 360;
    var suffix = chord.suffix || "";
    return (
      "hsl(" + hue + " " + (/^([79]|11|13)/.test(suffix) ? 62 : 42) + "% " + (/dim|m7b5/.test(suffix) ? 72 : /^m(?!aj)/.test(suffix) ? 77 : 84) + "%)"
    );
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function create() {
    var cells = [],
      past = [],
      future = [],
      nextId = 1,
      meter = { numerator: 4, denominator: 4 };
    function snapshot() {
      return clone({ cells: cells, meter: meter });
    }
    function remember() {
      past.push(snapshot());
      if (past.length > 100) past.shift();
      future = [];
    }
    function get(id) {
      return cells.find(function (cell) {
        return cell.id === id;
      });
    }
    function group(x, y) {
      return cells.filter(function (cell) {
        return cell.x === x && cell.y === y;
      });
    }
    function valid(x, y) {
      return Number.isSafeInteger(x) && Number.isSafeInteger(y);
    }
    function all() {
      var starts = new Map();
      return cells
        .map(function (cell) {
          var key = cell.x + "," + cell.y,
            start = starts.get(key) || zero;
          starts.set(key, F.add(start, cell.duration));
          return Object.assign(clone(cell), { start: clone(start) });
        })
        .sort(function (a, b) {
          return a.y - b.y || a.x - b.x || F.compare(a.start, b.start);
        });
    }
    function at(x, y, fraction) {
      fraction = Math.max(0, Math.min(1, fraction == null ? 0 : fraction));
      var members = all().filter(function (cell) {
        return cell.x === x && cell.y === y;
      });
      return (
        members.find(function (cell) {
          return fraction < F.number(F.add(cell.start, cell.duration)) - 1e-12;
        }) ||
        members[members.length - 1] ||
        null
      );
    }
    function rest(cell) {
      cell.name = null;
      cell.fill = null;
    }
    function writableDuration(value) {
      return F.compare(value, zero) > 0 && F.compare(value, one) <= 0;
    }
    function destination(id, x, y, targetId, side) {
      var source = get(id),
        target = get(targetId);
      if (!source || source.name === null || !valid(x, y)) return { kind: "blocked", message: "Choose a chord to move." };
      if (source.id === targetId) return { kind: "same" };
      if (!target) {
        if (group(x, y).length) return { kind: "blocked", message: "Choose a span in this measure." };
        return { kind: "move", duration: clone(source.duration), start: clone(zero) };
      }
      if (target.x !== x || target.y !== y) return { kind: "blocked", message: "Choose a span in this measure." };
      var placed = all().find(function (cell) {
        return cell.id === target.id;
      });
      if (target.name === null) return { kind: "fill", targetId: target.id, duration: clone(target.duration), start: placed.start };
      if (group(x, y).length >= 256) return { kind: "blocked", message: "This measure has reached the 256-span editing limit." };
      var half = F.div(target.duration, F.make(2, 1));
      return {
        kind: "squeeze",
        targetId: target.id,
        side: side === 0 ? 0 : 1,
        duration: half,
        start: side === 0 ? placed.start : F.add(placed.start, half),
        targetStart: placed.start,
      };
    }
    return {
      all: all,
      at: at,
      get: function (id) {
        return (
          all().find(function (cell) {
            return cell.id === id;
          }) || null
        );
      },
      get meter() {
        return clone(meter);
      },
      destination: destination,
      put: function (x, y, text, id) {
        if (!valid(x, y)) return null;
        var chord = window.WorkbenchModel.fromName(text);
        if (!chord) return null;
        var old = get(id),
          members = group(x, y);
        if (id != null && (!old || old.x !== x || old.y !== y)) return null;
        if (id == null && members.length) return null;
        if (old && old.name === chord.name) return clone(old);
        remember();
        if (!old) {
          old = { id: nextId++, x: x, y: y, duration: clone(one) };
          cells.push(old);
        }
        old.name = chord.name;
        old.fill = color(chord);
        return clone(old);
      },
      move: function (id, x, y, targetId, side) {
        var plan = destination(id, x, y, targetId, side);
        if (plan.kind === "blocked" || plan.kind === "same") return false;
        remember();
        var source = get(id),
          incoming = clone(source),
          target = get(targetId);
        // Keep every other start time intact at the source.
        source.id = nextId++;
        rest(source);
        incoming.x = x;
        incoming.y = y;
        incoming.duration = clone(plan.duration);
        if (plan.kind === "move") {
          cells.push(incoming);
          var remaining = F.sub(one, incoming.duration);
          if (F.compare(remaining, zero) > 0) cells.push({ id: nextId++, x: x, y: y, duration: remaining, name: null, fill: null });
        } else if (plan.kind === "fill") {
          cells[cells.indexOf(target)] = incoming;
        } else {
          target.duration = clone(plan.duration);
          cells.splice(cells.indexOf(target) + (plan.side === 0 ? 0 : 1), 0, incoming);
        }
        return true;
      },
      split: function (id, value) {
        var cell = get(id),
          weights = F.weights(value);
        if (!cell || !weights || group(cell.x, cell.y).length + weights.length - 1 > 256) return false;
        var parts = weights.map(function (weight, i) {
          return {
            id: i ? null : cell.id,
            x: cell.x,
            y: cell.y,
            duration: F.mul(cell.duration, weight),
            name: i ? null : cell.name,
            fill: i ? null : cell.fill,
          };
        });
        remember();
        parts.forEach(function (part, i) {
          if (i) part.id = nextId++;
        });
        cells.splice.apply(cells, [cells.indexOf(cell), 1].concat(parts));
        return true;
      },
      resizePlan: function (leftId, rightId, ratio) {
        var left = get(leftId),
          right = get(rightId);
        if (!left || !right || left.x !== right.x || left.y !== right.y) return null;
        var members = group(left.x, left.y);
        if (members[members.indexOf(left) + 1] !== right || F.compare(ratio, zero) <= 0 || F.compare(ratio, one) >= 0) return null;
        var total = F.add(left.duration, right.duration),
          first = F.mul(total, ratio);
        return { left: first, right: F.sub(total, first) };
      },
      resize: function (leftId, rightId, ratio) {
        var plan = this.resizePlan(leftId, rightId, ratio);
        if (!plan || !writableDuration(plan.left) || !writableDuration(plan.right) || F.compare(get(leftId).duration, plan.left) === 0) return false;
        remember();
        get(leftId).duration = plan.left;
        get(rightId).duration = plan.right;
        return true;
      },
      remove: function (id) {
        var cell = get(id);
        if (!cell || cell.name === null) return false;
        remember();
        rest(cell);
        return true;
      },
      clearMeasure: function (x, y) {
        var members = group(x, y);
        if (
          !members.length ||
          members.some(function (cell) {
            return cell.name !== null;
          })
        )
          return false;
        remember();
        cells = cells.filter(function (cell) {
          return cell.x !== x || cell.y !== y;
        });
        return true;
      },
      setMeter: function (numerator, denominator) {
        if (
          !Number.isInteger(numerator) ||
          numerator < 1 ||
          numerator > 32 ||
          [2, 4, 8, 16].indexOf(denominator) < 0 ||
          (numerator === meter.numerator && denominator === meter.denominator)
        )
          return false;
        remember();
        meter = { numerator: numerator, denominator: denominator };
        return true;
      },
      undo: function () {
        if (!past.length) return false;
        future.push(snapshot());
        var state = past.pop();
        cells = state.cells;
        meter = state.meter;
        return true;
      },
      redo: function () {
        if (!future.length) return false;
        past.push(snapshot());
        var state = future.pop();
        cells = state.cells;
        meter = state.meter;
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
