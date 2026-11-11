// Evaluate on every Hidden Truth score page at desktop and mobile widths.
(async () => {
  let checks = 0;
  const omittedName = new RegExp(String.fromCharCode(101, 112, 105, 99, 97, 116), "i");
  const assert = (value, message) => {
    if (!value) throw new Error(message);
    checks++;
  };
  const links = [...document.querySelectorAll(".sheet-variant-list a")];
  const selected = links.filter((link) => link.getAttribute("aria-current") === "page");
  const slug = location.pathname.split("/").filter(Boolean).at(-1);
  const pitches = {
    "hidden-truth": 905,
    "hidden-truth-faithful": 817,
    "hidden-truth-lean": 593,
    "hidden-truth-full": 618,
  };
  assert(links.length === 4 && new Set(links.map((link) => link.pathname)).size === 4, "Four distinct versions share one chooser");
  assert(selected.length === 1 && selected[0].pathname === location.pathname, "The selected version matches the direct URL");
  assert(
    links.every((link) => link.querySelector(".sheet-variant-summary").textContent.trim()),
    "Every version has a visible description"
  );
  assert(
    document.querySelector(".sheet-variant-heading").textContent === selected[0].querySelector(".sheet-variant-name").textContent,
    "Heading matches selection"
  );
  assert(document.querySelector(".music-section-nav [aria-current]").textContent.trim() === "Sheets", "Variant pages belong to Sheets");
  assert(document.querySelectorAll("h1").length === 1, "The book has one page title");
  const bridge = window.__sheetMusic;
  assert(bridge.ready && bridge.xml.querySelectorAll("part > measure").length === 61, "The actual selected score has loaded all measures");
  assert(bridge.xml.querySelectorAll("pitch").length === pitches[slug], "The selected score has its independently verified note count");
  assert(
    !omittedName.test(bridge.xml.documentElement.textContent + document.querySelector(".music-page article").textContent),
    "Neither score nor page displays the removed name"
  );
  assert(document.querySelectorAll(".sheet-measure-time").length === 61, "Every measure has a timestamp");
  assert(document.querySelector("[data-pb-time]").textContent.startsWith("0:00.0 / "), "The score starts with a reference-seconds clock");
  assert(SheetReader.player.snapshot().state === "paused", "Changing versions does not autoplay");
  const download = document.querySelector('.sheet-downloads a[download][href$=".musicxml"]');
  assert(download && new URL(download.href).pathname.endsWith("/" + slug + ".musicxml"), "MusicXML download belongs to the selected version");
  const xml = new DOMParser().parseFromString(await (await fetch(download.href)).text(), "application/xml");
  assert(
    !xml.querySelector("parsererror") && xml.querySelectorAll("pitch").length === pitches[slug],
    "The real download contains the selected score"
  );
  const midi = document.querySelector('.sheet-downloads a[download][href$=".mid"]');
  assert((slug === "hidden-truth") === !midi, "Each supplied bayan MIDI is downloadable; no original MIDI is invented");
  if (midi) assert((await fetch(midi.href)).ok, "The selected MIDI download resolves");
  assert(document.querySelector(".sheet-published-actions > a").search === "?score=" + slug, "Edit a local copy opens the selected version");
  const audition = document.querySelector('a[href$="/hidden-truth/comparison.html"]');
  assert(audition && (await fetch(audition.href)).ok, "The registration-aware A/B/C audition resolves");
  const details = document.querySelector(".sheet-variant-details");
  details.open = true;
  assert(details.querySelectorAll("li").length >= 8, "Arrangement details and playback limits are present");
  details.open = false;
  for (const link of links) {
    const rect = link.getBoundingClientRect();
    assert(rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth, "Variant choices fit and are touch-sized");
    link.focus();
    assert(document.activeElement === link, "Variant choices support keyboard focus");
  }
  selected[0].blur();
  assert(document.documentElement.scrollWidth <= innerWidth, "The book has no horizontal overflow");
  return { result: "passed", checks, width: innerWidth, slug };
})();
