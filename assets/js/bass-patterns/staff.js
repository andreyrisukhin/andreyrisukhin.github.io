window.BassPatternStaff = (function () {
  "use strict";
  const M = window.BassPatterns,
    ns = "http://www.w3.org/2000/svg",
    unit = 3.875;
  function node(tag, attrs) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }
  function mount(container, pattern, options) {
    const scroll = container.scrollLeft;
    container.replaceChildren();
    // Pale rests are entry slots, never part of the saved or played pattern.
    const preview = M.clone(pattern),
      length = pattern.steps.length;
    for (let i = 0; i < Math.min(4, 128 - length); i++) preview.steps.push({ ticks: options.ticks, presses: [] });
    const score = M.score(preview, pattern.repeat ? length - 1 : -1);
    const tune = window.ABCJS.renderAbc(container, score.abc.replace(/\| \n/g, "|  "), {
      staffwidth: Math.max(360, container.clientWidth / 1.65 - 30, (length + 4) * 40 + 90),
      scale: 1.65,
      add_classes: true,
      paddingtop: 70,
      paddingbottom: 70,
      format: { stretchlast: 1 },
      foregroundColor: getComputedStyle(container).color,
    })[0];
    const svg = container.querySelector("svg");
    if (!svg || !tune) return;
    const width = Number(svg.getAttribute("width")),
      height = Number(svg.getAttribute("height"));
    // Use engraved coordinates and the screen transform, not CSS pixels.
    const group = tune.engraver.staffgroups[0],
      staff = group.staffs[0];
    const elements = tune.lines.flatMap((line) => (line.staff || []).flatMap((s) => s.voices.flat()));
    const entries = elements.flatMap((el) => {
      const segment = M.segmentForElement(score, el);
      if (!segment || !el.abselem) return [];
      const absolute = el.abselem;
      return [{ step: segment.step, x: absolute.x + 5, absolute }];
    });
    const parent = entries[0]?.absolute.elemset[0]?.parentNode;
    if (!parent) return;
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Interactive bass staff");
    svg.style.maxWidth = "none";
    svg.style.width = width + "px";
    svg.style.height = height + "px";
    entries.forEach((entry) => {
      entry.absolute.elemset.forEach((el) => {
        el.dataset.bpStep = entry.step;
        el.classList.toggle("bp-active-note", entry.step === options.selected);
        el.classList.toggle("bp-empty-note", entry.step >= length);
        el.classList.toggle("bp-pinned-note", pattern.steps[entry.step]?.pin !== undefined);
      });
    });
    const overlay = node("g", { class: "bp-staff-overlay" });
    const guide = node("g", { class: "bp-note-preview", "pointer-events": "none", visibility: "hidden" });
    parent.append(overlay, guide);
    function coordinates(event) {
      return new DOMPoint(event.clientX, event.clientY).matrixTransform(parent.getScreenCTM().inverse());
    }
    function pitchAt(y) {
      return Math.max(7, Math.min(41, 16 + Math.round((staff.absoluteY - y) / unit)));
    }
    function previewNote(entry, position) {
      guide.replaceChildren();
      const y = staff.absoluteY - (position - 16) * unit;
      // Ledger lines below G2 and above A3.
      for (let p = 16; p >= position; p -= 2)
        guide.append(
          node("line", { x1: entry.x - 10, x2: entry.x + 10, y1: staff.absoluteY - (p - 16) * unit, y2: staff.absoluteY - (p - 16) * unit })
        );
      for (let p = 28; p <= position; p += 2)
        guide.append(
          node("line", { x1: entry.x - 10, x2: entry.x + 10, y1: staff.absoluteY - (p - 16) * unit, y2: staff.absoluteY - (p - 16) * unit })
        );
      guide.append(node("ellipse", { cx: entry.x, cy: y, rx: 5, ry: 3.5, transform: `rotate(-20 ${entry.x} ${y})` }));
      guide.setAttribute("visibility", "visible");
      const note = M.staffNote(position, options.accidental);
      options.hint(note.name + Math.floor(position / 7) + (entry.step >= length ? " · Click to add" : " · Drag to change pitch"));
    }
    entries.forEach((entry, i) => {
      const left = i ? (entries[i - 1].x + entry.x) / 2 : entry.x - 24;
      const right = entries[i + 1] ? (entry.x + entries[i + 1].x) / 2 : entry.x + 36;
      const hit = node("rect", {
        x: left,
        y: staff.absoluteY - 110,
        width: right - left,
        height: 170,
        fill: "transparent",
        stroke: "none",
        "pointer-events": "all",
        tabindex: 0,
        role: "button",
        "aria-label": entry.step >= length ? "Add note " + (entry.step + 1) : "Edit note " + (entry.step + 1),
        "data-bp-slot": entry.step,
      });
      overlay.append(hit);
      let start = null;
      function nearest(y) {
        const notes = entry.step < length ? M.pitches(pattern.steps[entry.step]) : [];
        return notes.reduce(
          (best, note, index) =>
            Math.abs(M.staffPosition(note) - pitchAt(y)) < best.distance ? { index, distance: Math.abs(M.staffPosition(note) - pitchAt(y)) } : best,
          { index: 0, distance: Infinity }
        ).index;
      }
      hit.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const point = coordinates(event);
        start = { y: event.clientY, position: pitchAt(point.y), note: nearest(point.y), shift: event.shiftKey };
        hit.setPointerCapture(event.pointerId);
        previewNote(entry, start.position);
      });
      hit.addEventListener("pointermove", (event) => {
        previewNote(entry, pitchAt(coordinates(event).y));
      });
      hit.addEventListener("pointerleave", () => {
        if (!start) guide.setAttribute("visibility", "hidden");
      });
      hit.addEventListener("pointercancel", () => {
        start = null;
        guide.setAttribute("visibility", "hidden");
      });
      hit.addEventListener("pointerup", (event) => {
        if (!start) return;
        const state = start;
        start = null;
        hit.releasePointerCapture(event.pointerId);
        const dragged = Math.abs(event.clientY - state.y) > 4,
          position = dragged ? pitchAt(coordinates(event).y) : state.position;
        if (entry.step < length && M.pitches(pattern.steps[entry.step]).length && !dragged && options.mode === "note" && !state.shift)
          options.select(entry.step, state.note);
        else options.write(entry.step, position, state.note, state.shift ? "chord" : dragged ? "move" : options.mode);
      });
      hit.addEventListener("keydown", (event) => options.key(event, entry.step, options.note));
    });
    container.scrollLeft = scroll;
  }
  return { mount };
})();
