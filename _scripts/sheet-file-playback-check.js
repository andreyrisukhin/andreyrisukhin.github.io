// Run on /music/sheet/open/ after a trusted Play click has unlocked Web Audio.
// Tests actual piano samples and output using synthetic two-staff MusicXML.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await sleep(50);
    }
    throw new Error("Timed out waiting for local playback: " + document.getElementById("osmd-status").textContent);
  };
  const input = document.getElementById("sheet-file");
  const close = document.getElementById("sheet-file-clear");
  const fixture = `<score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
    ${["C", "D", "E"]
      .map(
        (step, i) => `<measure number="${i + 1}">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time>
    <staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
    <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${
      i === 2 ? 60 : 120
    }</per-minute></metronome></direction-type><sound tempo="${i === 2 ? 60 : 120}"/></direction>
    <note><pitch><step>${step}</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice><type>half</type><dot/><staff>1</staff></note>
    <backup><duration>6</duration></backup>
    <note><pitch><step>${step}</step><octave>3</octave></pitch><duration>6</duration><voice>2</voice><type>half</type><dot/><staff>2</staff></note>
    </measure>`
      )
      .join("")}</part></score-partwise>`;
  const choose = async () => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([fixture], "synthetic-piano.musicxml"));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => window.SheetReader);
    return SheetReader.player;
  };
  const storage = JSON.stringify({ ...localStorage });
  const soundfontBefore = Tactus.audio.soundfont;
  const instrument = await soundfontBefore("acoustic_grand_piano");
  const context = Tactus.audio.context();
  const analyser = context.createAnalyser();
  instrument.connect(analyser);
  const scheduled = [];
  const playBefore = instrument.play;
  instrument.play = function (...args) {
    scheduled.push(args);
    return playBefore.apply(this, args);
  };
  let peak = 0;
  try {
    const player = await choose();
    assert(player.snapshot().state === "paused", "Opening never autoplays");
    assert(player.snapshot().duration === 6 && player.snapshot().starts[2] === 3, "Local playback follows explicit tempo changes");
    await player.play();
    await until(() => scheduled.length >= 2);
    assert(context.state === "running" && Object.keys(instrument.buffers).length > 0, "Real piano samples are decoded and running");
    assert(scheduled.some(([midi]) => midi === 60) && scheduled.some(([midi]) => midi === 48), "Both staves sound at written octaves");
    const samples = new Float32Array(analyser.fftSize);
    for (let i = 0; i < 10; i++) {
      await sleep(50);
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...samples.map(Math.abs));
    }
    assert(peak > 0.0001, "Piano output has a non-silent audio signal");
    const marker = document.querySelector(".sheet-playhead");
    const position = marker.style.transform;
    await sleep(100);
    assert(!marker.hidden && marker.style.transform !== position, "Playhead moves with the live clock");
    player.pause();
    const count = scheduled.length;
    await sleep(300);
    assert(scheduled.length === count, "Pause stops scheduling");
    player.restart();
    player.setRate(0.5);
    await player.play();
    await sleep(450);
    assert(player.snapshot().time > 0.1 && player.snapshot().time < 0.4, "Half speed slows score time without changing pitch");
    player.pause();
    player.setRate(1.5);
    player.setLoop(2, 2, true);
    player.seek(2);
    const loopStart = scheduled.length;
    await player.play();
    await sleep(2300);
    assert(player.snapshot().measure === 2 && player.snapshot().state === "playing", "Local single-measure loop stays within its boundaries");
    assert(scheduled.slice(loopStart).filter(([midi]) => midi === 62).length >= 3, "Local loop repeats the written notes");
    player.pause();
    player.setLoop(1, 3, false);
    player.restart();
    player.setTranspose(1);
    const transposeStart = scheduled.length;
    await player.play();
    assert(
      scheduled.slice(transposeStart).some(([midi]) => midi === 61),
      "Transposed local notation sounds a semitone higher"
    );
    player.pause();
    player.setTranspose(0);
    player.setRate(1);
    player.seek(3);
    await player.play();
    await until(() => player.snapshot().time > 3.15);
    let active = scheduled.length;
    const replacement = await choose();
    await sleep(300);
    assert(
      player.snapshot().state === "paused" && replacement !== player && scheduled.length === active,
      "Replacement immediately stops old audio without autoplay"
    );
    assert(document.querySelectorAll("[data-sheet-playback]").length === 1, "Replacement has exactly one transport");

    let release;
    Tactus.audio.soundfont = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const pending = replacement.play();
    assert(replacement.snapshot().state === "loading", "Pending sample load is cancellable");
    close.click();
    active = scheduled.length;
    release(instrument);
    await pending;
    await sleep(300);
    assert(
      !window.SheetReader && replacement.snapshot().state === "paused" && scheduled.length === active,
      "Closing during sample loading prevents late audio"
    );
    assert(!document.querySelector(".sheet-playhead, [data-sheet-playback]"), "Close removes all playback UI");
    await choose();
    Tactus.audio.soundfont = () => Promise.reject(new Error("Synthetic sample failure"));
    await SheetReader.player.play();
    assert(
      SheetReader.player.snapshot().state === "paused" && document.querySelector("[data-practice-status]").textContent.includes("could not load"),
      "Sample failures stay paused with an error"
    );
    Tactus.audio.soundfont = soundfontBefore;
    await SheetReader.player.play();
    assert(SheetReader.player.snapshot().state === "playing", "Play retries a failed sample load");
    close.click();
    assert(JSON.stringify({ ...localStorage }) === storage, "Playback never persists local score or practice state");
    return { width: innerWidth, checks: checks.length, result: "passed", signalPeak: peak, scheduledNotes: scheduled.length };
  } finally {
    close.click();
    Tactus.audio.soundfont = soundfontBefore;
    instrument.play = playBefore;
    analyser.disconnect();
  }
})();
