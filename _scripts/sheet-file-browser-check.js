// Run on /music/sheet/open/ at desktop and mobile widths.
// Uses synthetic scores only; no private score is checked into the repository.
(async () => {
  const checks = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
  };
  const bridge = window.__sheetMusic;
  const input = document.getElementById("sheet-file");
  const status = document.getElementById("osmd-status");
  const container = document.getElementById("osmd-container");
  const close = document.getElementById("sheet-file-clear");
  const fixture = (title, count = 1) => `<?xml version="1.0"?>
    <!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
    <score-partwise version="4.0"><work><work-title>${title}</work-title></work>
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
    ${Array.from(
      { length: count },
      (_, index) => `<measure number="${index + 1}"><attributes><divisions>1</divisions>
    <key><fifths>0</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>half</type><dot/></note></measure>`
    ).join("")}
    </part></score-partwise>`;
  const wait = async (fn) => {
    for (let i = 0; i < 100; i++) {
      if (fn()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out: " + status.textContent);
  };
  const choose = (xml, name = "private.musicxml") => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([xml], name, { type: "application/xml" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  close.click();
  assert(!bridge.ready && !container.querySelector("svg"), "Empty reader has no score");
  assert(document.getElementById("osmd-zoom-in").disabled, "Empty reader disables score controls");
  assert(!document.querySelector('script[src*="dev-annotator.js"]'), "No annotation uploads, even on localhost");
  const saved = JSON.stringify({ ...localStorage });
  const requests = [];
  const fetchBefore = window.fetch;
  const sendBefore = XMLHttpRequest.prototype.send;
  const beaconBefore = navigator.sendBeacon;
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
    choose(fixture("Private &lt;script&gt; title"));
    await wait(() => bridge.ready);
    assert(bridge.osmd.Sheet.SourceMeasures.length === 1 && container.querySelector(".vf-notehead"), "File renders with OSMD");
    assert(container.textContent.includes("Private <script> title") && !container.querySelector("script"), "Score titles are text, not HTML");
    assert(!container.querySelector("[data-hidden-chord-text]"), "Local scores retain written chord symbols");
    assert(!document.getElementById("osmd-zoom-in").disabled, "Loaded score enables controls");
    const zoom = bridge.osmd.Zoom;
    document.getElementById("osmd-zoom-in").click();
    assert(bridge.osmd.Zoom > zoom, "Zoom renders a local score");
    const note = container.querySelector('.vf-stavenote[tabindex="0"]');
    note.focus();
    note.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(document.getElementById("sheet-inspector").open, "Keyboard note inspection works");
    document.querySelector("[data-inspect-close]").click();
    document.getElementById("osmd-focus-toggle").click();
    assert(document.documentElement.classList.contains("sheet-music-focus-open"), "Focus mode opens");
    close.click();
    assert(!bridge.ready && !bridge.xml && !bridge.osmd && !container.querySelector("svg"), "Close releases score data and notation");
    assert(
      !document.getElementById("sheet-note-pitches").textContent && !document.getElementById("sheet-right-keyboard").children.length,
      "Close clears inspector pitches and diagrams"
    );
    assert(!document.documentElement.classList.contains("sheet-music-focus-open"), "Close exits focus mode");
    choose(fixture("Second score", 2), "second.xml");
    await wait(() => bridge.ready);
    assert(bridge.osmd.Sheet.SourceMeasures.length === 2, "A second file replaces the first score");
    const replacement = container.querySelector('.vf-stavenote[tabindex="0"]');
    replacement.focus();
    replacement.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(document.getElementById("sheet-inspector").open, "Inspector binds to replacement notation");
    document.querySelector("[data-inspect-close]").click();

    for (const [xml, name, error] of [
      ["<score-partwise>", "broken.xml", "well-formed"],
      ["<html/>", "wrong.xml", "partwise"],
      ["<score-partwise/>", "empty.xml", "no measures"],
      ["", "blank.musicxml", "nonempty"],
      [fixture("Compressed"), "score.mxl", "uncompressed"],
      ['<!DOCTYPE score-partwise [<!ENTITY secret SYSTEM "https://example.invalid/private">]><score-partwise/>', "entity.xml", "entity"],
      [" ".repeat(10 * 1024 * 1024 + 1), "large.musicxml", "10 MB"],
    ]) {
      choose(xml, name);
      await wait(() => status.textContent.includes(error));
      assert(!bridge.ready && !bridge.xml && !container.querySelector("svg"), "Invalid file cleared safely: " + name);
    }
    const doc = await SheetLocalFile.read(
      new File(
        [
          fixture("External art")
            .replace("<work>", '<credit><credit-image source="https://example.invalid/private"/></credit><work>')
            .replace("</part-list>", '</part-list><image source="https://example.invalid/art"/><link href="https://example.invalid/link"/>'),
        ],
        "art.musicxml"
      )
    );
    assert(!doc.doctype && !doc.querySelector("image, credit-image, link, opus"), "External artwork, links, and DTD are not passed to the renderer");

    const readBefore = SheetLocalFile.read;
    let release;
    SheetLocalFile.read = () =>
      new Promise((resolve) => {
        release = () => resolve(new DOMParser().parseFromString(fixture("Stale"), "application/xml"));
      });
    choose(fixture("Delayed"));
    close.click();
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    SheetLocalFile.read = readBefore;
    assert(!bridge.ready && !container.querySelector("svg"), "Closing cancels an in-flight file read");
    choose(fixture("Recovered"));
    await wait(() => bridge.ready);
    assert(container.textContent.includes("Recovered"), "Reader recovers after invalid files and cancellation");
    assert(document.documentElement.scrollWidth <= innerWidth, "Page fits the viewport");
    assert(requests.length === 0, "Opening and inspecting scores makes no fetch, XHR, or beacon requests");
    assert(JSON.stringify({ ...localStorage }) === saved, "Score contents and filenames are not written to localStorage");
    close.click();
  } finally {
    window.fetch = fetchBefore;
    XMLHttpRequest.prototype.send = sendBefore;
    navigator.sendBeacon = beaconBefore;
  }
  return { width: innerWidth, checks: checks.length, result: "passed" };
})();
