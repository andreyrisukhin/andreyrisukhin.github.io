(function () {
  "use strict";

  const M = window.Music;
  const EXERCISES = window.SheetBuilderExercises || [];
  const EXERCISE_ID = "fearless-first-lead-sheet";
  const STORAGE_KEY = "sheet-builder:fearless-first";
  const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const PITCH_BY_PC = [
    { step: "C", alter: 0 },
    { step: "D", alter: -1 },
    { step: "D", alter: 0 },
    { step: "E", alter: -1 },
    { step: "E", alter: 0 },
    { step: "F", alter: 0 },
    { step: "F", alter: 1 },
    { step: "G", alter: 0 },
    { step: "A", alter: -1 },
    { step: "A", alter: 0 },
    { step: "B", alter: -1 },
    { step: "B", alter: 0 },
  ];

  const root = document.getElementById("sheet-builder-root");
  const ex = EXERCISES.find((item) => item.id === EXERCISE_ID);
  if (!root || !ex) return;

  const state = loadState();
  let osmd = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        cursor: typeof parsed.cursor === "number" ? parsed.cursor : 0,
        bassline: Array.isArray(parsed.bassline) ? parsed.bassline : defaultBassline(),
      };
    } catch (_e) {
      return { cursor: 0, bassline: defaultBassline() };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function beatsPerBar() {
    return (ex.playback && ex.playback.beats_per_bar) || 4;
  }

  function subdivsPerBeat() {
    return (ex.playback && ex.playback.subdivisions_per_beat) || 2;
  }

  function slotsPerBar() {
    return beatsPerBar() * subdivsPerBeat();
  }

  function stepBeats(step) {
    return (step && step.beats) || beatsPerBar();
  }

  function stepSlots(step) {
    return stepBeats(step) * subdivsPerBeat();
  }

  function totalSlots() {
    return ex.progression.reduce((sum, step) => sum + stepSlots(step), 0);
  }

  function stepAtSlot(slot) {
    let acc = 0;
    for (let i = 0; i < ex.progression.length; i++) {
      const len = stepSlots(ex.progression[i]);
      if (slot < acc + len) return { step: ex.progression[i], index: i, slotInStep: slot - acc, startSlot: acc };
      acc += len;
    }
    return { step: ex.progression[ex.progression.length - 1], index: ex.progression.length - 1, slotInStep: 0, startSlot: acc };
  }

  function chordName(step) {
    return step.label || "";
  }

  function defaultBassline() {
    const events = [];
    const sub = subdivsPerBeat();
    let acc = 0;
    ex.progression.forEach((step) => {
      const note = typeof step.bass_offset === "number" ? step.bass_offset : step.offset;
      for (let s = 0; s < stepSlots(step); s += sub) {
        events.push({ slot: acc + s, midi: 48 + note });
      }
      acc += stepSlots(step);
    });
    return events;
  }

  function noteName(pc) {
    return NOTE_NAMES[((pc % 12) + 12) % 12];
  }

  function midiName(midi) {
    return noteName(midi % 12) + (Math.floor(midi / 12) - 1);
  }

  function bassAt(slot) {
    return state.bassline.find((ev) => ev.slot === slot) || null;
  }

  function setBass(slot, midi) {
    state.bassline = state.bassline.filter((ev) => ev.slot !== slot);
    if (typeof midi === "number") state.bassline.push({ slot, midi });
    state.bassline.sort((a, b) => a.slot - b.slot);
    state.cursor = Math.min(totalSlots() - 1, slot + 1);
    saveState();
    render();
  }

  function setCursor(slot) {
    state.cursor = Math.max(0, Math.min(totalSlots() - 1, slot));
    saveState();
    render();
  }

  function pitchXml(midi) {
    const pc = ((midi % 12) + 12) % 12;
    const pitch = PITCH_BY_PC[pc];
    let xml = `<pitch><step>${pitch.step}</step>`;
    if (pitch.alter) xml += `<alter>${pitch.alter}</alter>`;
    xml += `<octave>${Math.floor(midi / 12) - 1}</octave></pitch>`;
    return xml;
  }

  function noteType(duration) {
    if (duration >= 4) return "half";
    if (duration >= 2) return "quarter";
    return "eighth";
  }

  function noteXml(midi, duration, staff, voice) {
    const dot = duration === 3 || duration === 6 ? "<dot/>" : "";
    return `<note>${pitchXml(midi)}<duration>${duration}</duration><voice>${voice}</voice><type>${noteType(
      duration
    )}</type>${dot}<staff>${staff}</staff></note>`;
  }

  function restXml(duration, staff, voice) {
    return `<note><rest/><duration>${duration}</duration><voice>${voice}</voice><type>${noteType(duration)}</type><staff>${staff}</staff></note>`;
  }

  function renderVoice(events, start, end, staff, voice) {
    let cursor = start;
    let xml = "";
    events
      .filter((ev) => ev.slot >= start && ev.slot < end)
      .sort((a, b) => a.slot - b.slot)
      .forEach((ev) => {
        if (ev.slot > cursor) xml += restXml(ev.slot - cursor, staff, voice);
        const duration = Math.min(ev.duration || subdivsPerBeat(), end - ev.slot);
        xml += noteXml(ev.midi, duration, staff, voice);
        cursor = ev.slot + duration;
      });
    if (cursor < end) xml += restXml(end - cursor, staff, voice);
    return xml;
  }

  function buildMusicXml() {
    const slotsBar = slotsPerBar();
    const measures = Math.ceil(totalSlots() / slotsBar);
    const treble = ex.right_hand.events.map((ev) => ({
      slot: Math.round((ev.beat - 1) * subdivsPerBeat()),
      duration: Math.max(1, Math.round((ev.duration || 0.5) * subdivsPerBeat())),
      midi: 60 + ev.note + (ev.octave || 0) * 12,
    }));
    const bass = state.bassline.map((ev, i, arr) => ({
      slot: ev.slot,
      duration: Math.min(subdivsPerBeat(), (arr[i + 1] && arr[i + 1].slot - ev.slot) || subdivsPerBeat()),
      midi: ev.midi,
    }));

    let xml =
      '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">';
    for (let m = 0; m < measures; m++) {
      const start = m * slotsBar;
      const end = start + slotsBar;
      xml += `<measure number="${m + 1}">`;
      if (m === 0) {
        xml +=
          '<attributes><divisions>2</divisions><key><fifths>-3</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>';
      }
      for (let slot = start; slot < end; slot++) {
        const pos = stepAtSlot(slot);
        if (pos.slotInStep === 0) {
          xml += `<direction placement="above"><direction-type><words>${chordName(pos.step)}</words></direction-type></direction>`;
        }
      }
      xml += renderVoice(treble, start, end, 1, 1);
      xml += `<backup><duration>${slotsBar}</duration></backup>`;
      xml += renderVoice(bass, start, end, 2, 2);
      xml += "</measure>";
    }
    xml += "</part></score-partwise>";
    return xml;
  }

  function renderScore() {
    const container = document.getElementById("sheet-builder-score");
    if (!container || !window.opensheetmusicdisplay) return;
    container.innerHTML = "";
    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      backend: "svg",
      drawTitle: false,
      drawComposer: false,
      drawPartNames: false,
      autoResize: false,
    });
    osmd.load(buildMusicXml()).then(() => {
      osmd.Zoom = 0.86;
      osmd.render();
    });
  }

  function render() {
    const current = bassAt(state.cursor);
    root.innerHTML = `
      <div class="sheet-music-page sheet-music-page--flexoki sheet-builder">
        <div class="sheet-music-controls">
          <button class="music-share-btn" data-action="prev">Prev slot</button>
          <button class="music-share-btn" data-action="next">Next slot</button>
          <button class="music-share-btn" data-action="rest">Rest here</button>
          <button class="music-share-btn" data-action="seed">Seed roots</button>
          <button class="music-share-btn" data-action="copy">Copy JSON</button>
        </div>
        <p class="sheet-builder-status">Slot <strong>${state.cursor + 1}</strong> of ${totalSlots()}, current bass: <strong>${
          current ? midiName(current.midi) : "rest"
        }</strong></p>
        <div class="sheet-builder-slots">${Array.from({ length: totalSlots() }, (_v, slot) => {
          const ev = bassAt(slot);
          return `<button class="sheet-builder-slot${slot === state.cursor ? " is-current" : ""}${
            ev ? " is-filled" : ""
          }" data-action="slot" data-slot="${slot}">${slot + 1}</button>`;
        }).join("")}</div>
        <div id="sheet-builder-score" class="sheet-music-container sheet-builder-score">Loading score…</div>
        <section class="sheet-builder-bayan" aria-label="B-system bayan input">
          <h3>B-system input</h3>
          <p>Click a bayan button to write that note into the selected bass slot.</p>
          <div class="bayan-sim-keyboard sheet-builder-bayan__keyboard">${renderBayan(current)}</div>
        </section>
        <textarea class="sheet-builder-export" readonly spellcheck="false">${JSON.stringify(
          { id: EXERCISE_ID, bassline: state.bassline },
          null,
          2
        )}</textarea>
      </div>`;
    renderScore();
  }

  function renderBayan(current) {
    let html = "";
    const low = 42;
    const high = 72;
    for (let col = 0; col < 3; col++) {
      html += `<div class="bayan-sim-col bayan-sim-col-${col}">`;
      for (let midi = low + col; midi <= high; midi += 3) {
        const cls = `bayan-sim-button${current && current.midi === midi ? " is-active is-root" : ""}`;
        html += `<button type="button" class="${cls}" data-action="midi" data-midi="${midi}"><span>${midiName(midi)}</span></button>`;
      }
      html += "</div>";
    }
    return html;
  }

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const kind = action.dataset.action;
    if (kind === "prev") setCursor(state.cursor - 1);
    if (kind === "next") setCursor(state.cursor + 1);
    if (kind === "rest") setBass(state.cursor, null);
    if (kind === "seed") {
      state.bassline = defaultBassline();
      saveState();
      render();
    }
    if (kind === "copy") navigator.clipboard && navigator.clipboard.writeText(JSON.stringify({ id: EXERCISE_ID, bassline: state.bassline }, null, 2));
    if (kind === "slot") setCursor(Number(action.dataset.slot));
    if (kind === "midi") setBass(state.cursor, Number(action.dataset.midi));
  });

  render();
})();
