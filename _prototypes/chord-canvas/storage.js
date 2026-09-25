window.ChordCanvasStorage = (function () {
  "use strict";
  var key = "chord-canvas.autosave.v1";
  function create(getStorage) {
    var previous = null,
      blocked = false,
      status = "empty";
    function read() {
      var raw;
      try {
        raw = getStorage().getItem(key);
      } catch (_) {
        blocked = true;
        status = "unavailable";
        return null;
      }
      try {
        var document = raw === null ? null : window.ChordCanvasDocument.parse(raw);
        previous = raw;
        blocked = false;
        status = document ? "saved" : "empty";
        return document;
      } catch (_) {
        blocked = true;
        status = "invalid";
        return null;
      }
    }
    function save(document, force) {
      if (blocked && !force) return false;
      var raw;
      try {
        raw = window.ChordCanvasDocument.stringify(document);
      } catch (_) {
        status = "too-large";
        return false;
      }
      try {
        var storage = getStorage(),
          current = storage.getItem(key);
        if (!force && current !== previous) {
          blocked = true;
          status = "conflict";
          return false;
        }
        if (raw !== current) storage.setItem(key, raw);
        previous = raw;
        blocked = false;
        status = "saved";
        return true;
      } catch (_) {
        status = "unavailable";
        return false;
      }
    }
    return {
      read: read,
      save: save,
      changed: function (raw) {
        if (raw !== previous) {
          blocked = true;
          status = "conflict";
        }
      },
      get status() {
        return status;
      },
      get blocked() {
        return blocked;
      },
    };
  }
  return { key: key, create: create };
})();
