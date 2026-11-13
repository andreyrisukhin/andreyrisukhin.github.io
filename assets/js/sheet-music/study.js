/* Optional learning lanes below each system. Source MusicXML and playback stay untouched. */
(function () {
  "use strict";
  const page = document.querySelector(".sheet-reader");
  const bridge = window.__sheetMusic;
  const M = window.SheetStudyModel;
  if (!page || !bridge || !M || page.dataset.playback !== "true") return;
  const container = document.getElementById("osmd-container");
  const controls = page.querySelector(".sheet-study-controls");
  const chords = page.querySelector("[data-study-chords]");
  const octaves = page.querySelector("[data-study-octaves]");
  const dialog = page.querySelector("[data-study-dialog]");
  let measures = [],
    layer,
    previousButton,
    spacing;
  const enabled = () => chords.checked || octaves.checked;
  const text = (value) => M.pretty(value);
  const beatLabel = (beat) => String(Math.round((beat + 1) * 100) / 100);
  const paragraph = (parent, label, value) => {
    const p = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = label + ": ";
    p.append(strong, document.createTextNode(text(value || "None")));
    parent.append(p);
  };

  function open(measure, button) {
    previousButton = button;
    page.querySelector("#sheet-study-title").textContent = "Measure " + measure.number;
    const detail = page.querySelector("[data-study-detail]");
    detail.replaceChildren();
    for (const segment of measure.segments) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = "Beat " + beatLabel(segment.beat - measure.start) + " · " + text(segment.name) + (segment.inferred ? "?" : "");
      section.append(heading);
      const notes = measure.notes.filter((note) => note.beat < segment.end - 0.00001 && note.endBeat > segment.beat + 0.00001);
      if (segment.inferred) {
        const tones = segment.tones.map((pc) => {
          const note = measure.notes.find((n) => M.pc(n.midi) === pc);
          return M.pitchName(note).replace(/-?\d+$/, "");
        });
        paragraph(section, "Chord tones", tones.join(" · "));
        const extra = M.names(notes.filter((note) => !segment.tones.includes(M.pc(note.midi))));
        if (extra.length) paragraph(section, "Other notes in this window", extra.join(" · "));
        if (segment.alternatives.length) paragraph(section, "Also possible", segment.alternatives.join(" / "));
        if (segment.tones.some((pc) => !notes.some((note) => M.pc(note.midi) === pc))) {
          paragraph(section, "Context", "Some chord tones occur elsewhere in this measure (arpeggio estimate)");
        }
      } else {
        paragraph(section, "Reading", notes.length ? "Pitch collection only; not enough evidence for a chord name" : "Rest");
      }
      paragraph(section, "Bass / lower staff", M.names(notes.filter((note) => note.staff > 1)).join(" · "));
      paragraph(section, "Upper staff", M.names(notes.filter((note) => note.staff === 1)).join(" · "));
      const pairs = M.octavePairs(
        notes.map((note) => ({ ...note, beat: Math.max(note.beat, segment.beat), endBeat: Math.min(note.endBeat, segment.end) }))
      );
      paragraph(
        section,
        "Octave pairs",
        pairs.map((pair) => (pair.staff > 1 ? "Bass " : "Upper ") + pair.low + " + " + pair.high).join("; ") ||
          "No simultaneous octave pair in this window"
      );
      detail.append(section);
    }
    dialog.showModal();
  }
  page.querySelector("[data-study-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => previousButton?.isConnected && previousButton.focus({ preventScroll: true }));

  function read() {
    const timeline = window.SheetPracticeTimeline.fromXML(bridge.xml);
    const transpose = bridge.osmd.Sheet.Transpose || 0;
    if (transpose) {
      const keys = [...bridge.xml.querySelectorAll("score-partwise > part")].map((part) => {
        let fifths = 0;
        return [...part.children]
          .filter((node) => node.tagName === "measure")
          .map((measure) => {
            const key = measure.querySelector("attributes > key > fifths");
            if (key) fifths = Number(key.textContent);
            return fifths;
          });
      });
      timeline.events = timeline.events.map((note) => {
        const match = /^([A-G])([#b]*)(-?\d+)$/.exec(note.pitch);
        if (!match) return { ...note, midi: note.midi + transpose, pitch: undefined };
        const spelled = window.SheetTranspose.transposeNote(
          {
            step: "CDEFGAB".indexOf(match[1]),
            alter: [...match[2]].reduce((sum, c) => sum + (c === "#" ? 1 : -1), 0),
            octave: Number(match[3]),
          },
          keys[note.part][note.measure - 1],
          transpose
        );
        return {
          ...note,
          midi: note.midi + transpose,
          pitch: "CDEFGAB"[spelled.step] + (spelled.alter > 0 ? "#".repeat(spelled.alter) : "b".repeat(-spelled.alter)) + spelled.octave,
        };
      });
    }
    measures = M.analyze(timeline);
  }

  function highlight() {
    container.querySelectorAll(".sheet-octave-note").forEach((el) => el.classList.remove("sheet-octave-note"));
    if (!octaves.checked) return;
    for (const staves of bridge.osmd.GraphicSheet.MeasureList)
      for (const measure of staves) {
        if (!measure) continue;
        const notes = (measure.staffEntries || []).flatMap((entry) =>
          (entry.graphicalVoiceEntries || []).flatMap((voice) => (voice.notes || []).filter((note) => (note.sourceNote || note.SourceNote)?.Pitch))
        );
        const sounding = notes.map((note) => {
          const source = note.sourceNote || note.SourceNote;
          const start = source.getAbsoluteTimestamp().RealValue;
          return { note, midi: source.Pitch.getHalfTone(), start, end: start + source.Length.RealValue };
        });
        for (const current of sounding) {
          if (
            !sounding.some(
              (other) => Math.abs(other.midi - current.midi) === 12 && current.start < other.end - 0.00001 && other.start < current.end - 0.00001
            )
          )
            continue;
          const note = current.note;
          const vf = Array.isArray(note.vfnote) ? note.vfnote[0] : note.vfnote;
          const group = vf?.getSVGElement?.() || vf?.attrs?.el;
          group?.querySelectorAll(".vf-notehead")[note.vfnoteIndex || 0]?.classList.add("sheet-octave-note");
        }
      }
  }

  function render() {
    layer?.remove();
    highlight();
    if (!enabled() || !bridge.ready || !window.SheetPlayhead) return;
    read();
    const steps = window.SheetPlayhead.collectSteps(bridge.osmd);
    const unit = 10 * (bridge.osmd.zoom || bridge.osmd.Zoom || 1);
    const groups = new Map();
    for (const step of steps) {
      if (!groups.has(step.y)) groups.set(step.y, []);
      if (!groups.get(step.y).some((other) => other.measure === step.measure)) groups.get(step.y).push(step);
    }
    layer = document.createElement("div");
    layer.className = "sheet-study-layer";
    layer.setAttribute("role", "group");
    layer.setAttribute("aria-label", "Measure study labels");
    const parent = bridge.osmd.cursor.cursorElement.parentElement;
    const parentTop = parent.getBoundingClientRect().top;
    for (const steps of groups.values()) {
      let bottom = Math.max(...steps.map((step) => step.y + step.h));
      // The cursor stops at the staff, not at low ledger notes or long stems.
      for (const step of steps)
        for (const staff of bridge.osmd.GraphicSheet.MeasureList[step.measure] || []) {
          for (const entry of staff?.staffEntries || [])
            for (const voice of entry.graphicalVoiceEntries || []) {
              for (const note of voice.notes || []) {
                const vf = Array.isArray(note.vfnote) ? note.vfnote[0] : note.vfnote;
                const group = vf?.getSVGElement?.() || vf?.attrs?.el;
                const rect = group?.getBoundingClientRect();
                if (rect?.height) bottom = Math.max(bottom, rect.bottom - parentTop);
              }
            }
        }
      for (const step of steps) {
        const measure = measures[step.measure];
        const graphic = bridge.osmd.GraphicSheet.MeasureList[step.measure]?.find(Boolean);
        if (!measure || !graphic) continue;
        const box = graphic.PositionAndShape;
        const label = document.createElement("button");
        label.type = "button";
        label.className = "sheet-study-label";
        label.dataset.studyMeasure = String(measure.number);
        label.style.left = box.AbsolutePosition.x * unit + 4 + "px";
        label.style.top = bottom + 12 + "px";
        label.style.width = Math.max(44, box.Size.width * unit - 8) + "px";
        if (chords.checked) {
          const line = document.createElement("span");
          line.textContent = measure.segments
            .map(
              (segment) =>
                (measure.segments.length > 1 ? beatLabel(segment.beat - measure.start) + ": " : "") +
                text(segment.name) +
                (segment.inferred ? "?" : "")
            )
            .join(" · ");
          label.append(line);
        }
        if (octaves.checked) {
          const line = document.createElement("span");
          line.className = "sheet-study-octaves";
          const bass = measure.octaves.filter((pair) => pair.staff > 1);
          line.textContent = bass.length ? text(bass.map((pair) => pair.low + "+" + pair.high).join(" · ")) + " (octave)" : "Bass: no octave pair";
          label.append(line);
        }
        label.setAttribute("aria-label", "Measure " + measure.number + ": " + label.textContent + ". Inspect notes and octave pairs");
        label.addEventListener("click", () => open(measure, label));
        layer.append(label);
      }
    }
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    parent.append(layer);
    // Keep the final study lane inside the scrollable score, even when it extends past the SVG.
    const lastBottom = Math.max(0, ...[...layer.children].map((el) => el.offsetTop + el.offsetHeight));
    const svgHeight = container.querySelector("svg")?.getBoundingClientRect().height || 0;
    container.style.paddingBottom = Math.max(0, lastBottom - svgHeight + 16) + "px";
  }

  function update() {
    if (!bridge.ready) return;
    const rules = bridge.osmd.EngravingRules;
    spacing ||= { system: rules.MinimumDistanceBetweenSystems, sky: rules.MinSkyBottomDistBetweenSystems };
    rules.MinimumDistanceBetweenSystems = spacing.system + (enabled() ? 10 : 0);
    rules.MinSkyBottomDistBetweenSystems = spacing.sky + (enabled() ? 10 : 0);
    container.classList.toggle("sheet-study-enabled", enabled());
    container.style.paddingBottom = "";
    if (dialog.open) dialog.close();
    bridge.rerender();
  }
  chords.addEventListener("change", update);
  octaves.addEventListener("change", update);
  container.addEventListener("sheet-render", () => {
    if (bridge.ready) render();
  });
  function ready() {
    spacing = null;
    controls.hidden = false;
    update();
  }
  if (page.dataset.localFile === "true") {
    page.addEventListener("sheet-score-ready", ready);
    container.addEventListener("sheet-clear", () => {
      controls.hidden = true;
      layer?.remove();
      measures = [];
      spacing = null;
      container.classList.remove("sheet-study-enabled");
      container.style.paddingBottom = "";
      if (dialog.open) dialog.close();
    });
  } else bridge.readyPromise.then(ready);
})();
