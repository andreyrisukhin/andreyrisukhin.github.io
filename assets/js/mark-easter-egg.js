// Navbar mark easter egg: hovering the logo animates the same seven dots
// differently in each part of the site. `?mark=<name>` previews any variant.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.init(root.document);
})(typeof window !== "undefined" ? window : globalThis, function () {
  const NS = "http://www.w3.org/2000/svg";
  const TAU = Math.PI * 2;
  const C = 16;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const rad = (deg) => (deg * Math.PI) / 180;
  const polar = (a, r) => ({ x: C + r * Math.cos(a), y: C + r * Math.sin(a) });
  const angleOf = (d) => Math.atan2(d.y - C, d.x - C);
  const radiusOf = (d) => Math.hypot(d.x - C, d.y - C);

  // Mirrors _includes/dot-mark.liquid: rows of 2, 3, 2; f is fill (1 filled, 0 open).
  const REST = [
    [11, 7, 1],
    [21, 7, 0],
    [6, 16, 0],
    [16, 16, 1],
    [26, 16, 1],
    [11, 25, 1],
    [21, 25, 0],
  ].map(([x, y, f]) => ({ x, y, r: 3.6, f, sw: 1.7 }));
  const CENTER = 3;
  // Outer dots, clockwise from top left.
  const RING = [0, 1, 4, 6, 5, 2];
  const at = (overrides) => REST.map((d, i) => Object.assign({}, d, overrides ? overrides(d, i) : null));

  function add(parent, tag, attrs) {
    const el = parent.ownerDocument.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el);
    return el;
  }

  function placeOnEllipse(el, rx, ry, tiltDeg, a) {
    const t = rad(tiltDeg);
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    el.setAttribute("cx", (C + x * Math.cos(t) - y * Math.sin(t)).toFixed(2));
    el.setAttribute("cy", (C + x * Math.sin(t) + y * Math.cos(t)).toFixed(2));
  }

  // Hex Life on the seven cells: ring cells see the centre and their two ring neighbours.
  const NEIGHBOURS = REST.map((_, i) => {
    if (i === CENTER) return RING.slice();
    const j = RING.indexOf(i);
    return [CENTER, RING[(j + 1) % 6], RING[(j + 5) % 6]];
  });

  function lifeGenerations(count) {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const gens = [REST.map((d) => d.f)];
    while (gens.length < count) {
      const s = gens[gens.length - 1];
      let next = s.map((alive, i) => {
        const n = NEIGHBOURS[i].reduce((sum, k) => sum + s[k], 0);
        return alive ? (n === 1 || n === 2 ? 1 : 0) : n === 2 ? 1 : 0;
      });
      const key = next.join("");
      const stale = gens.slice(-4).some((g) => g.join("") === key);
      const dead = next.every((v) => !v);
      if (stale || dead) next = next.map(() => (random() < 0.45 ? 1 : 0));
      gens.push(next);
    }
    return gens;
  }

  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  const VARIANTS = {
    // Be-7: four protons (filled) and three neutrons (open) close into a
    // nucleus; 1s² and 2s² electrons circle on tilted shells.
    atom: {
      setup(g) {
        const shell = (rx, ry, tilt) =>
          add(g, "ellipse", {
            cx: C,
            cy: C,
            rx,
            ry,
            transform: `rotate(${tilt} ${C} ${C})`,
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 0.9,
            opacity: 0.45,
          });
        shell(9.5, 3.8, -35);
        shell(14.5, 5.4, 40);
        return { e: [0, 1, 2, 3].map(() => add(g, "circle", { r: 1.9, fill: "currentColor" })) };
      },
      frame(t, { e }) {
        const a1 = (t / 900) * TAU;
        const a2 = (t / 1500) * TAU;
        placeOnEllipse(e[0], 9.5, 3.8, -35, a1);
        placeOnEllipse(e[1], 9.5, 3.8, -35, a1 + Math.PI);
        placeOnEllipse(e[2], 14.5, 5.4, 40, a2);
        placeOnEllipse(e[3], 14.5, 5.4, 40, a2 + Math.PI);
        const k = easeInOut(clamp(t / 380));
        return at((d) => ({
          x: lerp(d.x, C + (d.x - C) * 0.28, k),
          y: lerp(d.y, C + (d.y - C) * 0.28, k),
          r: lerp(3.6, 1.9, k),
          sw: lerp(1.7, 1, k),
          f: lerp(d.f, d.f ? 1 : 0.35, k),
        }));
      },
    },

    // Bayan: oom-pah on the buttons, a bass note then a chord pair.
    bayan: {
      frame(t) {
        const STEP = 190;
        const PATTERN = [[3], [0, 1], [2], [0, 1], [4], [5, 6], [3], [5, 6]];
        const pressed = PATTERN[Math.floor(t / STEP) % PATTERN.length];
        const u = t % STEP;
        const p = u < 40 ? u / 40 : u < 130 ? 1 : 1 - clamp((u - 130) / 60);
        return at((d, i) => (pressed.includes(i) ? { r: 3.6 - 0.8 * p, f: lerp(d.f, 1 - d.f, p) } : null));
      },
    },

    // Leviathans: the outer ring turns one hex face at a time around the centre.
    hex: {
      frame(t) {
        const PERIOD = 700;
        const MOVE = 340;
        const s = Math.floor(t / PERIOD);
        const u = easeInOut(clamp((t % PERIOD) / MOVE));
        const out = at();
        RING.forEach((idx, j) => {
          const a = REST[RING[(j + s) % 6]];
          const b = REST[RING[(j + s + 1) % 6]];
          const a0 = angleOf(a);
          let a1 = angleOf(b);
          while (a1 < a0) a1 += TAU;
          const p = polar(lerp(a0, a1, u), lerp(radiusOf(a), radiusOf(b), u));
          out[idx].x = p.x;
          out[idx].y = p.y;
        });
        out[CENTER].r = 3.6 - 0.6 * Math.sin(Math.PI * u);
        return out;
      },
    },

    // Ditherer: a soft wave sweeps across and each dot snaps on or off at its
    // ordered-dither (Bayer) threshold, in coarse frames like pixels.
    dither: {
      frame(t) {
        const q = Math.floor(t / 90) * 90;
        return at((d) => {
          const col = (d.x - 6) / 5;
          const row = (d.y - 7) / 9;
          const level = 0.5 + 0.5 * Math.sin((TAU * q) / 1600 - col * 0.9);
          return { f: level > (BAYER4[row % 4][col % 4] + 0.5) / 16 ? 1 : 0 };
        });
      },
    },

    // LEGO: a brick presses down row by row, clicks onto the studs, lifts off.
    lego: {
      frame(t) {
        const T = t % 1700;
        return at((d) => {
          const start = ((d.y - 7) / 9) * 110;
          let p = 0;
          if (T >= start && T < 1100) p = easeOut(clamp((T - start) / 70));
          else if (T >= 1100) p = 1 - easeInOut(clamp((T - 1100) / 180));
          return { y: d.y + 1.2 * p, r: 3.6 - 0.4 * p, f: lerp(d.f, 1, p) };
        });
      },
    },

    // Orrery: filled dots move out to a ring, open dots gather inside, the
    // rings counter-rotate (outer once, inner twice), and everything returns.
    orrery: {
      frame(t) {
        const OUT = 420;
        const SPIN = 2600;
        const BACK = 420;
        const HOLD = 360;
        const T = t % (OUT + SPIN + BACK + HOLD);
        let k = 0;
        let spin = 1;
        if (T < OUT) {
          k = easeInOut(T / OUT);
          spin = 0;
        } else if (T < OUT + SPIN) {
          k = 1;
          spin = easeInOut((T - OUT) / SPIN);
        } else if (T < OUT + SPIN + BACK) {
          k = 1 - easeInOut((T - OUT - SPIN) / BACK);
        }
        const OUTER = { 3: -90, 4: 0, 5: 90, 0: 180 };
        const INNER = { 1: -60, 6: 60, 2: 180 };
        return at((d, i) => {
          const outer = i in OUTER;
          const a = rad(outer ? OUTER[i] : INNER[i]) + (outer ? TAU : -2 * TAU) * spin;
          const p = polar(a, outer ? 12.5 : 5.2);
          return { x: lerp(d.x, p.x, k), y: lerp(d.y, p.y, k), r: lerp(3.6, outer ? 3.1 : 2.6, k) };
        });
      },
    },

    // Fireplace: every dot glows like a coal and sparks drift up.
    embers: {
      setup(g) {
        return { s: [0, 1, 2].map(() => add(g, "circle", { r: 1.1, fill: "currentColor" })) };
      },
      frame(t, { s }) {
        s.forEach((el, j) => {
          const u = ((t + j * 370) % 1100) / 1100;
          el.setAttribute("cx", (11 + j * 5 + Math.sin(u * TAU * 1.5 + j) * 1.2).toFixed(2));
          el.setAttribute("cy", (4 - 12 * u).toFixed(2));
          el.setAttribute("r", (1.1 * (1 - 0.5 * u)).toFixed(2));
          el.setAttribute("opacity", Math.sin(Math.PI * u).toFixed(2));
        });
        return at((d, i) => ({
          f: clamp(0.6 + 0.4 * (0.6 * Math.sin(t / 170 + i * 1.7) + 0.4 * Math.sin(t / 97 + i * 2.9))),
        }));
      },
    },

    // Terrarium: hex Life on the seven cells, reseeding when it settles.
    life: {
      setup() {
        return { gens: lifeGenerations(32) };
      },
      frame(t, { gens }) {
        const GEN = 320;
        const n = Math.floor(t / GEN);
        const prev = gens[Math.max(0, n - 1) % gens.length];
        const cur = gens[n % gens.length];
        const u = easeInOut(clamp((t % GEN) / 140));
        return at((d, i) => {
          const a = lerp(prev[i], cur[i], u);
          return { f: a, r: lerp(2.4, 3.6, a) };
        });
      },
    },

    // Trails: footsteps walk a winding path and fade behind the walker.
    trail: {
      frame(t) {
        const PATH = [5, 2, 3, 0, 1, 4, 6];
        const L = PATH.length + 2;
        const n = (t / 230) % L;
        return at((d, i) => {
          let age = n - PATH.indexOf(i);
          if (age < 0) age += L;
          const lift = age < 1 ? Math.sin(Math.PI * age) : 0;
          return { f: Math.max(0, 1 - age / 3), r: 3.6 - 0.5 * lift };
        });
      },
    },

    // Books: the mark turns like a page; its back is the mirrored negative.
    pages: {
      frame(t) {
        const n = Math.floor(t / 1100);
        const u = easeInOut(clamp((t % 1100) / 520));
        const c = Math.cos((n + u) * Math.PI);
        return at((d) => ({
          x: C + (d.x - C) * c,
          f: c < 0 ? 1 - d.f : d.f,
          r: 3.6 * (0.75 + 0.25 * Math.abs(c)),
        }));
      },
    },

    // 404: the dots wander off and find their way back.
    lost: {
      frame(t) {
        const amp = 3.5 * Math.pow(Math.sin((Math.PI * (t % 2400)) / 2400), 2);
        return at((d, i) => ({
          x: d.x + amp * Math.sin(t / 610 + i * 2.1),
          y: d.y + amp * Math.cos(t / 530 + i * 1.3),
        }));
      },
    },
  };

  // Longest matching prefix wins; a trailing "$" means an exact match.
  const ROUTES = [
    ["/$", "atom"],
    ["/publications/", "atom"],
    ["/cv/", "atom"],
    ["/teaching/", "atom"],
    ["/projects/", "atom"],
    ["/repositories/", "atom"],
    ["/people/", "atom"],
    ["/news/", "atom"],
    ["/music/", "bayan"],
    ["/chess/", "hex"],
    ["/kata/", "hex"],
    ["/ditherer/", "dither"],
    ["/color/", "dither"],
    ["/lego/", "lego"],
    ["/projects/lego/", "lego"],
    ["/blog/$", "orrery"],
    ["/fireplace/", "embers"],
    ["/terrarium/", "life"],
    ["/trails/", "trail"],
    ["/books/", "pages"],
    ["/404.html$", "lost"],
  ];
  // Pages without a theme (posts, demos) get a stable pick from these.
  const WANDERERS = ["orrery", "atom", "bayan", "hex", "dither", "lego", "embers", "life", "trail", "pages"];

  function pickVariant(path, forced) {
    if (forced && VARIANTS[forced]) return forced;
    let best = null;
    let bestLen = -1;
    for (const [pattern, name] of ROUTES) {
      const exact = pattern.endsWith("$");
      const prefix = exact ? pattern.slice(0, -1) : pattern;
      const hit = exact ? path === prefix : path.startsWith(prefix);
      if (hit && prefix.length > bestLen) {
        best = name;
        bestLen = prefix.length;
      }
    }
    if (best) return best;
    let h = 0;
    for (const ch of path) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return WANDERERS[h % WANDERERS.length];
  }

  function blend(a, b, k) {
    return a.map((s, i) => {
      const e = b[i];
      return { x: lerp(s.x, e.x, k), y: lerp(s.y, e.y, k), r: lerp(s.r, e.r, k), f: lerp(s.f, e.f, k), sw: lerp(s.sw, e.sw, k) };
    });
  }

  function init(doc) {
    const svg = doc && doc.querySelector(".navbar-brand .dot-mark");
    const link = svg && svg.closest(".navbar-brand");
    const dots = svg ? Array.from(svg.querySelectorAll("circle")) : [];
    if (!link || dots.length !== REST.length) return;
    const win = doc.defaultView;
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    const forced = new URLSearchParams(win.location.search).get("mark");
    const name = pickVariant(svg.getAttribute("data-mark-page") || win.location.pathname, forced);
    const variant = VARIANTS[name];
    svg.setAttribute("data-mark-variant", name);
    const original = dots.map((c) => c.getAttribute("fill"));

    let mode = "idle";
    let raf = 0;
    let t0 = 0;
    let exitStart = 0;
    let from = at();
    let current = at();
    let extra = null;
    let extraOpacity = 0;
    let extraFrom = 0;
    let ctx = null;

    function render(states) {
      states.forEach((s, i) => {
        const c = dots[i];
        c.setAttribute("cx", s.x.toFixed(2));
        c.setAttribute("cy", s.y.toFixed(2));
        c.setAttribute("r", s.r.toFixed(2));
        c.setAttribute("fill-opacity", s.f.toFixed(2));
        c.setAttribute("stroke-width", s.sw.toFixed(2));
      });
      current = states;
    }

    function setExtraOpacity(o) {
      extraOpacity = o;
      if (extra) extra.setAttribute("opacity", o.toFixed(2));
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      mode = "idle";
      dots.forEach((c, i) => {
        c.setAttribute("cx", REST[i].x);
        c.setAttribute("cy", REST[i].y);
        c.setAttribute("r", REST[i].r);
        c.setAttribute("fill", original[i]);
        c.removeAttribute("fill-opacity");
        c.removeAttribute("stroke-width");
      });
      current = at();
      if (extra) extra.remove();
      extra = null;
      ctx = null;
      extraOpacity = 0;
    }

    function tick(now) {
      const t = now - t0;
      if (mode === "play") {
        let s = variant.frame(t, ctx);
        if (t < 200) s = blend(from, s, easeOut(t / 200));
        setExtraOpacity(lerp(extraFrom, 1, clamp(t / 250)));
        render(s);
      } else {
        const k = clamp((now - exitStart) / 260);
        variant.frame(t, ctx);
        render(blend(from, REST, easeOut(k)));
        setExtraOpacity(extraFrom * (1 - k));
        if (k >= 1) return stop();
      }
      raf = win.requestAnimationFrame(tick);
    }

    function start() {
      if (reduced.matches || mode === "play") return;
      if (mode === "idle") {
        dots.forEach((c) => c.setAttribute("fill", "currentColor"));
        extra = add(svg, "g", { class: "dot-mark__extra", opacity: 0 });
        ctx = variant.setup ? variant.setup(extra) : null;
      }
      from = current;
      extraFrom = extraOpacity;
      mode = "play";
      t0 = win.performance.now();
      if (!raf) raf = win.requestAnimationFrame(tick);
    }

    function leave() {
      if (mode !== "play") return;
      mode = "exit";
      from = current;
      extraFrom = extraOpacity;
      exitStart = win.performance.now();
    }

    link.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch") start();
    });
    link.addEventListener("pointerleave", leave);
    link.addEventListener("focus", () => {
      if (link.matches(":focus-visible")) start();
    });
    link.addEventListener("blur", leave);
    reduced.addEventListener("change", () => reduced.matches && mode !== "idle" && stop());
  }

  return { REST, VARIANTS, ROUTES, pickVariant, init, lifeGenerations };
});
