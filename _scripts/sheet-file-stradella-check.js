// Run on /music/sheet/open/. Synthetic scores only: an accordion score in
// Stradella notation, a piano score, and a score with a written minor mode.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const bridge = window.__sheetMusic;
  const input = document.getElementById("sheet-file");
  const status = document.getElementById("osmd-status");
  const toggle = document.querySelector("[data-practice-stradella]");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (fn) => {
    for (let i = 0; i < 100; i++) {
      if (fn()) return;
      await sleep(50);
    }
    throw new Error("Timed out: " + status.textContent);
  };
  const note = (step, alter, octave, staff, extra = "") =>
    `<note>${extra}<pitch><step>${step}</step>${
      alter ? `<alter>${alter}</alter>` : ""
    }<octave>${octave}</octave></pitch><duration>1</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;
  const word = (text) => `<direction placement="above"><direction-type><words>${text}</words></direction-type><staff>2</staff></direction>`;
  const score = ({ fifths, mode = "", name, lower }) => `<score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>${name}</part-name></score-part></part-list><part id="P1">
    ${lower
      .map(
        (left, i) => `<measure number="${i + 1}">${
          i
            ? ""
            : `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths>${mode}</key><time><beats>3</beats><beat-type>4</beat-type></time>
    <staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`
        }
    ${note("E", 0, 5, 1)}${note("D", 1, 5, 1)}${note("C", 1, 5, 1)}<backup><duration>3</duration></backup>${left}</measure>`
      )
      .join("")}</part></score-partwise>`;
  const choose = async (xml, name) => {
    const previous = window.SheetReader;
    const transfer = new DataTransfer();
    transfer.items.add(new File([xml], name, { type: "application/xml" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => window.SheetReader && window.SheetReader !== previous && bridge.ready);
    return window.SheetReader;
  };
  const keyName = () => document.querySelector("[data-pb-key-name]").textContent;
  const chordTones = () =>
    SheetReader.score.events
      .filter((event) => event.role === "chord")
      .map((event) => event.midi)
      .slice(0, 3);

  // C#m and G#7 chord buttons (roots at or above D3) over C# and G# basses,
  // four sharps, no <mode>.
  const accordion = score({
    fifths: 4,
    name: "Bayan",
    lower: [
      note("C", 1, 2, 2) + word("C♯m") + note("C", 1, 4, 2) + note("C", 1, 4, 2),
      note("G", 1, 2, 2) + word("G♯7") + note("G", 1, 3, 2) + note("G", 1, 3, 2),
    ],
  });
  let reader = await choose(accordion, "bayan.musicxml");
  assert(keyName() === "C♯ minor", "A minor first chord names the key without a written mode");
  assert(
    document.querySelector(".sheet-reader").dataset.playbackStradella === "true" && toggle.checked,
    "Stradella notation turns on Stradella playback"
  );
  assert(reader.player.snapshot().instrument === "accordion", "Stradella scores start on the accordion sound");
  assert(chordTones().join() === "61,64,68", "Chord buttons sound the named chord: " + chordTones().join());
  assert(
    SheetReader.score.events.some((event) => event.role === "bass" && event.midi === 37),
    "Bass buttons sound alone"
  );
  assert(!toggle.disabled, "Stradella toggle is available while a score is open");

  reader.player.setRate(0.5);
  reader.player.seek(2);
  document.querySelector(".practice-settings").open = true;
  toggle.click();
  await wait(() => window.SheetReader && window.SheetReader !== reader);
  reader = window.SheetReader;
  assert(!reader.score.stradellaReadings.size && !chordTones().length, "Turning Stradella off plays written pitches");
  assert(
    reader.player.snapshot().rate === 0.5 && reader.player.snapshot().measure === 2 && reader.player.snapshot().instrument === "accordion",
    "Toggling keeps speed, measure, and sound"
  );
  assert(
    document.querySelector(".practice-settings").open && document.activeElement === toggle,
    "Toggling keeps settings open and focus on the toggle"
  );
  assert(document.querySelectorAll("[data-sheet-playback]").length === 1, "Toggling leaves one transport");
  toggle.click();
  await wait(() => window.SheetReader && window.SheetReader !== reader);
  assert(chordTones().join() === "61,64,68", "Turning Stradella back on restores chord buttons");

  // Piano left hand: stacked chords, no chord words.
  const piano = score({
    fifths: 0,
    name: "Piano",
    lower: [note("C", 0, 3, 2) + note("E", 0, 3, 2, "<chord/>") + note("G", 0, 3, 2, "<chord/>") + note("C", 0, 3, 2) + note("C", 0, 3, 2)],
  });
  reader = await choose(piano, "piano.musicxml");
  assert(!toggle.checked && document.querySelector(".sheet-reader").dataset.playbackStradella === "false", "Piano scores play written pitches");
  assert(reader.player.snapshot().instrument === "acoustic_grand_piano", "Piano scores start on piano");
  assert(keyName() === "C major", "Pitch weights name a C major score: " + keyName());

  const written = score({
    fifths: 0,
    mode: "<mode>minor</mode>",
    name: "Piano",
    lower: [note("C", 0, 3, 2) + note("E", 0, 3, 2) + note("G", 0, 3, 2)],
  });
  await choose(written, "written-minor.musicxml");
  assert(keyName() === "A minor", "A written minor mode wins over the notes");

  document.getElementById("sheet-file-clear").click();
  assert(toggle.disabled && !window.SheetReader, "Closing the score disables the toggle");
  return { pass: true, checks };
})();
