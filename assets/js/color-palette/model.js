// Pure palette generation, shared by the selector, saved website theme, and tests.
(function (root) {
  const schemes = {
    analogous: { label: "Analogous", offsets: [0, -30, 30], note: "Neighboring hues keep the colors close." },
    complementary: { label: "Complementary", offsets: [0, 180, 30], note: "Opposite hues give a quiet base a contrasting accent." },
    split: { label: "Split complementary", offsets: [0, 150, 210], note: "Two neighbors of the opposite hue soften the contrast." },
    triadic: { label: "Triadic", offsets: [0, 120, 240], note: "Three evenly spaced hues, balanced with pale paper and dark ink." },
  };
  function normalize(hex) {
    const value = String(hex || "")
      .trim()
      .toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(value)) return "#" + [...value.slice(1)].map((c) => c + c).join("");
    return /^#[0-9a-f]{6}$/.test(value) ? value : null;
  }
  function hue(hex) {
    const [r, g, b] = hex
      .slice(1)
      .match(/../g)
      .map((c) => parseInt(c, 16) / 255);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    if (!d) return 30;
    return ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, "0");
    };
    return "#" + channel(0) + channel(8) + channel(4);
  }
  function luminance(hex) {
    return hex
      .slice(1)
      .match(/../g)
      .map((c) => {
        const v = parseInt(c, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrast(a, b) {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function make(seed, scheme = "analogous", turn = 0) {
    seed = normalize(seed);
    if (!seed || !Object.hasOwn(schemes, scheme) || !Number.isInteger(turn) || turn < 0 || turn > 3) return null;
    const h = hue(seed) + turn * 15;
    const [base, companion, highlight] = schemes[scheme].offsets.map((offset) => h + offset);
    function theme(dark) {
      const canvas = hsl(base, 0.24, dark ? 0.11 : 0.97);
      const surface = hsl(companion, 0.28, dark ? 0.15 : 0.985);
      const codeBg = hsl(highlight, 0.22, dark ? 0.18 : 0.92);
      let mutedLightness = dark ? 0.72 : 0.38;
      let muted = hsl(base, 0.1, mutedLightness);
      while ([canvas, surface, codeBg].some((background) => contrast(muted, background) < 4.5)) {
        mutedLightness += dark ? 0.01 : -0.01;
        muted = hsl(base, 0.1, mutedLightness);
      }
      const onAccent = dark ? "#141414" : "#ffffff";
      let l = dark ? 0.7 : 0.36;
      let accent = hsl(base, 0.42, l);
      while (contrast(accent, canvas) < 4.5 || contrast(accent, surface) < 4.5 || contrast(accent, onAccent) < 4.5) {
        l += dark ? 0.01 : -0.01;
        accent = hsl(base, 0.42, l);
      }
      return {
        canvas,
        surface,
        text: hsl(base, 0.15, dark ? 0.92 : 0.14),
        "text-muted": muted,
        accent,
        "accent-hover": hsl(base, 0.42, l + (dark ? 0.07 : -0.07)),
        "on-accent": onAccent,
        border: hsl(base, 0.12, dark ? 0.4 : 0.68),
        "code-bg": codeBg,
      };
    }
    return { seed, scheme, turn, light: theme(false), dark: theme(true), colors: [seed, hsl(companion, 0.38, 0.52), hsl(highlight, 0.44, 0.72)] };
  }
  root.SitePaletteModel = { schemes, normalize, contrast, make };
})(typeof window === "undefined" ? globalThis : window);
