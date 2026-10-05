// node _scripts/outfit-colors-test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "assets/js/color-outfit/model.js"), "utf8");
const context = { URLSearchParams };
vm.runInNewContext(source, context);
const O = context.OutfitColor;
const sum = (list) => list.reduce((a, b) => a + b, 0);

// Color conversions round-trip.
for (const hex of ["#000000", "#ffffff", "#5b6236", "#1f2a44", "#d62828"]) {
  assert.equal(O.hsvToHex(O.hexToHsv(hex)), hex);
}
assert.equal(O.normalizeHex("#ABC"), "#aabbcc");
assert.equal(O.normalizeHex("nope"), null);

// Menswear neutrals stay quiet; bright colors read as loud.
assert.equal(O.colorRole("#f4f2ec"), "neutral");
assert.equal(O.colorRole("#3a3d40"), "neutral");
assert.equal(O.colorRole("#5b6236"), "muted");
assert.equal(O.colorRole("#d62828"), "loud");

// Shares always total 100.
assert.deepEqual(O.toPercentages([1, 1, 1]), [34, 33, 33]);
assert.equal(sum(O.toPercentages([0.2, 7, 3.3, 9])), 100);
assert.deepEqual(O.setShare([40, 30, 20, 10], 0, 70), [70, 15, 10, 5]);
assert.deepEqual(O.setShare([97, 1, 1, 1], 3, 50), [48, 1, 1, 50]);
assert.deepEqual(O.moveBoundary([50, 30, 20], 1, 25), [50, 49, 1]);
assert.deepEqual(O.moveBoundary([50, 30, 20], 0, -10), [40, 40, 20]);

// Shorts take less of the look than chinos, and an outer layer hides the top.
const withChinos = O.defaultShares(["tee", "chinos", "shoes"]);
const withShorts = O.defaultShares(["tee", "shorts", "shoes"]);
assert.ok(withShorts[1] < withChinos[1]);
assert.ok(withChinos[1] > withChinos[0]);
assert.ok(withShorts[1] < withShorts[0]);
const layered = O.defaultShares(["shirt", "jacket", "chinos"]);
assert.ok(layered[0] < layered[1]);
assert.equal(sum(layered), 100);

// Harmonies.
assert.deepEqual(Array.from(O.harmonyHues(30, "complementary")), [210]);
assert.deepEqual(Array.from(O.harmonyHues(350, "analogous")), [320, 20]);
assert.equal(O.harmonySuggestions("#5b6236", "triadic").length, 4);

// Analysis.
const neutral = O.analyzeOutfit([
  { label: "Chinos", hex: "#5b6236", share: 49 },
  { label: "T-shirt", hex: "#f4f2ec", share: 41 },
  { label: "Shoes", hex: "#1f2a44", share: 10 },
]);
assert.equal(neutral.scheme, "neutral");
const clash = O.analyzeOutfit([
  { label: "Shirt", hex: "#d62828", share: 40 },
  { label: "Pants", hex: "#1f4fd1", share: 45 },
  { label: "Shoes", hex: "#f4f2ec", share: 15 },
]);
assert.equal(clash.scheme, "contrasting");
assert.ok(clash.notes.some((n) => n.title === "Loud colors compete"));
assert.equal(
  O.analyzeOutfit([
    { label: "Overshirt", hex: "#a4472c", share: 30 },
    { label: "Chinos", hex: "#2c89a4", share: 70 },
  ]).scheme,
  "complementary"
);
const accent = O.analyzeOutfit([
  { label: "Sweater", hex: "#1f2a44", share: 55 },
  { label: "Chinos", hex: "#b9b9b4", share: 35 },
  { label: "Hat", hex: "#c9a227", share: 10 },
]);
assert.ok(accent.notes.some((n) => n.title === "Accent sized well"));
assert.ok(accent.notes.some((n) => n.title === "Strong anchor"));
const matching = O.analyzeOutfit([
  { label: "Jacket", hex: "#3d5a80", share: 50 },
  { label: "Jeans", hex: "#3e5b81", share: 50 },
]);
assert.ok(matching.notes.some((n) => n.title === "One color"));

// Ideas keep the anchor and locked pieces, and give footwear sensible colors.
const base = [
  { garment: "tee", hex: "#f4f2ec", share: 33 },
  { garment: "chinos", hex: "#5b6236", share: 49 },
  { garment: "shoes", hex: "#5c4033", share: 8 },
  { garment: "belt", hex: "#5c4033", share: 2 },
  { garment: "hat", hex: "#1c1c1e", share: 8 },
];
assert.equal(O.anchorIndex(base), 1);
const ideas = O.suggestOutfits(base, { locked: [0, 1] });
assert.ok(ideas.length >= 3);
for (const idea of ideas) {
  assert.equal(idea.hexes[1], "#5b6236");
  assert.equal(idea.hexes[0], "#f4f2ec");
  assert.ok(idea.hexes.every((hex) => O.normalizeHex(hex) === hex));
  if (O.colorRole(idea.hexes[2]) !== "loud" && idea.hexes[2] !== "#f4f2ec") assert.equal(idea.hexes[3], idea.hexes[2]);
}
assert.equal(new Set(ideas.map((i) => i.hexes.join())).size, ideas.length);
assert.ok(
  O.suggestOutfits(
    [
      { garment: "sweater", hex: "#9a9c9e", share: 60 },
      { garment: "jeans", hex: "#3d5a80", share: 40 },
    ],
    { variant: 2 }
  ).length >= 2
);
assert.ok(O.suggestOutfits([{ garment: "tee", hex: "#ffffff", share: 100 }]).length === 0);

// Olive gets curated pairings first, and a pairing's accent lands on the shoes when nothing else is small.
assert.equal(O.familyOf("#556b2f"), "olive");
assert.equal(O.familyOf("#1f2a44"), "navy");
assert.equal(O.familyOf("#d62828"), null);
const olive = [
  { garment: "tee", hex: "#f4f2ec", share: 41 },
  { garment: "chinos", hex: "#5b6236", share: 49 },
  { garment: "shoes", hex: "#5c4033", share: 10 },
];
const oliveIdeas = O.suggestOutfits(olive);
assert.ok(oliveIdeas[0].proven && oliveIdeas[0].name.startsWith("Olive"));
const rust = O.suggestOutfits(olive, { variant: 1 }).find((idea) => idea.name === "Olive + rust accent");
assert.equal(rust.hexes[2], "#a4472c");

// Locking a smaller piece makes it the base, so the larger unlocked tee gets repainted around the shorts.
const shortsLook = [
  { garment: "tee", hex: "#f4f2ec", share: 54 },
  { garment: "shorts", hex: "#5b6236", share: 33, locked: true },
  { garment: "shoes", hex: "#5c4033", share: 13 },
];
assert.equal(O.ideaBaseIndex(shortsLook, [1]), 1);
assert.equal(
  O.ideaBaseIndex(
    shortsLook.map(({ locked, ...p }) => p),
    []
  ),
  0
);
const shortsIdeas = O.suggestOutfits(shortsLook, { locked: [1] });
assert.ok(shortsIdeas.every((idea) => idea.hexes[1] === "#5b6236"));
assert.ok(shortsIdeas.some((idea) => idea.hexes[0] !== "#f4f2ec"));
assert.ok(shortsIdeas[0].name.startsWith("Olive"));
assert.equal(O.suggestOutfits(shortsLook, { locked: [0, 1, 2] }).length, 0);

// Locks survive links.
const lockedLink = O.encodeOutfit({ auto: true, pieces: shortsLook });
assert.equal(lockedLink, "o=tee.f4f2ec_shorts.5b6236.k_shoes.5c4033");
const lockedBack = O.decodeOutfit(lockedLink);
assert.deepEqual(
  Array.from(lockedBack.pieces, (p) => Boolean(p.locked)),
  [false, true, false]
);
assert.equal(lockedBack.auto, true);
const lockedCustom = O.decodeOutfit("o=tee.ffffff.60_shorts.5b6236.40.k");
assert.deepEqual(
  Array.from(lockedCustom.pieces, (p) => p.share),
  [60, 40]
);
assert.equal(lockedCustom.pieces[1].locked, true);

// Owned colors: ideas pick gray or brown shoes, a locked brown bag pulls toward brown, and every owned color appears.
const BROWN = "#5c4033";
const GRAY = "#8a8d8f";
const owned = [
  { garment: "tee", hex: "#f4f2ec", share: 50 },
  { garment: "shorts", hex: "#5b6236", share: 30, locked: true },
  { garment: "shoes", hex: BROWN, share: 12, locked: true, options: [BROWN, GRAY] },
  { garment: "bag", hex: BROWN, share: 8, locked: true },
];
assert.equal(O.ideaBaseIndex(owned), 1);
const ownedIdeas = O.suggestOutfits(owned);
assert.ok(ownedIdeas.every((idea) => [BROWN, GRAY].includes(idea.hexes[2])));
assert.ok(ownedIdeas.every((idea) => idea.hexes[1] === "#5b6236" && idea.hexes[3] === BROWN));
assert.ok(ownedIdeas.every((idea) => idea.wear.length === 1 && idea.wear[0].index === 2));
const brownCount = ownedIdeas.filter((idea) => idea.hexes[2] === BROWN).length;
assert.ok(brownCount > ownedIdeas.length / 2, "a brown bag should favor brown shoes");
assert.ok(ownedIdeas.some((idea) => idea.hexes[2] === GRAY));
// With only brown-wanting ideas, gray still shows up as an alternate.
const formal = owned.map((p) => ({ ...p }));
formal[0] = { garment: "shirt", hex: "#f4f2ec", share: 50 };
formal[1] = { garment: "chinos", hex: "#1f2a44", share: 30, locked: true };
const formalIdeas = O.suggestOutfits(formal);
assert.ok(formalIdeas.some((idea) => idea.hexes[2] === GRAY));
assert.ok(formalIdeas.some((idea) => idea.hexes[2] === BROWN));
// An owned color still appears when swapping it into the best idea reproduces the current outfit.
const CHARCOAL = "#3a3d40";
const current = [
  { garment: "tee", hex: "#a9c4e0", share: 49 },
  { garment: "shorts", hex: "#5b6236", share: 30, locked: true },
  { garment: "shoes", hex: CHARCOAL, share: 11, locked: true, options: [CHARCOAL, BROWN] },
  { garment: "bag", hex: BROWN, share: 10, locked: true },
];
assert.ok(O.suggestOutfits(current).some((idea) => idea.hexes[2] === CHARCOAL && idea.alternate));

// An unlocked bag follows brown shoes.
const freeBag = owned.map((p) => ({ ...p }));
freeBag[3] = { garment: "bag", hex: "#000000", share: 8 };
for (const idea of O.suggestOutfits(freeBag)) assert.equal(idea.hexes[3], BROWN);

// Leather note.
const noteFor = (list) => O.analyzeOutfit(list.map((p) => ({ ...p, label: O.garment(p.garment).label }))).notes.map((n) => n.title);
assert.ok(noteFor(owned).includes("Leather matches"));
assert.ok(noteFor(owned.map((p, i) => (i === 2 ? { ...p, hex: GRAY } : p))).includes("Leather differs"));
assert.ok(noteFor(owned.map((p, i) => (i === 2 ? { ...p, hex: "#7a5640" } : p))).includes("Two close browns"));

// Owned colors survive links.
const ownedLink = O.encodeOutfit({ auto: true, pieces: owned });
assert.equal(ownedLink, "o=tee.f4f2ec_shorts.5b6236.k_shoes.5c4033.k.8a8d8f_bag.5c4033.k");
const ownedBack = O.decodeOutfit(ownedLink).pieces[2];
assert.deepEqual(Array.from(ownedBack.options), [BROWN, GRAY]);
assert.equal(ownedBack.locked, true);
assert.equal(O.decodeOutfit("o=shoes.5c4033.8a8d8f").pieces[0].options, undefined);

// Links round-trip; auto sizes omit shares.
const auto = O.encodeOutfit({
  auto: true,
  skin: "#c68e6a",
  pieces: [
    { garment: "tee", hex: "#f4f2ec", share: 60 },
    { garment: "shorts", hex: "#5b6236", share: 40 },
  ],
});
assert.equal(auto, "o=tee.f4f2ec_shorts.5b6236&skin=c68e6a");
const decoded = O.decodeOutfit("#" + auto);
assert.equal(decoded.auto, true);
assert.equal(decoded.skin, "#c68e6a");
assert.deepEqual(
  Array.from(decoded.pieces, (p) => p.share),
  Array.from(O.defaultShares(["tee", "shorts"]))
);
const custom = O.decodeOutfit("o=tee.ffffff.70_chinos.5b6236.30");
assert.equal(custom.auto, false);
assert.deepEqual(
  Array.from(custom.pieces, (p) => p.share),
  [70, 30]
);
assert.equal(O.decodeOutfit("o=cape.ffffff"), null);

console.log("outfit-colors-test: ok");
