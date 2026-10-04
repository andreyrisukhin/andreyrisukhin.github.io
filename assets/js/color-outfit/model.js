// Pure color and outfit logic. Loaded as a classic script in the page and through vm in _scripts/outfit-colors-test.js.
(function (root) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrapHue = (h) => ((h % 360) + 360) % 360;
  const hueDistance = (a, b) => {
    const d = Math.abs(wrapHue(a) - wrapHue(b));
    return d > 180 ? 360 - d : d;
  };

  function hexToRgb(hex) {
    let value = String(hex || "")
      .trim()
      .replace(/^#/, "")
      .toLowerCase();
    if (/^[0-9a-f]{3}$/.test(value)) value = value.replace(/./g, (c) => c + c);
    if (!/^[0-9a-f]{6}$/.test(value)) return null;
    return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
  }

  function rgbToHex({ r, g, b }) {
    return "#" + [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("");
  }

  function normalizeHex(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHex(rgb) : null;
  }

  // HSV with h in degrees, s and v in 0..1.
  function rgbToHsv({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
    }
    return { h: wrapHue(h * 60), s: max ? d / max : 0, v: max };
  }

  function hsvToRgb({ h, s, v }) {
    const c = v * s;
    const hp = wrapHue(h) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    const m = v - c;
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
  }

  const hexToHsv = (hex) => rgbToHsv(hexToRgb(hex) || { r: 0, g: 0, b: 0 });
  const hsvToHex = (hsv) => rgbToHex(hsvToRgb(hsv));

  // OKLCH gives perceptual lightness and chroma, which track "how light" and "how loud" better than HSV.
  function hexToOklch(hex) {
    const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const lin = (c) => {
      const n = c / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    const r = lin(rgb.r);
    const g = lin(rgb.g);
    const b = lin(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { l: L, c: Math.hypot(A, B), h: wrapHue((Math.atan2(B, A) * 180) / Math.PI) };
  }

  // Chroma bands, tuned so white, navy, charcoal, and khaki read as neutral and olive reads as muted.
  const NEUTRAL_CHROMA = 0.045;
  const LOUD_CHROMA = 0.12;
  // Navy, denim, khaki, olive, and tan carry some hue but dress like neutrals, so the scheme ignores them.
  const SCHEME_CHROMA = 0.085;

  function colorRole(hex) {
    const { c } = hexToOklch(hex);
    if (c < NEUTRAL_CHROMA) return "neutral";
    if (c < LOUD_CHROMA) return "muted";
    return "loud";
  }

  // weight approximates how much of a standing figure each garment covers.
  const GARMENTS = [
    { id: "tee", label: "T-shirt", slot: "top", weight: 30, sleeve: "short" },
    { id: "ssshirt", label: "Short-sleeve shirt", slot: "top", weight: 31, sleeve: "short" },
    { id: "shirt", label: "Shirt", slot: "top", weight: 33, sleeve: "long" },
    { id: "polo", label: "Polo", slot: "top", weight: 30, sleeve: "short" },
    { id: "sweater", label: "Sweater", slot: "top", weight: 36, sleeve: "long" },
    { id: "ssovershirt", label: "Short-sleeve overshirt", slot: "outer", weight: 30, sleeve: "short" },
    { id: "overshirt", label: "Overshirt", slot: "outer", weight: 34, sleeve: "long" },
    { id: "jacket", label: "Jacket", slot: "outer", weight: 38, sleeve: "long" },
    { id: "coat", label: "Coat", slot: "outer", weight: 52, sleeve: "long" },
    { id: "chinos", label: "Chinos", slot: "bottom", weight: 36 },
    { id: "jeans", label: "Jeans", slot: "bottom", weight: 36 },
    { id: "shorts", label: "Shorts", slot: "bottom", weight: 18 },
    { id: "shoes", label: "Shoes", slot: "shoes", weight: 7 },
    { id: "boots", label: "Boots", slot: "shoes", weight: 10 },
    { id: "socks", label: "Socks", slot: "socks", weight: 2 },
    { id: "belt", label: "Belt", slot: "belt", weight: 2 },
    { id: "hat", label: "Hat", slot: "hat", weight: 5 },
    { id: "bag", label: "Bag", slot: "bag", weight: 6 },
  ];
  const GARMENT_BY_ID = Object.fromEntries(GARMENTS.map((g) => [g.id, g]));
  const garment = (id) => GARMENT_BY_ID[id] || GARMENT_BY_ID.tee;

  // Integer shares that sum to exactly `sum` (largest remainder).
  function toPercentages(weights, sum = 100) {
    const total = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
    if (!weights.length) return [];
    if (!total) return toPercentages(weights.map(() => 1), sum);
    const raw = weights.map((w) => (Math.max(0, w) / total) * sum);
    const floors = raw.map(Math.floor);
    let left = sum - floors.reduce((a, b) => a + b, 0);
    raw
      .map((value, index) => ({ index, rest: value - floors[index] }))
      .sort((a, b) => b.rest - a.rest || a.index - b.index)
      .forEach(({ index }) => {
        if (left > 0) {
          floors[index] += 1;
          left -= 1;
        }
      });
    return floors;
  }

  // An outer layer hides most of the top beneath it.
  function garmentWeights(garmentIds) {
    const hasOuter = garmentIds.some((id) => garment(id).slot === "outer");
    return garmentIds.map((id) => {
      const g = garment(id);
      return hasOuter && g.slot === "top" ? g.weight * 0.35 : g.weight;
    });
  }

  const defaultShares = (garmentIds) => toPercentages(garmentWeights(garmentIds));

  // Set one share and scale the others so the total stays 100.
  function setShare(shares, index, value) {
    if (shares.length < 2) return [100];
    const target = clamp(Math.round(value), 1, 100 - (shares.length - 1));
    const otherIndexes = shares.map((_, i) => i).filter((i) => i !== index);
    // Every other piece keeps at least 1%, and the remainder is split in proportion to current shares.
    const spare = 100 - target - otherIndexes.length;
    const extra = toPercentages(
      otherIndexes.map((i) => Math.max(0, shares[i] - 1)),
      spare
    );
    const result = shares.slice();
    result[index] = target;
    otherIndexes.forEach((i, k) => (result[i] = 1 + extra[k]));
    return result;
  }

  // Move the border between segment index and index + 1.
  function moveBoundary(shares, index, delta) {
    const result = shares.slice();
    const pair = result[index] + result[index + 1];
    result[index] = clamp(Math.round(result[index] + delta), 1, pair - 1);
    result[index + 1] = pair - result[index];
    return result;
  }

  function harmonyHues(baseHue, scheme) {
    const offsets = {
      complementary: [180],
      analogous: [-30, 30],
      triadic: [120, 240],
      split: [150, 210],
      monochrome: [0],
    }[scheme];
    return (offsets || []).map((o) => wrapHue(baseHue + o));
  }

  function harmonySuggestions(baseHex, scheme) {
    const base = hexToHsv(baseHex);
    if (scheme === "monochrome") {
      return [0.45, 0.7, 1.25, 1.6].map((k) => hsvToHex({ h: base.h, s: clamp(base.s * (k < 1 ? 0.8 : 1), 0, 1), v: clamp(base.v * k, 0.08, 0.98) }));
    }
    if (scheme === "neutrals") return ["#f2efe6", "#d8ccb4", "#8a8d8f", "#3a3d40", "#1f2a44"];
    return harmonyHues(base.h, scheme).flatMap((h) => [
      hsvToHex({ h, s: base.s, v: base.v }),
      hsvToHex({ h, s: clamp(base.s * 0.55, 0, 1), v: clamp(base.v * 1.15, 0, 0.95) }),
    ]);
  }

  // Group chromatic hues that sit within 35 degrees of each other.
  function hueClusters(entries) {
    const clusters = [];
    entries
      .slice()
      .sort((a, b) => b.share - a.share)
      .forEach((entry) => {
        const near = clusters.find((cluster) => hueDistance(cluster.h, entry.h) <= 35);
        if (near) near.share += entry.share;
        else clusters.push({ h: entry.h, share: entry.share });
      });
    return clusters;
  }

  function classifyScheme(clusters) {
    if (!clusters.length) return "neutral";
    if (clusters.length === 1) return "monochrome";
    const spread = Math.max(...clusters.flatMap((a) => clusters.map((b) => hueDistance(a.h, b.h))));
    if (spread <= 70) return "analogous";
    if (clusters.length === 2) return spread >= 150 ? "complementary" : "contrasting";
    if (clusters.length === 3) {
      const gaps = clusters.flatMap((a, i) => clusters.slice(i + 1).map((b) => hueDistance(a.h, b.h)));
      if (gaps.every((g) => g >= 90)) return "triadic";
    }
    return "mixed";
  }

  const SCHEME_TEXT = {
    neutral: "Neutrals and earth tones, like navy, khaki, and olive. Hard to get wrong; fit and texture carry the look.",
    monochrome: "One hue family plus neutrals. Calm and cohesive.",
    analogous: "Neighboring hues. Reads as relaxed and intentional.",
    complementary: "Opposite hues. Lively; keep one of them small.",
    contrasting: "Two hues far apart but not opposite. Works best when one is muted.",
    triadic: "Three evenly spaced hues. Bold; let neutrals take the largest share.",
    mixed: "Many unrelated hues. Consider dropping one or turning it neutral.",
  };

  // pieces: [{ label, hex, share }]. Returns a scheme name and a list of notes.
  function analyzeOutfit(pieces) {
    const entries = pieces
      .filter((p) => p.share > 0)
      // Hue comes from HSV so the scheme matches the wheel on the page; lightness and chroma come from OKLCH.
      .map((p) => ({ ...p, ...hexToOklch(p.hex), h: hexToHsv(p.hex).h, role: colorRole(p.hex) }))
      .sort((a, b) => b.share - a.share);
    const notes = [];
    if (!entries.length) return { scheme: "neutral", notes };

    const chromatic = entries.filter((e) => e.c >= SCHEME_CHROMA);
    const clusters = hueClusters(chromatic);
    const scheme = classifyScheme(clusters);
    notes.push({ level: scheme === "mixed" ? "warn" : "good", title: "Scheme: " + scheme, text: SCHEME_TEXT[scheme] });

    // Colors that are nearly identical count as one when judging proportion.
    const groups = [];
    entries.forEach((e) => {
      const same = groups.find((g) => Math.abs(g.l - e.l) < 0.06 && (Math.max(g.c, e.c) < NEUTRAL_CHROMA || (hueDistance(g.h, e.h) < 20 && Math.abs(g.c - e.c) < 0.04)));
      if (same) {
        same.share += e.share;
        same.labels.push(e.label);
      } else groups.push({ ...e, labels: [e.label] });
    });
    groups.sort((a, b) => b.share - a.share);
    const lead = groups[0];
    const leadName = lead.labels.join(" + ");
    if (groups.length === 1) {
      notes.push({ level: "info", title: "One color", text: "Everything matches. Vary texture or add one small accent to give the eye somewhere to land." });
    } else if (lead.share >= 50) {
      notes.push({ level: "good", title: "Strong anchor", text: `${leadName} covers ${lead.share}%, so the eye knows where to start.` });
    } else if (lead.share < 35 && groups.length >= 3) {
      notes.push({ level: "warn", title: "No anchor", text: `The largest color covers only ${lead.share}%. Let one color take about half the look.` });
    } else {
      notes.push({ level: "info", title: "Anchor", text: `${leadName} anchors at ${lead.share}%. Around 50 to 60% makes the anchor clearer.` });
    }

    const ideal = [60, 30, 10];
    if (groups.length >= 3) {
      const actual = groups.slice(0, 3).map((g) => g.share);
      const off = actual.reduce((sum, s, i) => sum + Math.abs(s - ideal[i]), 0);
      notes.push({
        level: off <= 25 ? "good" : "info",
        title: "60 / 30 / 10",
        text: `Your top three colors sit at ${actual.join(" / ")}. ${off <= 25 ? "Close to the classic split." : "The classic split is a guide, not a law."}`,
      });
    }

    const loud = groups.filter((g) => g.role === "loud");
    const loudShare = loud.reduce((sum, g) => sum + g.share, 0);
    const competing = loud.filter((g) => g.share >= 20);
    if (competing.length >= 2 && hueDistance(competing[0].h, competing[1].h) > 30) {
      notes.push({ level: "warn", title: "Loud colors compete", text: `${competing[0].labels.join(" + ")} and ${competing[1].labels.join(" + ")} are both bright and large. Shrink one or mute it.` });
    } else if (loud.length && loudShare <= 20) {
      notes.push({ level: "good", title: "Accent sized well", text: `Bright color covers ${loudShare}%, enough to notice without shouting.` });
    } else if (loudShare > 55) {
      notes.push({ level: "info", title: "Mostly bright", text: `Bright color covers ${loudShare}%. Fine for a statement; a neutral shoe or layer calms it down.` });
    }

    const sizable = entries.filter((e) => e.share >= 10);
    if (sizable.length >= 2) {
      const range = Math.max(...sizable.map((e) => e.l)) - Math.min(...sizable.map((e) => e.l));
      if (range < 0.12) notes.push({ level: "info", title: "Low contrast", text: "The large pieces share a lightness. Tonal looks are soft; a lighter or darker piece adds definition." });
      else if (range > 0.55) notes.push({ level: "info", title: "High contrast", text: "Light and dark pieces sit far apart. Crisp and formal; split it with a mid-tone for a softer read." });
      else notes.push({ level: "good", title: "Balanced contrast", text: "The large pieces differ in lightness without a hard jump." });
    }

    return { scheme, notes };
  }

  // Hash format: chinos.556b2f.45_tee.ffffff.30 (share omitted when auto).
  function encodeOutfit(state) {
    const pieces = state.pieces.map((p) => [p.garment, p.hex.replace("#", ""), state.auto ? "" : p.share].filter(String).join("."));
    const params = new URLSearchParams();
    params.set("o", pieces.join("_"));
    if (state.skin) params.set("skin", state.skin.replace("#", ""));
    return params.toString();
  }

  function decodeOutfit(text) {
    const params = new URLSearchParams(String(text || "").replace(/^#/, ""));
    const raw = params.get("o");
    if (!raw) return null;
    const pieces = raw
      .split("_")
      .map((part) => {
        const [id, hex, share] = part.split(".");
        const color = normalizeHex(hex);
        if (!GARMENT_BY_ID[id] || !color) return null;
        return { garment: id, hex: color, share: Number(share) || 0 };
      })
      .filter(Boolean);
    if (!pieces.length) return null;
    const auto = pieces.every((p) => !p.share);
    const shares = auto ? defaultShares(pieces.map((p) => p.garment)) : toPercentages(pieces.map((p) => p.share || 1));
    pieces.forEach((p, i) => (p.share = shares[i]));
    return { pieces, auto, skin: normalizeHex(params.get("skin")) };
  }

  // ----- Outfit ideas -----

  const LIGHT_NEUTRALS = ["#f4f2ec", "#e9e1cc", "#c9c9c4"];
  const DARK_NEUTRALS = ["#1f2a44", "#3a3d40", "#2f3b2c"];
  const MID_NEUTRALS = ["#c3b091", "#9a9c9e", "#b08a5a"];
  // A neutral anchor has no hue to build on, so ideas borrow one of these classic menswear hues.
  const PARTNER_COLORS = ["#5b6236", "#3d5a80", "#a4472c", "#6d1f2b", "#4f6d5e"];
  const LEATHER = { brown: "#5c4033", tan: "#a0784f", dark: "#3b2a20", black: "#1c1c1e", white: "#f4f2ec" };
  const FOOT_SLOTS = ["shoes", "belt", "socks"];
  const CASUAL = ["tee", "ssshirt", "polo", "ssovershirt", "shorts"];

  // Proven menswear pairings for common anchor colors. Hue math alone misses many of these
  // (olive with light blue or rust, navy with khaki), so they lead the ideas when the anchor is close.
  // Each pairing: [name, supporting color, small accent or null, shoes, why it works].
  const PAIRINGS = {
    olive: {
      ref: "#5b6236",
      pairs: [
        ["Olive + white", "#f4f2ec", null, "#f4f2ec", "Crisp and simple. White makes olive look intentional."],
        ["Olive + light blue", "#a9c4e0", null, "#a0784f", "Cool blue against warm green. The classic oxford-shirt pairing."],
        ["Olive + navy", "#1f2a44", null, "#5c4033", "Two dark neutrals, rich and low-key. Brown leather ties them together."],
        ["Olive + cream", "#e9e1cc", null, "#3b2a20", "Softer than white. Warm and outdoorsy."],
        ["Olive + rust accent", "#e9e1cc", "#a4472c", "#5c4033", "Rust sits near olive’s opposite; keep it small."],
        ["Olive + burgundy", "#c9c9c4", "#6d1f2b", "#3b2a20", "Red-green complement, both muted, so it reads rich instead of festive."],
        ["Olive + gray", "#9a9c9e", null, "#1c1c1e", "Cool gray mutes the green. Urban and calm."],
        ["Olive + black", "#1c1c1e", null, "#1c1c1e", "Dark and utilitarian. Works best with olive as the lighter piece."],
        ["Olive + dusty pink", "#d8a7a0", null, "#f4f2ec", "Pink is green’s complement; dusty pink keeps it gentle."],
        ["Olive + mustard accent", "#f4f2ec", "#c9a227", "#5c4033", "An analogous warm pop. Good for fall."],
      ],
    },
    navy: {
      ref: "#1f2a44",
      pairs: [
        ["Navy + white", "#f4f2ec", null, "#f4f2ec", "Nautical and clean. Hard to beat."],
        ["Navy + khaki", "#c3b091", null, "#5c4033", "The default smart-casual pairing."],
        ["Navy + gray", "#9a9c9e", null, "#1c1c1e", "Cool and quiet. Office-friendly."],
        ["Navy + light blue", "#a9c4e0", null, "#a0784f", "Tonal blues, light against dark."],
        ["Navy + burgundy accent", "#e9e1cc", "#6d1f2b", "#3b2a20", "A rich accent that keeps navy formal."],
        ["Navy + olive", "#5b6236", null, "#5c4033", "Two dark neutrals with brown leather."],
      ],
    },
    khaki: {
      ref: "#c3b091",
      pairs: [
        ["Khaki + navy", "#1f2a44", null, "#5c4033", "The default smart-casual pairing."],
        ["Khaki + white", "#f4f2ec", null, "#a0784f", "Light and summery."],
        ["Khaki + light blue", "#a9c4e0", null, "#5c4033", "Soft and preppy."],
        ["Khaki + olive", "#5b6236", null, "#3b2a20", "Earthy and outdoorsy."],
        ["Khaki + burgundy", "#6d1f2b", null, "#3b2a20", "Warm and autumnal."],
      ],
    },
    gray: {
      ref: "#9a9c9e",
      pairs: [
        ["Gray + white", "#f4f2ec", null, "#f4f2ec", "Minimal and clean."],
        ["Gray + navy", "#1f2a44", null, "#1c1c1e", "Cool and polished."],
        ["Gray + black", "#1c1c1e", null, "#1c1c1e", "Monochrome and sharp."],
        ["Gray + burgundy accent", "#f4f2ec", "#6d1f2b", "#3b2a20", "Gray lets a rich accent stand out."],
        ["Gray + olive", "#5b6236", null, "#1c1c1e", "Muted green warms up gray."],
      ],
    },
    charcoal: {
      ref: "#3a3d40",
      pairs: [
        ["Charcoal + white", "#f4f2ec", null, "#1c1c1e", "High contrast, formal."],
        ["Charcoal + light blue", "#a9c4e0", null, "#1c1c1e", "Classic business colors."],
        ["Charcoal + camel", "#b08a5a", null, "#5c4033", "Warm against cool. Rich in winter."],
        ["Charcoal + burgundy accent", "#c9c9c4", "#6d1f2b", "#1c1c1e", "A deep accent on a dark base."],
      ],
    },
    denim: {
      ref: "#3d5a80",
      pairs: [
        ["Denim + white", "#f4f2ec", null, "#f4f2ec", "The casual uniform."],
        ["Denim + gray", "#9a9c9e", null, "#1c1c1e", "Easy and cool-toned."],
        ["Denim + olive", "#5b6236", null, "#5c4033", "Workwear: blue and green with brown boots."],
        ["Denim + rust accent", "#e9e1cc", "#a4472c", "#5c4033", "Orange is blue’s complement; rust keeps it earthy."],
        ["Denim + cream", "#e9e1cc", null, "#a0784f", "Softer than white, still fresh."],
      ],
    },
    brown: {
      ref: "#5c4033",
      pairs: [
        ["Brown + cream", "#e9e1cc", null, "#3b2a20", "Warm and tonal."],
        ["Brown + light blue", "#a9c4e0", null, "#3b2a20", "Blue cools down brown."],
        ["Brown + olive", "#5b6236", null, "#3b2a20", "Earth tones, outdoorsy."],
        ["Brown + navy", "#1f2a44", null, "#3b2a20", "Rich and classic."],
      ],
    },
    black: {
      ref: "#1c1c1e",
      pairs: [
        ["Black + white", "#f4f2ec", null, "#1c1c1e", "Maximum contrast."],
        ["Black + gray", "#9a9c9e", null, "#1c1c1e", "Monochrome, softer."],
        ["Black + olive", "#5b6236", null, "#1c1c1e", "Utilitarian."],
        ["Black + camel", "#b08a5a", null, "#5c4033", "Warm luxury."],
      ],
    },
    white: {
      ref: "#f4f2ec",
      pairs: [
        ["White + navy", "#1f2a44", null, "#5c4033", "Nautical and clean."],
        ["White + olive", "#5b6236", null, "#5c4033", "Fresh and earthy."],
        ["White + khaki", "#c3b091", null, "#a0784f", "Light and summery."],
        ["White + denim", "#3d5a80", null, "#f4f2ec", "The casual uniform."],
        ["White + black", "#1c1c1e", null, "#1c1c1e", "Graphic and sharp."],
      ],
    },
  };

  function oklabDistance(a, b) {
    const p = hexToOklch(a);
    const q = hexToOklch(b);
    const toAB = (c) => [c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
    const [pa, pb] = toAB(p);
    const [qa, qb] = toAB(q);
    return Math.hypot(p.l - q.l, pa - qa, pb - qb);
  }

  function familyOf(hex) {
    let best = null;
    Object.entries(PAIRINGS).forEach(([name, family]) => {
      const d = oklabDistance(hex, family.ref);
      if (d < 0.11 && (!best || d < best.d)) best = { name, d };
    });
    return best ? best.name : null;
  }

  function anchorIndex(pieces) {
    return pieces.reduce((best, p, i) => (p.share > pieces[best].share ? i : best), 0);
  }

  // Move lightness away from the anchor so neighbors stay distinguishable.
  const awayFrom = (v) => (v > 0.55 ? v * 0.45 : Math.min(0.93, v + 0.45));

  function scoreOf(analysis) {
    return analysis.notes.reduce((sum, n) => sum + (n.level === "good" ? 1 : n.level === "warn" ? -2 : 0), 0);
  }

  // Build complete palettes around the anchor (largest piece). Locked pieces keep their color.
  function suggestOutfits(pieces, options = {}) {
    if (!pieces.length) return [];
    const locked = new Set(options.locked || []);
    const variant = options.variant || 0;
    const pick = (list, k = 0) => list[(variant + k) % list.length];

    const anchorAt = anchorIndex(pieces);
    const anchorHex = pieces[anchorAt].hex;
    const A = hexToHsv(anchorHex);
    const AL = hexToOklch(anchorHex);
    const neutralAnchor = AL.c < NEUTRAL_CHROMA;
    const base = neutralAnchor ? hexToHsv(pick(PARTNER_COLORS)) : A;
    const baseS = Math.max(base.s, 0.3);
    const muted = (h, sMul, v) => hsvToHex({ h, s: clamp(baseS * sMul, 0.08, 0.7), v: clamp(v, 0.14, 0.94) });
    const far = awayFrom(A.v);
    const mid = (A.v + far) / 2;
    const contrastNeutral = (k = 0) => (AL.l > 0.6 ? pick(DARK_NEUTRALS, k) : pick(LIGHT_NEUTRALS, k));
    const casual = pieces.some((p) => CASUAL.includes(p.garment));
    const grayAnchor = neutralAnchor && AL.l < 0.45;

    const order = pieces.map((_, i) => i).sort((a, b) => pieces[b].share - pieces[a].share || a - b);
    const clothing = order.filter((i) => i !== anchorAt && !FOOT_SLOTS.includes(garment(pieces[i].garment).slot));
    const second = clothing[0];
    const rest = clothing.slice(1);
    const shoes = order.find((i) => garment(pieces[i].garment).slot === "shoes");

    const complement = hsvToHex({ h: base.h + 180, s: clamp(Math.max(baseS, 0.45), 0, 0.68), v: 0.62 });
    const strategies = [
      {
        name: "Neutral partner",
        text: "Anchor plus a contrasting neutral. The safest good look.",
        second: () => contrastNeutral(0),
        rest: (k) => pick(MID_NEUTRALS, k),
        leather: casual ? pick([LEATHER.white, LEATHER.brown]) : grayAnchor ? LEATHER.black : LEATHER.brown,
      },
      {
        name: "Tonal",
        text: "One hue at different lightness. Quiet and expensive-looking.",
        second: () => muted(base.h, 0.55, neutralAnchor ? 0.5 : far),
        rest: () => muted(base.h, 0.35, mid),
        leather: grayAnchor ? LEATHER.black : LEATHER.dark,
      },
      {
        name: "Analogous",
        text: "Neighboring hues, softened. Relaxed and cohesive.",
        second: () => muted(base.h + 30, 0.65, neutralAnchor ? 0.5 : far),
        rest: () => muted(base.h - 30, 0.55, mid),
        leather: LEATHER.tan,
      },
      {
        name: "Complementary accent",
        text: "Neutral support with a small pop opposite the anchor.",
        second: () => (clothing.length > 1 || shoes !== undefined ? contrastNeutral(1) : muted(base.h + 180, 0.5, far)),
        rest: (k, isAccent) => (isAccent ? complement : pick(MID_NEUTRALS, k)),
        leather: LEATHER.brown,
        accentShoes: rest.length === 0,
      },
      {
        name: "Split complementary",
        text: "Two muted hues flanking the anchor’s opposite. Lively but balanced.",
        second: () => muted(base.h + 150, 0.45, neutralAnchor ? 0.5 : far),
        rest: () => muted(base.h + 210, 0.5, mid),
        leather: casual ? LEATHER.white : LEATHER.dark,
      },
    ];

    const family = familyOf(anchorHex);
    const pairs = family ? PAIRINGS[family].pairs : [];
    const curated = [0, 1, 2]
      .filter((k) => k < pairs.length)
      .map((k) => pairs[(variant * 3 + k) % pairs.length])
      .map(([name, support, accent, shoe, why]) => ({
        name,
        text: why,
        proven: true,
        second: () => support,
        rest: (k, isAccent) => (isAccent && accent ? accent : k === 0 && !accent ? support : pick(MID_NEUTRALS, k)),
        leather: shoe,
        accentShoes: Boolean(accent) && rest.length === 0,
        accentColor: accent,
      }));

    const seen = new Set();
    const ideas = [];
    [...curated, ...strategies].forEach((strategy) => {
      const hexes = pieces.map((p) => p.hex);
      const set = (i, hex) => {
        if (i !== undefined && i !== anchorAt && !locked.has(i)) hexes[i] = hex;
      };
      set(second, strategy.second());
      rest.forEach((i, k) => set(i, strategy.rest(k, k === rest.length - 1)));
      const shoeColor = strategy.accentShoes && shoes !== undefined ? strategy.accentColor || complement : strategy.leather;
      order.forEach((i) => {
        if (garment(pieces[i].garment).slot === "shoes") set(i, shoeColor);
      });
      const firstShoe = shoes === undefined ? null : hexes[shoes];
      const bottom = order.find((i) => garment(pieces[i].garment).slot === "bottom");
      order.forEach((i) => {
        const g = pieces[i].garment;
        if (g === "belt") set(i, firstShoe && firstShoe !== LEATHER.white && colorRole(firstShoe) !== "loud" ? firstShoe : LEATHER.brown);
        if (g === "socks") set(i, bottom !== undefined && pieces[bottom].garment !== "shorts" ? hexes[bottom] : firstShoe || LEATHER.white);
      });
      const key = hexes.join(",");
      if (seen.has(key) || hexes.every((hex, i) => hex === pieces[i].hex)) return;
      seen.add(key);
      const analysis = analyzeOutfit(pieces.map((p, i) => ({ label: garment(p.garment).label, hex: hexes[i], share: p.share })));
      ideas.push({ name: strategy.name, text: strategy.text, proven: Boolean(strategy.proven), hexes, scheme: analysis.scheme, score: scoreOf(analysis) });
    });
    const theory = ideas
      .filter((idea) => !idea.proven)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6 - ideas.filter((idea) => idea.proven).length);
    return ideas.filter((idea) => idea.proven || theory.includes(idea));
  }

  root.OutfitColor = {
    anchorIndex,
    familyOf,
    suggestOutfits,
    clamp,
    wrapHue,
    hueDistance,
    hexToRgb,
    rgbToHex,
    normalizeHex,
    rgbToHsv,
    hsvToRgb,
    hexToHsv,
    hsvToHex,
    hexToOklch,
    colorRole,
    GARMENTS,
    garment,
    toPercentages,
    garmentWeights,
    defaultShares,
    setShare,
    moveBoundary,
    harmonyHues,
    harmonySuggestions,
    classifyScheme,
    analyzeOutfit,
    encodeOutfit,
    decodeOutfit,
  };
})(typeof window !== "undefined" ? window : globalThis);
