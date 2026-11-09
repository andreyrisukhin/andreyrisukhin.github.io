// Evaluate on /music/sheet/open/ at both required widths. Synthetic data only.
(async () => {
  const Model = SheetCorrectionModel,
    bridge = __sheetMusic;
  const $ = (name) => document.querySelector("[data-correction-" + name + "]");
  const dialog = document.getElementById("sheet-correction-dialog"),
    close = document.getElementById("sheet-file-clear");
  const checks = [];
  const assert = (value, label) => {
    if (!value) throw Error(label);
    checks.push(label);
  };
  const until = async (predicate) => {
    for (let i = 0; i < 240; i++) {
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw Error("Timed out: " + $("status").textContent + " " + $("error").textContent);
  };
  const note = (id, step, alter, octave, chord = false, voice = 1, staff = 1, duration = 4) =>
    `<note id="${id}">${chord ? "<chord/>" : ""}<pitch><step>${step}</step>${
      alter ? `<alter>${alter}</alter>` : ""
    }<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${
      duration === 16 ? "whole" : "quarter"
    }</type><accidental>${alter ? "sharp" : "natural"}</accidental><staff>${staff}</staff></note>`;
  const rest = `<note><rest/><duration>12</duration><voice>1</voice><type>half</type><dot/><staff>1</staff></note>`;
  const xml = `<score-partwise version="4.0"><work><work-title>Keyboard fixture</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>4</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>${note(
    "b",
    "B",
    0,
    3
  )}${note("d", "D", 1, 4, true)}${note("f", "F", 1, 4, true)}${rest}<backup><duration>16</duration></backup>${note(
    "bass",
    "E",
    0,
    2,
    false,
    2,
    2,
    16
  )}</measure><measure number="2"><attributes><key><fifths>-2</fifths></key></attributes>${note(
    "next",
    "A",
    0,
    4
  )}${rest}<backup><duration>16</duration></backup>${note("bass2", "E", 0, 2, false, 2, 2, 16)}</measure></part></score-partwise>`;
  const entry = (id) => Model.index(bridge.xml).find((e) => e.node.getAttribute("id") === id);
  const select = (id) => {
    const wanted = Model.address(entry(id)),
      mapping = Model.mapNotes(bridge.osmd, bridge.xml);
    for (const group of document.querySelectorAll("#osmd-container .vf-stavenote")) {
      const heads = [...group.querySelectorAll(".vf-notehead")];
      for (const head of heads.length ? heads : [group]) {
        const r = head.getBoundingClientRect(),
          x = r.left + r.width / 2,
          y = r.top + r.height / 2;
        const hit = bridge.resolveNoteAt(x + scrollX, y + scrollY, 80, head),
          at = mapping.get(hit?.graphicalNote?.sourceNote);
        if (at && JSON.stringify(at) === JSON.stringify(wanted)) {
          head.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
          return group;
        }
      }
    }
    throw Error("Cannot select " + id);
  };
  const press = (key, modifiers = {}) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }));
  const change = (name, value) => {
    $(name).value = value;
    $(name).dispatchEvent(new Event("input", { bubbles: true }));
    $(name).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const commit = async () => {
    const old = bridge.xml;
    $("form").requestSubmit();
    await until(() => bridge.xml !== old && !$("toggle").disabled);
  };
  const before = {
    confirm: window.confirm,
    picker: window.showSaveFilePicker,
    anchor: HTMLAnchorElement.prototype.click,
    fetch: window.fetch,
    hear: WorkbenchPlayer.play,
  };
  const storage = JSON.stringify({ ...localStorage }),
    requests = [];
  window.confirm = () => true;
  window.fetch = (...args) => {
    requests.push(args[0]);
    return before.fetch(...args);
  };
  try {
    close.click();
    const transfer = new DataTransfer();
    transfer.items.add(new File([xml], "keyboard-edited.musicxml"));
    const input = document.getElementById("sheet-file");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => bridge.ready && window.SheetReader && !$("toggle").disabled);
    assert(
      getComputedStyle(input).display === "none" && !document.querySelector("[data-sheet-replace]").hidden,
      "Loaded state replaces the misleading native file picker"
    );
    assert($("file").textContent === "keyboard-edited.musicxml", "Loaded filename has one authoritative display");
    assert(document.querySelector(".vf-notehead").getBoundingClientRect().top < innerHeight - 80, "The initial screen reaches the notation");
    $("toggle").click();
    assert(document.querySelector(".practice-score-help").textContent.includes("changes pitch"), "Help reflects edit mode");
    assert(getComputedStyle(document.querySelector(".sheet-transport")).display === "none", "Playback does not cover music in edit mode");
    scrollBy(0, 1600);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const navBottom = document.querySelector("nav.navbar")?.getBoundingClientRect().bottom || 0;
    assert($("toggle").getBoundingClientRect().top >= navBottom, "Sticky edit actions remain fully below the site navigation");
    document.querySelector(".sheet-reader").scrollIntoView({ block: "start" });
    select("b");
    assert(
      !dialog.open && document.querySelectorAll(".vf-notehead.is-correction-note").length === 1,
      "Click selects precisely one chord tone without opening a modal"
    );
    press("ArrowDown");
    await until(() => Model.label(entry("b").pitch) === "A3" && !$("toggle").disabled);
    assert(!entry("b").node.querySelector("accidental"), "B3 to A3 does not force a redundant natural");
    assert(
      document.activeElement.classList.contains("vf-stavenote") && document.querySelectorAll(".vf-notehead.is-correction-note").length === 1,
      "An arrow edit preserves exact selection and keyboard focus"
    );
    select("d");
    press("ArrowDown");
    await until(() => Model.label(entry("d").pitch) === "C♯4" && !$("toggle").disabled);
    assert(
      entry("d").pitch.alter === 1 && !entry("d").node.querySelector("accidental"),
      "D-sharp to C-sharp preserves pitch while deduplicating its printed symbol"
    );
    press("ArrowUp", { shiftKey: true });
    await until(() => Model.label(entry("d").pitch) === "C♯5" && !$("toggle").disabled);
    assert(Model.midi(entry("d").pitch) === 73, "Shift-arrow moves exactly an octave");
    press("ArrowDown", { altKey: true });
    await until(() => Model.label(entry("d").pitch) === "C5" && !$("toggle").disabled);
    assert(Model.midi(entry("d").pitch) === 72, "Alt-arrow moves exactly a semitone");
    const markedHead = document.querySelector(".vf-notehead.is-correction-note"),
      box = markedHead.getBoundingClientRect();
    const graphic = bridge.resolveNoteAt(box.left + box.width / 2 + scrollX, box.top + box.height / 2 + scrollY, 80, markedHead).graphicalNote;
    const vf = Array.isArray(graphic.vfnote) ? graphic.vfnote[0] : graphic.vfnote;
    assert(
      vf.getModifiers().some((modifier) => modifier.type === "n"),
      "Automatic display still draws a necessary natural against the key"
    );
    press("Enter");
    change("display", "show");
    await commit();
    assert(
      entry("d").node.querySelector("accidental")?.getAttribute("cautionary") === "yes",
      "Courtesy display can be requested without changing pitch"
    );
    press("Enter");
    change("display", "auto");
    await commit();
    assert(
      !entry("d").node.querySelector("accidental") && Model.label(entry("d").pitch) === "C5",
      "Automatic display restores the same sounding pitch"
    );
    press("ArrowUp");
    press("ArrowUp");
    press("ArrowUp");
    await until(() => Model.label(entry("d").pitch) === "F♯5" && !$("toggle").disabled);
    assert(Model.label(entry("d").pitch) === "F♯5", "Rapid arrow presses are queued rather than dropped");
    select("next");
    press("ArrowUp");
    await until(() => Model.label(entry("next").pitch) === "B♭4" && !$("toggle").disabled);
    assert(entry("next").pitch.alter === -1, "Stepping follows a later key change");
    const group = document.activeElement;
    press("ArrowRight");
    assert(document.activeElement !== group, "Left/right navigates note groups instead of changing pitch");
    select("d");
    press("Enter");
    assert(dialog.open && document.activeElement === $("step"), "Enter opens advanced controls at the pitch field, not Cancel");
    assert($("apply").disabled, "Unchanged forms cannot create a no-op revision");
    const unchanged = bridge.xml;
    press("ArrowDown");
    assert(bridge.xml === unchanged, "Native arrows inside form inputs do not edit the score");
    change("step", "E");
    change("alter", "0");
    change("octave", "4");
    change("member", String(entry("b").noteIndex));
    change("octave", "4");
    change("member", String(entry("d").noteIndex));
    assert($("step").value === "E" && $("octave").value === "4", "Switching chord members preserves draft fields");
    assert(entry("d").pitch.octave === 5, "Drafts do not mutate the source before Apply");
    await commit();
    assert(dialog.open && $("octave").value === "4" && $("step").value === "A", "Applying one tone keeps the other pending draft");
    await commit();
    assert(
      !dialog.open && Model.label(entry("b").pitch) === "A4" && Model.label(entry("d").pitch) === "E4",
      "Both chord-tone drafts are applied without loss"
    );
    assert(
      document.querySelectorAll(".vf-notehead.is-correction-note").length === 1 && document.activeElement.classList.contains("vf-stavenote"),
      "Advanced Apply also preserves a single selected tone"
    );
    press("Enter");
    change("step", "B");
    change("octave", "9");
    assert($("apply").disabled && $("error").textContent.includes("playable"), "Inaudible out-of-range pitches are rejected in the form");
    window.confirm = () => false;
    $("close").click();
    assert(dialog.open, "Cancel/Escape cannot silently discard a pending draft");
    window.confirm = () => true;
    $("close").click();
    assert(Model.label(entry("b").pitch) === "A4", "Discarding a form draft leaves applied score changes intact");
    let heard = [];
    WorkbenchPlayer.play = async (chords) => {
      heard = chords[0];
      return true;
    };
    $("hear").click();
    await until(() => heard.length);
    assert(heard[0] === 69, "Explicit audition uses the selected written pitch");
    WorkbenchPlayer.play = before.hear;
    const oldDoc = bridge.xml;
    $("toggle").click();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await until(() => bridge.xml !== oldDoc && !$("toggle").disabled);
    assert(Model.label(entry("b").pitch) === "A3", "Document undo works in Inspect mode too");
    let filename;
    HTMLAnchorElement.prototype.click = function () {
      filename = this.download;
    };
    $("download").click();
    assert(filename === "keyboard-edited.musicxml", "Re-export does not accumulate edited filename suffixes");
    assert(SheetCorrections.hasUnsavedChanges(), "Blocked or cancelled downloads remain unsaved");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    assert(unload.defaultPrevented, "The only-copy warning survives a download attempt");
    $("confirm-save").click();
    assert(!SheetCorrections.hasUnsavedChanges(), "Only explicit user confirmation acknowledges a fallback download");
    $("toggle").click();
    select("d");
    press("ArrowDown");
    await until(() => Model.label(entry("d").pitch) === "D♯4" && !$("toggle").disabled);
    let release,
      closed = false,
      written;
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (blob) => {
          written = await blob.text();
        },
        close: () => {
          closed = true;
          return new Promise((resolve) => {
            release = resolve;
          });
        },
        abort: async () => {},
      }),
    });
    $("save").click();
    await until(() => closed);
    assert(SheetCorrections.hasUnsavedChanges(), "Direct saving remains unsaved until the writer closes successfully");
    release();
    await until(() => !$("toggle").disabled);
    assert(
      !SheetCorrections.hasUnsavedChanges() && written.includes("<score-partwise"),
      "Successful confirmed file write marks only its revision saved"
    );
    press("ArrowDown");
    await until(() => Model.label(entry("d").pitch) === "C♯4" && !$("toggle").disabled);
    window.showSaveFilePicker = async () => {
      throw new DOMException("Cancelled", "AbortError");
    };
    $("save").click();
    await until(() => !$("toggle").disabled);
    assert(SheetCorrections.hasUnsavedChanges() && $("status").textContent.includes("cancelled"), "Cancelling a save preserves unsaved state");
    let aborted = false;
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => {
          throw Error("Disk full");
        },
        close: async () => {},
        abort: async () => {
          aborted = true;
        },
      }),
    });
    $("save").click();
    await until(() => !$("toggle").disabled);
    assert(aborted && SheetCorrections.hasUnsavedChanges(), "Failed writes abort and retain the only-copy warning");
    assert(
      requests.length === 0 && JSON.stringify({ ...localStorage }) === storage,
      "Editing, audition controls, and export neither upload nor persist score data"
    );
    assert(document.documentElement.scrollWidth <= innerWidth, "The complete editing flow has no horizontal page overflow");
    return { width: innerWidth, checks: checks.length, result: "passed" };
  } finally {
    WorkbenchPlayer.play = before.hear;
    window.confirm = () => true;
    close.click();
    window.confirm = before.confirm;
    window.fetch = before.fetch;
    HTMLAnchorElement.prototype.click = before.anchor;
    if (before.picker) window.showSaveFilePicker = before.picker;
    else delete window.showSaveFilePicker;
  }
})();
