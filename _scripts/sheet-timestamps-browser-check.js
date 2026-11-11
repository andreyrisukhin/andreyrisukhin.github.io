// Run on an empty /music/sheet/open/ page at desktop and mobile widths.
// Synthetic MusicXML only; expected times are calculated from the fixture's beats.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const bridge = window.__sheetMusic;
  const close = document.getElementById("sheet-file-clear");
  const input = document.getElementById("sheet-file");
  const labels = () => [...document.querySelectorAll(".sheet-measure-time")];
  const times = () =>
    labels()
      .map((label) => label.textContent)
      .join(",");
  const clock = () => document.querySelector("[data-pb-time]")?.textContent;
  const until = async (predicate) => {
    for (let attempt = 0; attempt < 160; attempt++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Timestamp check timed out: " + document.getElementById("osmd-status").textContent);
  };
  const tempo = (bpm) => `<direction><direction-type><metronome><beat-unit>quarter</beat-unit>
    <per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`;
  const note = (duration = 4, type = "quarter") => `<note><pitch><step>C</step><octave>4</octave></pitch>
    <duration>${duration}</duration><type>${type}</type></note>`;
  const fixture = `<?xml version="1.0"?><score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
    <measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
    <clef><sign>G</sign><line>2</line></clef></attributes>${tempo(120)}
    <note><rest/><duration>4</duration><type>quarter</type></note>${note()}${note()}${note()}</measure>
    <measure number="2">${tempo(60)}${note(16, "whole")}</measure>
    <measure number="3">${tempo(120)}${note()}${note()}${tempo(60)}${note()}${note()}</measure>
    </part></score-partwise>`;
  const choose = async (xml) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([xml], "timestamp-fixture.musicxml"));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => bridge.ready && window.SheetReader && labels().length);
  };
  close.click();
  await choose(fixture);
  try {
    assert(times() === "0:00.0,0:02.0,0:06.0", "Measure timestamps integrate opening and later tempos");
    assert(clock() === "0:00.0 / 0:09.0", "Clock includes a mid-measure tempo change in total duration");
    assert(labels()[0].dataset.startSeconds === "0", "A leading rest does not delay the measure timestamp");
    assert(
      labels().every((label, i) => label.dataset.measure === String(i + 1)),
      "Timestamps identify their measures"
    );
    assert(labels()[1].getAttribute("aria-label").includes("Measure 2 starts at 0:02.0"), "Measure times have accessible labels");
    const previousTheme = document.documentElement.getAttribute("data-theme");
    const luminance = (css) =>
      css
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
    try {
      for (const theme of ["light", "dark"]) {
        document.documentElement.setAttribute("data-theme", theme);
        const text = luminance(getComputedStyle(labels()[0]).color);
        const paper = luminance(getComputedStyle(document.getElementById("osmd-container")).backgroundColor);
        assert(
          (Math.max(text, paper) + 0.05) / (Math.min(text, paper) + 0.05) >= 4.5,
          "Timestamps stay readable on score paper in " + theme + " mode"
        );
      }
    } finally {
      if (previousTheme === null) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", previousTheme);
    }
    SheetReader.player.seek(3);
    assert(clock() === "0:06.0 / 0:09.0", "Seeking updates the seconds clock immediately");
    assert(document.querySelector("[data-pb-seek]").getAttribute("aria-valuetext").includes("0:06.0"), "Accessible seeking includes seconds");
    SheetReader.player.setRate(0.5);
    assert(clock() === "0:06.0 / 0:09.0" && times() === "0:00.0,0:02.0,0:06.0", "Slower practice does not stretch reference timestamps");
    document.querySelector("[data-correction-toggle]").click();
    assert(
      getComputedStyle(document.querySelector(".sheet-transport")).display === "none" &&
        labels().every((label) => getComputedStyle(label).visibility === "visible"),
      "Measure timestamps remain available while editing hides playback"
    );
    document.querySelector("[data-correction-toggle]").click();
    const oldLeft = labels()[0].style.left;
    document.getElementById("osmd-zoom-in").click();
    assert(labels().length === 3 && labels()[0].style.left !== oldLeft, "Zoom rebuilds timestamp positions without duplicates");
    assert(times() === "0:00.0,0:02.0,0:06.0", "Zoom does not change score times");
    SheetReader.player.setTranspose(1);
    assert(labels().length === 3 && times() === "0:00.0,0:02.0,0:06.0", "Transposition keeps one timestamp per measure");
    const revised = bridge.xml.cloneNode(true);
    revised.querySelectorAll("part > measure")[1].querySelector("sound").setAttribute("tempo", "120");
    await bridge.replaceLocalXML(revised);
    assert(times() === "0:00.0,0:02.0,0:04.0", "Replacing the score recomputes timestamp values");
    assert(clock() === "0:04.0 / 0:07.0", "Replacement clock uses the revised tempo and preserved measure");
    assert(document.querySelectorAll(".sheet-measure-times").length === 1, "Replacement removes the previous timestamp layer");
    close.click();
    assert(!labels().length && !document.querySelector("[data-pb-time]"), "Closing removes timestamps and clock");
    await choose(fixture);
    assert(times() === "0:00.0,0:02.0,0:06.0" && clock() === "0:00.0 / 0:09.0", "Reopening resets times to the new file");
    const audio = window.Tactus.audio;
    const originalContext = audio.context;
    const originalSoundfont = audio.soundfont;
    const context = { currentTime: 0 };
    audio.context = () => context;
    audio.soundfont = async () => ({ play() {}, stop() {} });
    try {
      await SheetReader.player.play();
      context.currentTime = 1.225; // The live player starts its audio clock at 0.025.
      await until(() => clock() === "0:01.2 / 0:09.0");
      assert(clock() === "0:01.2 / 0:09.0", "The running clock advances between measure boundaries");
      SheetReader.player.pause();
      assert(clock() === "0:01.2 / 0:09.0", "Pausing retains the current fractional second");
    } finally {
      SheetReader.player.pause();
      audio.context = originalContext;
      audio.soundfont = originalSoundfont;
    }
    assert(document.documentElement.scrollWidth <= innerWidth, "Clock and timestamps fit the viewport");
    return { checks: checks.length, result: "passed", width: innerWidth };
  } finally {
    close.click();
  }
})();
