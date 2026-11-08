/* MusicXML is the editable source of truth, never a reconstructed OSMD export. */
(function (root) {
  "use strict";
  const children = (node, name) => [...(node?.children || [])].filter((el) => el.localName === name);
  const child = (node, name) => children(node, name)[0];
  const text = (node, name, fallback = "") => child(node, name)?.textContent || fallback;
  const has = (node, name) => !!child(node, name);
  const descendants = (node, name) => [...node.getElementsByTagName(name)];
  const close = (a, b) => Math.abs(a - b) < 0.000001;
  const TYPES = { whole: 4, half: 2, quarter: 1, eighth: 0.5, "16th": 0.25, "32nd": 0.125, "64th": 0.0625 };
  // MusicXML child order matters when the result is opened in another editor.
  const ORDER = [
    "grace",
    "cue",
    "chord",
    "pitch",
    "unpitched",
    "rest",
    "duration",
    "tie",
    "instrument",
    "footnote",
    "level",
    "voice",
    "type",
    "dot",
    "accidental",
    "time-modification",
    "stem",
    "notehead",
    "notehead-text",
    "staff",
    "beam",
    "notations",
    "lyric",
    "play",
    "listen",
  ];
  function put(parent, name, value) {
    let el = child(parent, name);
    if (!el) {
      el = parent.ownerDocument.createElementNS(parent.namespaceURI, name);
      const next = [...parent.children].find((item) => ORDER.indexOf(item.localName) > ORDER.indexOf(name));
      parent.insertBefore(el, next || null);
    }
    if (value !== undefined) el.textContent = String(value);
    return el;
  }
  const pitch = (node) => {
    const p = child(node, "pitch");
    return p ? { step: text(p, "step"), alter: Number(text(p, "alter", "0")), octave: Number(text(p, "octave")) } : null;
  };
  const pitchKey = (p) => (p ? p.step + ":" + p.alter + ":" + p.octave : "rest");
  const label = (p) =>
    p
      ? p.step +
        (Number.isInteger(p.alter) && Math.abs(p.alter) <= 2 ? (p.alter > 0 ? "♯".repeat(p.alter) : "♭".repeat(-p.alter)) : "(" + p.alter + ")") +
        p.octave
      : "Rest";
  const tieTypes = (node) => new Set([...children(node, "tie"), ...descendants(node, "tied")].map((el) => el.getAttribute("type")));
  function beats(type, dots = 0) {
    if (!Object.prototype.hasOwnProperty.call(TYPES, type) || !Number.isInteger(dots) || dots < 0 || dots > 2)
      throw new Error("Choose a supported note value and zero to two dots.");
    return TYPES[type] * (2 - Math.pow(0.5, dots));
  }
  function index(doc) {
    const entries = [];
    const parts = children(doc.documentElement, "part");
    parts.forEach((part, partIndex) => {
      let divisions = 1,
        absolute = 0;
      children(part, "measure").forEach((measure, measureIndex) => {
        let cursor = 0,
          extent = 0,
          noteIndex = 0,
          group;
        for (const el of measure.children) {
          if (el.localName === "attributes") {
            const value = Number(text(el, "divisions", String(divisions)));
            if (!(value > 0) || !Number.isFinite(value)) throw new Error("Invalid MusicXML divisions.");
            divisions = value;
          } else if (el.localName === "backup" || el.localName === "forward") {
            const duration = Number(text(el, "duration")) / divisions;
            cursor += (el.localName === "backup" ? -1 : 1) * duration;
            extent = Math.max(extent, cursor);
            group = null;
          } else if (el.localName === "note") {
            const grace = has(el, "grace");
            const duration = grace ? 0 : Number(text(el, "duration")) / divisions;
            if (!Number.isFinite(duration) || duration < 0) throw new Error("Invalid MusicXML note duration.");
            const chord = has(el, "chord");
            if (!chord || !group) group = { entries: [], onset: cursor, duration: 0 };
            const entry = {
              node: el,
              part,
              measure,
              partIndex,
              measureIndex,
              noteIndex: noteIndex++,
              partId: part.getAttribute("id"),
              staff: text(el, "staff", "1"),
              voice: text(el, "voice", "1"),
              divisions,
              onset: group.onset,
              absolute: absolute + group.onset,
              duration,
              grace,
              pitch: pitch(el),
              group,
            };
            group.entries.push(entry);
            group.duration = Math.max(group.duration, duration);
            entries.push(entry);
            if (!chord) cursor += duration;
            extent = Math.max(extent, group.onset + duration);
          }
        }
        absolute += extent;
      });
    });
    return entries;
  }
  const address = (entry) => ({ partIndex: entry.partIndex, measureIndex: entry.measureIndex, noteIndex: entry.noteIndex });
  function find(entries, at) {
    const entry = entries.find((e) => e.partIndex === at.partIndex && e.measureIndex === at.measureIndex && e.noteIndex === at.noteIndex);
    if (!entry) throw new Error("This note is no longer in the score. Select it again.");
    return entry;
  }
  function rhythmReason(entry, lane) {
    if (lane.some((e) => !close(e.duration, e.group.duration))) return "Chords with unequal note lengths have read-only rhythms.";
    if (lane.some((e) => e.grace)) return "Grace-note rhythms are read-only.";
    if (lane.some((e) => tieTypes(e.node).size)) return "Tied rhythms are read-only; pitch corrections update the whole tie.";
    if (lane.some((e) => has(e.node, "time-modification") || descendants(e.node, "tuplet").length)) return "Tuplet rhythms are read-only.";
    if (lane.some((e) => e.voice !== entry.voice || e.staff !== entry.staff || !close(e.divisions, entry.divisions)))
      return "Mixed-staff or changing-division rhythms are read-only.";
    if (lane.some((e) => has(e.node, "unpitched"))) return "Unpitched rhythms are read-only.";
    if (
      lane.some((e) => {
        const rest = child(e.node, "rest");
        return (
          rest &&
          (rest.children.length ||
            e.node.getAttributeNames().some((name) => !["id", "default-x", "default-y", "relative-x", "relative-y"].includes(name)) ||
            [...e.node.children].some((node) => !["rest", "duration", "voice", "type", "dot", "staff", "beam"].includes(node.localName)))
        );
      })
    )
      return "Annotated or hidden rests have read-only rhythms.";
    return "";
  }
  function laneFor(entry, entries) {
    const elements = [...entry.measure.children];
    const own = elements.indexOf(entry.node);
    let start = own,
      end = own + 1;
    while (start > 0 && !["backup", "forward"].includes(elements[start - 1].localName)) start--;
    while (end < elements.length && !["backup", "forward"].includes(elements[end].localName)) end++;
    return entries.filter((e) => e.measure === entry.measure && elements.indexOf(e.node) >= start && elements.indexOf(e.node) < end);
  }
  function describe(doc, at) {
    const entries = index(doc),
      entry = find(entries, at);
    return {
      ...address(entry),
      pitch: entry.pitch,
      type: text(entry.node, "type"),
      dots: children(entry.node, "dot").length,
      duration: entry.duration,
      voice: entry.voice,
      staff: entry.staff,
      tied: tieTypes(entry.node).size > 0,
      rhythmReason: rhythmReason(entry, laneFor(entry, entries)),
      members: entry.group.entries.map((e) => ({ ...address(e), label: label(e.pitch) })),
    };
  }
  function linkedTie(entry, entries) {
    const linked = new Set([entry]),
      todo = [entry];
    while (todo.length) {
      const current = todo.pop(),
        types = tieTypes(current.node);
      for (const forward of [false, true]) {
        if (!types.has(forward ? "start" : "stop")) continue;
        const matches = entries.filter(
          (other) =>
            other !== current &&
            other.part === entry.part &&
            other.staff === entry.staff &&
            other.voice === entry.voice &&
            pitchKey(other.pitch) === pitchKey(entry.pitch) &&
            close(forward ? current.absolute + current.duration : current.absolute, forward ? other.absolute : other.absolute + other.duration) &&
            tieTypes(other.node).has(forward ? "stop" : "start")
        );
        if (matches.length !== 1) throw new Error("This tie cannot be matched safely. Correct it in a notation editor.");
        if (!linked.has(matches[0])) {
          linked.add(matches[0]);
          todo.push(matches[0]);
        }
      }
    }
    return [...linked];
  }
  function setPitch(entry, value) {
    if (!entry.pitch) throw new Error("This is a rest or unpitched note.");
    if (
      !/^[A-G]$/.test(value.step) ||
      !Number.isInteger(value.alter) ||
      Math.abs(value.alter) > 2 ||
      !Number.isInteger(value.octave) ||
      value.octave < 0 ||
      value.octave > 9
    )
      throw new Error("Choose a valid pitch, accidental, and octave (0–9).");
    const p = child(entry.node, "pitch");
    // Pitch has its own sequence, unlike the enclosing note.
    const old = [...p.children];
    const values = [["step", value.step], ...(value.alter ? [["alter", value.alter]] : []), ["octave", value.octave]];
    old.forEach((el) => el.remove());
    values.forEach(([name, val]) => {
      const el = p.ownerDocument.createElementNS(p.namespaceURI, name);
      el.textContent = String(val);
      p.appendChild(el);
    });
    put(entry.node, "accidental", { "-2": "flat-flat", "-1": "flat", 0: "natural", 1: "sharp", 2: "double-sharp" }[value.alter]);
  }
  function setDuration(entry, type, dots) {
    const duration = beats(type, dots);
    put(entry.node, "duration", Number((duration * entry.divisions).toFixed(8)));
    put(entry.node, "type", type);
    children(entry.node, "dot").forEach((el) => el.remove());
    for (let i = 0; i < dots; i++) {
      const dot = entry.node.ownerDocument.createElementNS(entry.node.namespaceURI, "dot");
      entry.node.insertBefore(dot, [...entry.node.children].find((el) => ORDER.indexOf(el.localName) > ORDER.indexOf("dot")) || null);
    }
    child(entry.node, "rest")?.removeAttribute("measure");
  }
  function changeDuration(entry, entries, type, dots) {
    const lane = laneFor(entry, entries);
    const reason = rhythmReason(entry, lane);
    if (reason) throw new Error(reason);
    lane.forEach((e) => children(e.node, "beam").forEach((beam) => beam.remove()));
    const groups = [...new Set(lane.map((e) => e.group))];
    const own = groups.indexOf(entry.group);
    const delta = beats(type, dots) - entry.group.duration;
    if (close(delta, 0)) {
      entry.group.entries.forEach((e) => setDuration(e, type, dots));
      return;
    }
    // A voice retains its exact span, so its following backup and other voices do not move.
    let tail = groups.length;
    while (tail > own + 1 && groups[tail - 1].entries.every((e) => has(e.node, "rest"))) tail--;
    const spare = groups.slice(tail).reduce((sum, g) => sum + g.duration, 0);
    if (delta > spare + 0.000001) throw new Error("Not enough trailing rest in this voice. Shorten another note first.");
    const padding = spare - delta;
    const last = lane[lane.length - 1];
    const before = last.node.nextSibling;
    const template = last.node;
    groups.slice(tail).forEach((g) => g.entries.forEach((e) => e.node.remove()));
    entry.group.entries.forEach((e) => setDuration(e, type, dots));
    // Binary note values can always express padding from supported rhythms.
    let remaining = padding;
    const values = Object.entries(TYPES);
    let restCount = 0;
    while (remaining > 0.000001) {
      if (++restCount > 128) throw new Error("This correction would need too many rests. Use a notation editor.");
      const value = values.find(([, duration]) => duration <= remaining + 0.000001);
      if (!value) throw new Error("This rhythm needs a tuplet rest. Use a notation editor.");
      const node = template.ownerDocument.createElementNS(template.namespaceURI, "note");
      put(node, "rest");
      put(node, "duration", Number((value[1] * entry.divisions).toFixed(8)));
      if (has(entry.node, "voice")) put(node, "voice", entry.voice);
      put(node, "type", value[0]);
      if (has(entry.node, "staff")) put(node, "staff", entry.staff);
      entry.measure.insertBefore(node, before);
      remaining -= value[1];
    }
  }
  function apply(doc, at, changes) {
    const copy = doc.cloneNode(true),
      entries = index(copy),
      entry = find(entries, at);
    let changed = false;
    if (changes.pitch && pitchKey(changes.pitch) !== pitchKey(entry.pitch)) {
      linkedTie(entry, entries).forEach((e) => setPitch(e, changes.pitch));
      changed = true;
    }
    if (
      changes.type &&
      (changes.type !== text(entry.node, "type") ||
        changes.dots !== children(entry.node, "dot").length ||
        !close(entry.group.duration, beats(changes.type, changes.dots)))
    ) {
      changeDuration(entry, entries, changes.type, changes.dots);
      changed = true;
    }
    return changed ? copy : null;
  }
  function mapNotes(osmd, doc) {
    const entries = index(doc),
      map = new WeakMap(),
      used = new Set();
    const buckets = new Map();
    const bucketKey = (part, measure, staff) => JSON.stringify([part, measure, Number(staff)]);
    entries.forEach((entry) => {
      const key = bucketKey(entry.partId, entry.measureIndex, entry.staff);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    });
    const sheet = osmd.Sheet;
    (sheet.SourceMeasures || []).forEach((measure, measureIndex) => {
      for (const container of measure.VerticalSourceStaffEntryContainers || []) {
        const onset = (container.Timestamp?.RealValue || 0) * 4;
        for (const sse of container.StaffEntries || []) {
          if (!sse) continue;
          const staff = sse.ParentStaff,
            instrument = staff?.ParentInstrument;
          const localStaff = (instrument?.Staves || []).indexOf(staff) + 1;
          for (const ve of sse.VoiceEntries || []) {
            for (const note of ve.Notes || []) {
              const p = note.Pitch;
              const written = p
                ? {
                    step: p.fundamentalNoteAsString?.toUpperCase() || { 0: "C", 2: "D", 4: "E", 5: "F", 7: "G", 9: "A", 11: "B" }[p.FundamentalNote],
                    alter: p.AccidentalHalfTones ?? 0,
                    octave: p.Octave + 3,
                  }
                : null;
              let possible = (buckets.get(bucketKey(instrument?.IdString, measureIndex, localStaff)) || []).filter(
                (e) => !used.has(e) && close(e.onset, onset) && e.grace === !!note.IsGraceNote
              );
              const voice = possible.filter((e) => e.voice === String(ve.ParentVoice?.VoiceId));
              if (voice.length) possible = voice;
              possible = possible.filter((e) => pitchKey(e.pitch) === pitchKey(written));
              // Never guess between unisons or voices with indistinguishable metadata.
              if (possible.length === 1) {
                map.set(note, address(possible[0]));
                used.add(possible[0]);
              }
            }
          }
        }
      }
    });
    return map;
  }
  const api = { index, address, describe, apply, mapNotes, beats, label, types: TYPES };
  root.SheetCorrectionModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
