window.BassPatternStorage = (function () {
  "use strict";
  const key = "bayan.bass-patterns.v1",
    M = window.BassPatterns;
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.saved) || value.saved.length > 64) throw new Error("Invalid notebook.");
    const ids = new Set();
    const saved = value.saved.map((entry) => {
      if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || ids.has(entry.id))
        throw new Error("Invalid saved pattern.");
      ids.add(entry.id);
      return { id: entry.id, pattern: M.validate(entry.pattern) };
    });
    if (value.active !== null && !ids.has(value.active)) throw new Error("Invalid active pattern.");
    return { version: 1, draft: M.validate(value.draft), saved, active: value.active };
  }
  function create(getStorage) {
    let previous = null,
      blocked = false,
      error = "";
    return {
      read() {
        try {
          previous = getStorage().getItem(key);
          if (previous === null) return null;
          if (previous.length > 2000000) throw new Error("Too large");
          return validate(JSON.parse(previous));
        } catch (_) {
          blocked = true;
          error = "Browser save unavailable or unreadable. Use Copy to keep your pattern.";
          return null;
        }
      },
      write(value, force = false) {
        if (blocked && !force) return false;
        try {
          const raw = JSON.stringify(validate(value));
          if (raw.length > 2000000) throw new Error("Too large");
          const storage = getStorage();
          if (!force && storage.getItem(key) !== previous) {
            blocked = true;
            error = "Another tab changed this notebook. Copy your pattern before replacing the browser save.";
            return false;
          }
          if (raw !== previous || force) storage.setItem(key, raw);
          previous = raw;
          blocked = false;
          error = "";
          return true;
        } catch (_) {
          error = "Browser saving failed. Use Copy to keep your pattern.";
          return false;
        }
      },
      changed(raw) {
        if (raw !== previous) {
          blocked = true;
          error = "Another tab changed this notebook. Copy your pattern before replacing the browser save.";
        }
      },
      get error() {
        return error;
      },
    };
  }
  return { key, create, validate };
})();
