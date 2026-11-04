// Read the existing stores without converting or rewriting either document format.
(function () {
  "use strict";
  var keys = { study: "musicWorkbenchSetlist", setlist: "stradella-songs" };

  function read(kind) {
    try {
      var raw = localStorage.getItem(keys[kind]);
      var entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) throw new Error("Expected a list.");
      if (kind === "study") window.WorkbenchModel.savedItems(raw);
      else if (
        entries.some(function (entry) {
          return (
            !entry ||
            typeof entry.id !== "string" ||
            ["savedAt", "updatedAt", "syncedAt"].some(function (key) {
              return entry[key] != null && typeof entry[key] !== "string";
            })
          );
        })
      )
        throw new Error("Invalid song.");
      return { raw: raw, entries: entries, error: "" };
    } catch (_) {
      return { entries: [], error: "Could not read " + (kind === "study" ? "studies" : "set lists") + ". Existing data has not been changed." };
    }
  }

  function changeStudy(index, previous, name) {
    var current = read("study");
    if (current.error) throw new Error(current.error);
    if (current.raw !== previous) throw new Error("The library changed in another tab. Reload before editing.");
    if (!Number.isInteger(index) || !current.entries[index]) throw new Error("Study not found.");
    if (name === null) current.entries.splice(index, 1);
    else current.entries[index].name = name;
    localStorage.setItem(keys.study, JSON.stringify(current.entries));
  }

  function stradellaSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.selected)) throw new Error("Invalid set list.");
    var copy = JSON.parse(JSON.stringify(snapshot));
    // The original single-key store used string IDs. Keep the saved source intact.
    copy.selected = copy.selected.map(function (entry) {
      return typeof entry === "string" ? { id: entry, key: copy.key } : entry;
    });
    if (
      copy.selected.some(function (entry) {
        return (
          !entry ||
          !window.StradellaData.chordById(entry.id) ||
          !Number.isInteger(entry.key) ||
          entry.key < 0 ||
          entry.key > 11 ||
          (entry.bass != null && (!Number.isInteger(entry.bass) || entry.bass < 0 || entry.bass > 11)) ||
          (entry.beats != null && (!Number.isInteger(entry.beats) || entry.beats < 1 || entry.beats > 16)) ||
          (entry.label != null && typeof entry.label !== "string")
        );
      })
    )
      throw new Error("This set list contains invalid chords. Its saved data has not been changed.");
    if (copy.catalogKey == null && Number.isInteger(copy.key)) copy.catalogKey = copy.key;
    return copy;
  }

  window.MusicLibrary = { read: read, changeStudy: changeStudy, stradellaSnapshot: stradellaSnapshot };
})();
