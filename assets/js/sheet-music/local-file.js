/* Local scores stay in memory. Never resolve document-supplied URLs or entities. */
window.SheetLocalFile = (function () {
  "use strict";
  const MAX_BYTES = 10 * 1024 * 1024;

  async function read(file) {
    if (!/\.(musicxml|xml)$/i.test(file.name)) {
      throw new Error("Choose an uncompressed .musicxml or .xml file. Export compressed .mxl files as MusicXML first.");
    }
    if (!file.size || file.size > MAX_BYTES) throw new Error("Choose a nonempty MusicXML file no larger than 10 MB.");
    const xml = await file.text();
    if (/<!ENTITY/i.test(xml)) throw new Error("XML entity declarations are not supported.");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("This file is not well-formed XML.");
    if (doc.documentElement.localName !== "score-partwise") throw new Error("Choose a partwise MusicXML score.");
    if (!doc.querySelector("part > measure")) throw new Error("This score has no measures.");
    // Render notation only, not external artwork, links, or processing instructions.
    for (const node of doc.querySelectorAll("image, credit-image, link, opus")) node.remove();
    const clean = new DOMParser().parseFromString(new XMLSerializer().serializeToString(doc.documentElement), "application/xml");
    return clean;
  }

  return { read };
})();
