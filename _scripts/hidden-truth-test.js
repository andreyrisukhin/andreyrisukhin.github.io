#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets/music/sheet-music/hidden-truth");
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const omittedName = new RegExp(String.fromCharCode(101, 112, 105, 99, 97, 116), "i");
// Variant hashes come from the supplied bundle's validation.json.
// The original part hash identifies the reviewed, playback-equivalent engraving cleanup.
const expected = [
  ["hidden-truth", 905, null],
  ["hidden-truth-faithful", 817, "209f30ed0e8b26ec6d7ab2408bc5950f348babdee621db228db518cc56c35e1c"],
  ["hidden-truth-lean", 593, "b379d8d4566366018584ed4b2719712db18b5cd3e439a3270a5b0b9bb5e99696"],
  ["hidden-truth-full", 618, "b1ec6c09ee067e6c69a1dfdbc21f846b377412677add6199ff0037c6827e2c7c"],
];
for (const [slug, pitches, hash] of expected) {
  const xml = fs.readFileSync(path.join(assets, slug + ".musicxml"), "utf8");
  assert.equal((xml.match(/<measure\b/g) || []).length, 61, slug + " retains every measure");
  assert.equal((xml.match(/<pitch>/g) || []).length, pitches, slug + " retains its pitched-note count");
  if (hash) assert.equal(sha(xml), hash, slug + " is byte-identical to the supplied variant");
  else {
    assert.equal(
      sha(xml.match(/<part(?:\s[^>]*)?>[\s\S]*<\/part>/)[0]),
      "fffb7a352b430c651065b43fb7a9a8244f6f8f2bbc4e2fbc8aebe26ba8b6e114",
      "Original uses the reviewed, playback-preserving cleaned edition"
    );
    assert.ok(xml.includes("<work-title>Hidden Truth (original transcription draft)</work-title>"));
    const hidden = xml.match(/<note\b[^>]*print-object="no"[\s\S]*?<\/note>/g) || [];
    assert.equal(hidden.length, 59, "Only 59 redundant rests are hidden");
    assert.ok(
      hidden.every((note) => note.includes("<rest") && !note.includes("<pitch>")),
      "No pitched notes are hidden"
    );
    assert.equal((xml.match(/<beam\b/g) || []).length, 433, "Reviewed beat-level beaming remains");
    assert.equal((xml.match(/<octave-shift\b/g) || []).length, 12, "Six register-shift ranges retain their starts and stops");
  }
  const page = fs.readFileSync(path.join(root, "_pages/music-sheet-" + slug + ".md"), "utf8");
  assert.ok(page.includes("permalink: /music/sheet/" + slug + "/"), slug + " has a direct route");
  assert.ok(page.includes("{% include hidden-truth-book.liquid %}"), slug + " uses the shared chooser");
  const catalog = fs.readFileSync(path.join(root, "_data/music/sheet_scores.yml"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(catalog.includes(slug + ":\n  url: /assets/music/sheet-music/hidden-truth/" + slug + ".musicxml"));
  if (hash) {
    const midi = fs.readFileSync(path.join(assets, slug + ".mid"));
    assert.equal(midi.subarray(0, 4).toString(), "MThd", slug + " includes a MIDI download");
  }
}
for (const name of fs.readdirSync(assets)) {
  const content = fs.readFileSync(path.join(assets, name)).toString("utf8");
  assert.ok(!omittedName.test(content), name + " omits the requested artist name");
  assert.ok(!/\/home\/[^/\s]+\/|[A-Z]:\\Users\\/i.test(content), name + " omits private machine paths");
}
const descriptions = fs.readFileSync(path.join(root, "_data/music/hidden_truth.yml"), "utf8");
for (const phrase of ["Original", "Faithful", "Lean", "Full", "198", "26", "20 measures", "+10 cents", "performer-verified"]) {
  assert.ok(descriptions.includes(phrase), "Descriptions retain " + phrase);
}
assert.ok(!omittedName.test(descriptions), "Descriptions omit the requested name");
const audition = fs.readFileSync(path.join(assets, "comparison.html"), "utf8");
assert.ok(audition.includes('id="score-data"'), "Registration-aware audition keeps its self-contained payload");
assert.ok(!/<script[^>]+\bsrc=/.test(audition), "Audition needs no script CDN");
assert.ok(!/\bfetch\s*\(/.test(audition), "Audition does not fetch score data");
console.log("Hidden Truth: four complete scores, original note preservation, bundle hashes, metadata, descriptions, MIDI, and audition passed");
