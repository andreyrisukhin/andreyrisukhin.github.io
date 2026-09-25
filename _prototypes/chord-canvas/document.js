window.ChordCanvasDocument = (function () {
  "use strict";
  var F = window.ChordFractions,
    maxBytes = 2 * 1024 * 1024;
  function requireValue(condition, message) {
    if (!condition) throw new Error(message);
  }
  function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function validate(value) {
    requireValue(object(value) && value.format === "chord-canvas", "Not a chord canvas file.");
    requireValue(value.version === 1, "Unsupported canvas file version.");
    var meter = value.meter;
    requireValue(
      object(meter) &&
        Number.isInteger(meter.numerator) &&
        meter.numerator >= 1 &&
        meter.numerator <= 32 &&
        [2, 4, 8, 16].includes(meter.denominator),
      "Invalid meter."
    );
    requireValue(Array.isArray(value.cells) && value.cells.length <= 4096, "A canvas file may contain at most 4096 spans.");
    var ids = new Set(),
      measures = new Map();
    var cells = value.cells.map(function (cell) {
      requireValue(object(cell), "Invalid span.");
      requireValue(Number.isSafeInteger(cell.id) && cell.id > 0 && cell.id <= 1000000000 && !ids.has(cell.id), "Invalid or duplicate span ID.");
      ids.add(cell.id);
      requireValue(Number.isSafeInteger(cell.x) && Number.isSafeInteger(cell.y), "Invalid measure coordinates.");
      var duration = cell.duration;
      requireValue(
        object(duration) &&
          typeof duration.n === "string" &&
          typeof duration.d === "string" &&
          /^[1-9]\d{0,4095}$/.test(duration.n) &&
          /^[1-9]\d{0,4095}$/.test(duration.d),
        "Durations must be positive integer fractions of at most 4096 digits."
      );
      duration = F.make(duration.n, duration.d);
      requireValue(F.compare(duration, F.make(1, 1)) <= 0, "A span cannot exceed one measure.");
      var key = cell.x + "," + cell.y,
        measure = measures.get(key) || { count: 0, total: F.make(0, 1) };
      measure.count++;
      measure.total = F.add(measure.total, duration);
      requireValue(measure.count <= 256 && measure.total.d.length <= 4096, "Measure exceeds the subdivision limit.");
      requireValue(F.compare(measure.total, F.make(1, 1)) <= 0, "Measure durations must sum to one.");
      measures.set(key, measure);
      requireValue(cell.name === null || (typeof cell.name === "string" && cell.name.length <= 100), "Invalid chord name.");
      var chord = cell.name === null ? null : window.WorkbenchModel.fromName(cell.name);
      requireValue(cell.name === null || !!chord, "Unrecognized chord name.");
      return { id: cell.id, x: cell.x, y: cell.y, duration: duration, name: chord ? chord.name : null };
    });
    measures.forEach(function (measure) {
      requireValue(F.compare(measure.total, F.make(1, 1)) === 0, "Measure durations must sum to one.");
    });
    var view = null;
    if (value.view != null) {
      var v = value.view;
      requireValue(
        object(v) &&
          [1, 2, 4, 8, 16, 32, 64].includes(v.zoom) &&
          object(v.pan) &&
          Number.isFinite(v.pan.x) &&
          Number.isFinite(v.pan.y) &&
          Math.abs(v.pan.x) <= 1e20 &&
          Math.abs(v.pan.y) <= 1e20 &&
          (v.selected === null || ids.has(v.selected)) &&
          ["auto", "2", "3", "4", "5", "7", "8", "12", "16", "32", "64"].includes(v.snap),
        "Invalid canvas view."
      );
      view = { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y }, selected: v.selected, snap: v.snap };
    }
    return { format: "chord-canvas", version: 1, meter: { numerator: meter.numerator, denominator: meter.denominator }, cells: cells, view: view };
  }
  function parse(text) {
    requireValue(
      typeof text === "string" && text.length <= maxBytes && new TextEncoder().encode(text).length <= maxBytes,
      "Canvas files must be smaller than 2 MB."
    );
    var value;
    try {
      value = JSON.parse(text);
    } catch (_) {
      throw new Error("This file is not valid JSON.");
    }
    return validate(value);
  }
  function stringify(value) {
    var text = JSON.stringify(validate(value), null, 2);
    requireValue(new TextEncoder().encode(text).length <= maxBytes, "Canvas files must be smaller than 2 MB.");
    return text;
  }
  return { validate: validate, parse: parse, stringify: stringify, maxBytes: maxBytes };
})();
