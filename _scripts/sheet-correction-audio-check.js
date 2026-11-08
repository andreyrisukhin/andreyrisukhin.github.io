// Run on the local reader after a trusted Play click has unlocked Web Audio.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (name) => document.querySelector("[data-correction-" + name + "]");
  const bridge = window.__sheetMusic,
    close = document.getElementById("sheet-file-clear");
  const until = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await sleep(25);
    }
    throw new Error("Correction audio timed out: " + $("status").textContent);
  };
  const fixture = `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
    <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note></measure></part></score-partwise>`;
  const instrument = await Tactus.audio.soundfont("acoustic_grand_piano");
  const context = Tactus.audio.context(),
    analyser = context.createAnalyser();
  instrument.connect(analyser);
  const scheduled = [],
    playBefore = instrument.play,
    confirmBefore = window.confirm;
  instrument.play = function (...args) {
    scheduled.push(args);
    return playBefore.apply(this, args);
  };
  window.confirm = () => true;
  let peak = 0;
  const correct = async (step, alter) => {
    if ($("toggle").getAttribute("aria-pressed") !== "true") $("toggle").click();
    const note = document.querySelector("#osmd-container .vf-stavenote");
    note.focus();
    note.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(document.getElementById("sheet-correction-dialog").open, "Written note opens for correction");
    $("step").value = step;
    $("alter").value = String(alter);
    $("octave").value = "4";
    const previous = bridge.xml;
    $("form").requestSubmit();
    await until(() => bridge.xml !== previous && !$("toggle").disabled);
  };
  try {
    close.click();
    const transfer = new DataTransfer();
    transfer.items.add(new File([fixture], "synthetic-correction.musicxml"));
    const input = document.getElementById("sheet-file");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => window.SheetReader && !$("toggle").disabled);
    await correct("D", 1);
    await SheetReader.player.play();
    assert(context.state === "running" && scheduled.some(([midi]) => midi === 63), "Actual piano sounds the corrected D-sharp, not the original C");
    const samples = new Float32Array(analyser.fftSize);
    for (let i = 0; i < 8; i++) {
      await sleep(50);
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...samples.map(Math.abs));
    }
    assert(peak > 0.0001, "Corrected piano output is non-silent");
    const old = SheetReader.player,
      count = scheduled.length;
    await correct("E", 0);
    await sleep(100);
    assert(
      old.snapshot().state === "paused" && SheetReader.player.snapshot().state === "paused" && scheduled.length === count,
      "Editing during playback stops old notes without starting new audio"
    );
    await SheetReader.player.play();
    assert(
      scheduled.slice(count).some(([midi]) => midi === 64),
      "Next Play sounds the new E-natural correction"
    );
    const before = bridge.xml;
    $("undo").click();
    await until(() => bridge.xml !== before && !$("toggle").disabled);
    const undoStart = scheduled.length;
    await SheetReader.player.play();
    assert(
      scheduled.slice(undoStart).some(([midi]) => midi === 63),
      "Undo restores the real scheduled D-sharp pitch"
    );
    close.click();
    const stopped = scheduled.length;
    await sleep(300);
    assert(!window.SheetReader && scheduled.length === stopped, "Close stops corrected-score audio and its scheduler");
    return { width: innerWidth, checks: checks.length, result: "passed", signalPeak: peak };
  } finally {
    close.click();
    window.confirm = confirmBefore;
    instrument.play = playBefore;
    analyser.disconnect();
  }
})();
