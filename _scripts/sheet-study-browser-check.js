// Run on the real Hidden Truth original at desktop and mobile widths.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const bridge = window.__sheetMusic;
  const change = (selector, on) => {
    const control = document.querySelector(selector);
    control.checked = on;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const labels = () => [...document.querySelectorAll("[data-study-measure]")];
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert(bridge.ready && SheetReader.score.events.length === 881, "Actual Hidden Truth loaded with 881 sounding events");
  const before = JSON.stringify(SheetReader.score.events);
  const xmlBefore = new XMLSerializer().serializeToString(bridge.xml);
  const firstNotes = [...bridge.xml.querySelectorAll('measure[number="1"] > note')];
  assert(
    firstNotes.filter((note) => note.querySelector("rest") && note.getAttribute("print-object") === "no").length === 1,
    "Opening redundant rest is hidden"
  );
  const hidden = [...bridge.xml.querySelectorAll('note[print-object="no"]')];
  assert(
    hidden.length === 59 && hidden.every((note) => note.querySelector("rest") && !note.querySelector("pitch")),
    "Only redundant rests are hidden"
  );
  change("[data-study-chords]", true);
  change("[data-study-octaves]", true);
  await frame();
  assert(labels().length === 61, "Every measure has a study label");
  assert(labels()[2].textContent.includes("Dm?"), "Opening D-A-D plus F is analyzed across both staves");
  assert(labels()[4].textContent.includes("B♭1+B♭2"), "Bass octave is named in its actual sounding register despite 8vb");
  assert(document.querySelectorAll(".sheet-octave-note").length > 100, "Actual doubled noteheads are highlighted");
  assert(document.querySelectorAll(".sheet-measure-time").length === 61, "Timestamp labels survive learning controls");
  for (const label of labels()) {
    const r = label.getBoundingClientRect();
    assert(r.height >= 44 && r.width >= 44, "Study labels are touch sized");
    assert(r.left >= 0 && r.right <= document.documentElement.clientWidth + 1, "Study labels fit the screen");
  }
  // Lane buttons must not obscure any notehead (including low bass ledger lines).
  const noteRects = [...document.querySelectorAll(".vf-notehead")].map((el) => el.getBoundingClientRect());
  for (const label of labels()) {
    const r = label.getBoundingClientRect();
    assert(
      !noteRects.some((n) => n.width && n.height && r.left < n.right && r.right > n.left && r.top < n.bottom && r.bottom > n.top),
      "Study lane does not overlap notation"
    );
  }
  labels()[4].click();
  const dialog = document.querySelector("[data-study-dialog]");
  assert(dialog.open && dialog.textContent.includes("B♭1") && dialog.textContent.includes("B♭2"), "Measure inspection names both bass octaves");
  assert(dialog.textContent.includes("Bass / lower staff") && dialog.textContent.includes("Upper staff"), "Bass and melody notes stay separate");
  dialog.querySelector("[data-study-close]").click();
  await frame();
  assert(document.activeElement === labels()[4], "Closing inspection restores keyboard focus");
  document.getElementById("osmd-zoom-in").click();
  await frame();
  assert(labels().length === 61, "Learning labels rebuild at changed zoom");
  document.getElementById("osmd-zoom-reset").click();
  SheetReader.player.setTranspose(2);
  await frame();
  assert(labels()[4].textContent.includes("C2+C3"), "Study pitch spelling follows transposition");
  SheetReader.player.setTranspose(0);
  await frame();
  assert(labels()[4].textContent.includes("B♭1+B♭2"), "Returning to the written key restores study pitches");
  change("[data-study-chords]", false);
  assert(labels().length === 61 && !labels()[2].textContent.includes("Dm?"), "Octave labels work independently of chord analysis");
  change("[data-study-octaves]", false);
  assert(!labels().length && !document.querySelector(".sheet-octave-note"), "Both aids turn off completely");
  assert(JSON.stringify(SheetReader.score.events) === before, "Every scheduled pitch, onset and duration is unchanged");
  assert(new XMLSerializer().serializeToString(bridge.xml) === xmlBefore, "Learning aids never modify MusicXML");
  assert(SheetReader.player.snapshot().state === "paused", "Learning controls do not autoplay");
  assert(document.documentElement.scrollWidth <= innerWidth, "Page has no horizontal overflow");
  return { result: "passed", width: innerWidth, checks: checks.length };
})();
