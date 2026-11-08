// Run on /music/sheet/open/ at desktop and mobile widths. Synthetic XML only.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (name) => document.querySelector("[data-correction-" + name + "]");
  const bridge = window.__sheetMusic,
    Model = SheetCorrectionModel;
  const dialog = document.getElementById("sheet-correction-dialog");
  const close = document.getElementById("sheet-file-clear");
  const input = document.getElementById("sheet-file");
  const until = async (fn) => {
    for (let i = 0; i < 200; i++) {
      if (fn()) return;
      await sleep(25);
    }
    throw new Error("Correction timed out: " + $("status").textContent + " " + $("error").textContent);
  };
  const attrs = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>
    <staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
  const note = (id, step, octave, duration, type, voice = 1, staff = 1, extra = "", chord = false, notation = "") => `<note id="${id}">${
    chord ? "<chord/>" : ""
  }
    ${step ? `<pitch><step>${step}</step><octave>${octave}</octave></pitch>` : "<rest/>"}<duration>${duration}</duration>${extra}
    <voice>${voice}</voice><type>${type}</type><staff>${staff}</staff>${notation}</note>`;
  const fixture = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Correction fixture</work-title></work>
    <identification><creator type="composer">Synthetic credit</creator></identification>
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
    <measure number="1">${attrs}
    <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>
    ${note("top", "C", 4, 4, "quarter")}${note("chord", "E", 4, 4, "quarter", 1, 1, "", true)}
    ${note("later", "D", 4, 4, "quarter")}${note("rest", null, 0, 8, "half")}
    <backup><duration>16</duration></backup>${note("bass", "C", 3, 16, "whole", 2, 2)}</measure>
    <measure number="2">${note("end", "G", 4, 16, "whole")}<backup><duration>16</duration></backup>
    ${note("bass-end", "C", 3, 16, "whole", 2, 2)}<barline><bar-style>light-heavy</bar-style></barline></measure></part></score-partwise>`;
  const choose = async (xml = fixture, name = "correction-fixture.musicxml") => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([xml], name));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => bridge.ready && window.SheetReader && !$("toggle").disabled);
  };
  const xmlEntry = (id) => Model.index(bridge.xml).find((e) => e.node.getAttribute("id") === id);
  const open = (id) => {
    if ($("toggle").getAttribute("aria-pressed") !== "true") $("toggle").click();
    const wanted = xmlEntry(id),
      map = Model.mapNotes(bridge.osmd, bridge.xml);
    const target = [...document.querySelectorAll("#osmd-container .vf-stavenote")].find((element) => {
      const rect = element.getBoundingClientRect();
      const hit = bridge.resolveNoteAt(rect.left + rect.width / 2 + scrollX, rect.top + rect.height / 2 + scrollY, 80, element);
      const at = map.get(hit?.graphicalNote?.sourceNote);
      return (
        at &&
        at.partIndex === wanted.partIndex &&
        at.measureIndex === wanted.measureIndex &&
        Model.describe(bridge.xml, at).members.some((member) => member.noteIndex === wanted.noteIndex)
      );
    });
    if (!target) throw new Error("No mapped notation for fixture note " + id);
    target.focus();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(
      dialog.open && !document.getElementById("sheet-inspector").open,
      "Edit mode opens correction, not inspection: " +
        id +
        " (" +
        $("status").textContent +
        "; mode=" +
        document.querySelector(".sheet-reader").dataset.correctionMode +
        ")"
    );
    $("member").value = String(wanted.noteIndex);
    $("member").dispatchEvent(new Event("change"));
  };
  const change = (name, value) => {
    $(name).value = value;
    $(name).dispatchEvent(new Event("change", { bubbles: true }));
  };
  const submit = async () => {
    const before = bridge.xml;
    $("form").requestSubmit();
    await until(() => bridge.xml !== before && !$("toggle").disabled);
  };
  const travel = async (name) => {
    const before = bridge.xml;
    $(name).click();
    await until(() => bridge.xml !== before && !$("toggle").disabled);
  };
  const confirmBefore = window.confirm,
    fetchBefore = window.fetch,
    sendBefore = XMLHttpRequest.prototype.send,
    beaconBefore = navigator.sendBeacon;
  const storage = JSON.stringify({ ...localStorage }),
    requests = [];
  window.confirm = () => true;
  window.fetch = (...args) => {
    requests.push("fetch");
    return fetchBefore(...args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    requests.push("xhr");
    return sendBefore.apply(this, args);
  };
  navigator.sendBeacon = () => {
    requests.push("beacon");
    return false;
  };
  try {
    close.click();
    assert(document.querySelector(".sheet-correction-tools").hidden && $("toggle").disabled, "Empty reader hides and disables editing");
    await choose();
    assert(!$("toggle").disabled && $("undo").disabled && $("redo").disabled, "New file has empty undo and redo history");
    const original = bridge.xml,
      oldPlayer = SheetReader.player;
    open("chord");
    assert(
      document.querySelector(".vf-stavenote[aria-label]").getAttribute("aria-label").startsWith("Correct"),
      "Edit mode labels keyboard-accessible notation as correction controls"
    );
    const bounds = dialog.getBoundingClientRect();
    assert(
      bounds.left >= 0 && bounds.right <= innerWidth && dialog.scrollWidth <= dialog.clientWidth + 1,
      "Correction fields fit the viewport without horizontal scrolling"
    );
    assert($("member").options.length === 2, "Chord editor selects individual tones");
    change("step", "F");
    change("alter", "1");
    change("octave", "5");
    await submit();
    assert(
      Model.label(xmlEntry("chord").pitch) === "F♯5" && Model.label(xmlEntry("top").pitch) === "C4",
      "Correction changes only the chosen chord tone"
    );
    assert(Model.label(xmlEntry("bass").pitch) === "C3", "Other staff is unchanged");
    assert(document.querySelectorAll("#osmd-container svg").length === 1, "Correction replaces the old notation instead of accumulating SVG pages");
    assert(original.querySelector('note[id="chord"] pitch step').textContent === "E", "Original document is not mutated");
    assert(
      SheetReader.player !== oldPlayer && oldPlayer.snapshot().state === "paused" && SheetReader.player.snapshot().state === "paused",
      "Correction rebuilds playback without autoplay"
    );
    assert(
      SheetReader.score.events.some((event) => event.midi === 78) && !SheetReader.score.events.some((event) => event.midi === 64),
      "Playback schedule uses the corrected pitch"
    );
    assert(
      document.querySelectorAll("[data-sheet-playback]").length === 1 && document.querySelectorAll(".sheet-playhead").length === 1,
      "Correction leaves one transport and one playhead"
    );
    assert(SheetCorrections.hasUnsavedChanges() && !$("undo").disabled, "Changed score is marked unsaved");

    let blob, filename;
    const createBefore = URL.createObjectURL,
      anchorBefore = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (value) => {
      blob = value;
      return createBefore(value);
    };
    HTMLAnchorElement.prototype.click = function () {
      filename = this.download;
    };
    try {
      $("download").click();
    } finally {
      URL.createObjectURL = createBefore;
      HTMLAnchorElement.prototype.click = anchorBefore;
    }
    const exported = await blob.text(),
      parsed = new DOMParser().parseFromString(exported, "application/xml");
    assert(
      !parsed.querySelector("parsererror") && filename === "correction-fixture-edited.musicxml",
      "Download produces valid, separately named MusicXML"
    );
    assert(parsed.querySelector('note[id="chord"] pitch alter').textContent === "1", "Downloaded XML contains the correction");
    assert(
      parsed.querySelector("creator").textContent === "Synthetic credit" && parsed.querySelector("bar-style").textContent === "light-heavy",
      "Download preserves unrelated credits and notation"
    );
    assert(!SheetCorrections.hasUnsavedChanges(), "Download marks the current revision exported");
    await travel("undo");
    assert(
      Model.label(xmlEntry("chord").pitch) === "E4" && SheetReader.score.events.some((event) => event.midi === 64),
      "Undo restores source, rendering, and playback"
    );
    await travel("redo");
    assert(Model.label(xmlEntry("chord").pitch) === "F♯5" && !SheetCorrections.hasUnsavedChanges(), "Redo restores the exported revision");
    await travel("undo");
    open("chord");
    change("step", "G");
    await submit();
    assert($("redo").disabled && Model.label(xmlEntry("chord").pitch) === "G4", "Editing after undo discards the redo branch");
    SheetReader.player.setRate(0.75);
    open("top");
    change("type", "eighth");
    await submit();
    assert(xmlEntry("top").duration === 0.5 && xmlEntry("chord").duration === 0.5, "Rhythm correction applies to the complete chord");
    assert(xmlEntry("later").onset === 0.5 && xmlEntry("bass").onset === 0, "Later notes shift in one voice without shifting the bass");
    assert(
      SheetReader.score.events.find((event) => event.midi === 62).start === 0.25 && SheetReader.score.duration === 4,
      "Corrected rhythm reaches playback without changing measure length"
    );
    assert(SheetReader.player.snapshot().rate === 0.75, "Corrections preserve the chosen practice speed");
    open("top");
    change("type", "whole");
    const intact = bridge.xml;
    $("form").requestSubmit();
    assert(
      bridge.xml === intact && dialog.open && $("error").textContent.includes("trailing rest"),
      "Overfilling a voice is rejected without partial edits"
    );
    $("close").click();
    window.confirm = () => false;
    close.click();
    assert(bridge.xml === intact && SheetCorrections.hasUnsavedChanges(), "Closing warns before discarding unexported changes");
    const blocked = new DataTransfer();
    blocked.items.add(new File([fixture], "not-opened.musicxml"));
    input.files = blocked.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    assert(bridge.xml === intact && input.files.length === 0, "Replacing a file warns before discarding corrections");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    assert(unload.defaultPrevented, "Reloading warns about unexported corrections");
    window.confirm = () => true;
    open("top");
    change("step", "A");
    const renderBefore = opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.render;
    let fail = true;
    opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.render = function (...args) {
      if (fail) {
        fail = false;
        throw new Error("Synthetic render failure");
      }
      return renderBefore.apply(this, args);
    };
    try {
      $("form").requestSubmit();
      await until(() => !$("toggle").disabled && $("status").textContent.includes("not applied"));
    } finally {
      opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.render = renderBefore;
    }
    assert(
      bridge.xml === intact && Model.label(xmlEntry("top").pitch) === "C4" && window.SheetReader,
      "A failed render restores the previous score and player"
    );
    assert(document.querySelectorAll("#osmd-container svg").length === 1, "Rollback restores only the original notation surface");
    open("chord");
    $("close").click();
    await choose(exported, filename);
    assert(
      Model.label(xmlEntry("chord").pitch) === "F♯5" && SheetReader.score.events.some((event) => event.midi === 78),
      "Downloaded MusicXML reopens with corrected notation and playback"
    );

    const tied = fixture
      .replace(
        /<measure number="1">[\s\S]*?<\/measure>/,
        `<measure number="1">${attrs}${note(
          "tie-start",
          "C",
          4,
          16,
          "whole",
          1,
          1,
          '<tie type="start"/>',
          false,
          '<notations><tied type="start"/></notations>'
        )}</measure>`
      )
      .replace(
        /<measure number="2">[\s\S]*?<\/measure>/,
        `<measure number="2">${note(
          "tie-stop",
          "C",
          4,
          16,
          "whole",
          1,
          1,
          '<tie type="stop"/>',
          false,
          '<notations><tied type="stop"/></notations>'
        )}</measure>`
      );
    await choose(tied);
    assert(SheetReader.score.events.length === 1, "Original fixture tie plays as one sustained event");
    assert(
      $("undo").disabled && $("redo").disabled && $("toggle").getAttribute("aria-pressed") === "false",
      "Replacement file clears history and edit mode"
    );
    open("tie-stop");
    assert(
      $("rhythm").disabled && $("pitch-help").textContent.includes("whole linked tie"),
      "Tie editor protects rhythm and explains linked pitch edits"
    );
    change("step", "D");
    change("alter", "1");
    await submit();
    assert(
      Model.label(xmlEntry("tie-start").pitch) === "D♯4" && Model.label(xmlEntry("tie-stop").pitch) === "D♯4",
      "Correcting either tie endpoint updates both notes"
    );
    assert(SheetReader.score.events.length === 1 && SheetReader.score.events[0].midi === 63, "Corrected tie still plays as one sustained event");
    close.click();
    assert(!bridge.xml && !SheetCorrections.hasUnsavedChanges() && $("undo").disabled && $("redo").disabled, "Close releases source and history");
    assert(
      !$("member").children.length && $("octave").value === "" && !$("pitch-help").textContent,
      "Close clears correction form pitches and context"
    );

    await choose();
    open("top");
    change("step", "B");
    const loadBefore = opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.load;
    let release;
    opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.load = function (...args) {
      return new Promise((resolve, reject) => {
        release = async () => {
          try {
            resolve(await loadBefore.apply(this, args));
          } catch (error) {
            reject(error);
          }
        };
      });
    };
    try {
      $("form").requestSubmit();
      assert($("toggle").disabled, "In-flight correction disables duplicate edits");
      close.click();
      await release();
      await sleep(50);
    } finally {
      opensheetmusicdisplay.OpenSheetMusicDisplay.prototype.load = loadBefore;
    }
    assert(
      !bridge.ready && !bridge.xml && !window.SheetReader && document.querySelector(".sheet-correction-tools").hidden,
      "Closing during reload prevents stale correction resurrection"
    );
    assert(requests.length === 0, "Corrections, history, rendering, and export make no fetch, XHR, or beacon requests");
    assert(JSON.stringify({ ...localStorage }) === storage, "Corrections and filenames are never written to localStorage");
    assert(document.documentElement.scrollWidth <= innerWidth, "Correction controls fit the viewport");
    return { width: innerWidth, checks: checks.length, result: "passed" };
  } finally {
    window.confirm = () => true;
    close.click();
    window.confirm = confirmBefore;
    window.fetch = fetchBefore;
    XMLHttpRequest.prototype.send = sendBefore;
    navigator.sendBeacon = beaconBefore;
  }
})();
