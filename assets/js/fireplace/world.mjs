// Physical things in the scene: logs, sticks, and crumpled paper as capsules
// (rods with a radius), simulated with position-based dynamics. Each rod is two
// Verlet particles joined by a distance constraint, so logs tip, roll off one
// another, and slide to rest under gravity and friction.
import {
  BOARDS,
  CANDLE_FLAME,
  DEPTH_LIFT,
  GRATE,
  HEARTH,
  ROOM_DEPTH,
  ROOM_FLOOR,
  RUG,
  SCENE,
  SHELF,
  archTopAt,
  boardAt,
  clamp,
  floorAt,
  hash,
  insideOpening,
  screenY,
  shelfTop,
} from "./scene.mjs";

export const MATERIALS = Object.freeze({
  // ignite: temperature where wood catches; out: where a flame dies. sustain: the heat a
  // burning piece gives itself. A log's own flame is not enough to keep it alight, so a
  // lone log goes out unless other burning wood or embers keep it hot.
  log: {
    radius: 6.5,
    length: 80,
    weight: 1,
    ignite: 0.42,
    out: 0.3,
    sustain: 0.2,
    conduct: 0.12,
    convect: 0.4,
    warm: 0.14,
    burn: 600,
    char: 120,
    flame: 1,
    embers: 1,
    friction: 1,
  },
  stick: {
    radius: 1.8,
    length: 34,
    weight: 0.08,
    ignite: 0.26,
    out: 0.2,
    sustain: 0.55,
    conduct: 0.8,
    convect: 0.9,
    warm: 0.8,
    burn: 50,
    char: 12,
    flame: 0.62,
    embers: 0.2,
    friction: 0.9,
  },
  paper: {
    radius: 6,
    length: 2,
    weight: 0.012,
    ignite: 0.12,
    out: 0.08,
    sustain: 1,
    conduct: 4,
    convect: 1,
    warm: 4,
    burn: 14,
    char: 4,
    flame: 0.9,
    embers: 0.02,
    friction: 0.7,
  },
  // Tightly bound pages: slow to catch, and a match alone only scorches a cover.
  book: {
    radius: 2.5,
    length: 40,
    weight: 1,
    ignite: 0.5,
    out: 0.25,
    sustain: 0.7,
    conduct: 0.5,
    convect: 0.8,
    warm: 0.22,
    burn: 90,
    char: 30,
    flame: 0.75,
    embers: 0,
    friction: 1,
  },
});

// Floorboards are harder to light than a log, and each patch only keeps burning
// with burning neighbors or wood lying on it. Fire passed board to board weakens
// (spread), so a floor fire runs a few boards out and dies, leaving char.
// touch: how fast a board warms under burning or glowing wood resting on it.
export const BOARD = Object.freeze({ ignite: 0.72, out: 0.3, sustain: 0.3, warm: 0.09, touch: 0.18, burn: 40, spread: 0.75, singe: 0.4 });
// Wool singes at a lower heat than wood, catches sooner, and carries fire across itself further.
export const RUG_PATCH = Object.freeze({ ignite: 0.55, out: 0.25, sustain: 0.3, warm: 0.14, touch: 0.25, burn: 18, spread: 0.92, singe: 0.28 });

// The stack on the mantel, bottom to top, in screen pixels.
const BOOKS = [
  { left: 296, right: 338, y: 75.5 },
  { left: 298, right: 334, y: 70.5 },
  { left: 293, right: 333, y: 65.5 },
  { left: 298, right: 332, y: 60.5 },
];
const BOOK_Z = -12;
const DROP_LIMIT = 220;
const STEAM_LIMIT = 160;

export const SUPPLIES = Object.freeze({
  stick: { x: 68, y: 208, width: 44, height: 58 },
  paper: { x: 408, y: 278, width: 44, height: 18 },
});

export const EMBER_COLUMNS = (HEARTH.right - HEARTH.left) / 2;
export const STEP = 1 / 24;
const SUBSTEPS = 4;
const ITERATIONS = 3;
const GRAVITY = 1400;
const MAX_HEARTH_ITEMS = 40;
const MAX_ITEMS = 60;
const SPARK_LIMIT = 240;
const RADIANT_REACH = 12;
// Wood burns in short sections, so a flame creeps along a log instead of lighting all of it at once.
const SEGMENT = 8;
// Bark is dense and corky: it takes more heat to light and warms slowly. Burning chars it
// and flakes it off (seconds at full flame), exposing the inner wood, which burns freely.
const BARK_LAYER = Object.freeze({ shield: 0.1, slow: 0.35, seconds: 45 });
const PILE = [
  { x: 52, z: -70 },
  { x: 60, z: -110 },
];

const particle = ({ x, y, z }) => ({ x, y, z, px: x, py: y, pz: z, contact: false, impact: 0 });
const lerp = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const length3 = (a) => Math.hypot(a.x, a.y, a.z);
const motion = (p) => ({ x: p.x - p.px, y: p.y - p.py, z: p.z - p.pz });

// Closest points between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection 5.1.9).
export function closestParams(p1, q1, p2, q2) {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  if (a <= 1e-9 && e <= 1e-9) return [0, 0];
  if (a <= 1e-9) return [0, clamp(f / e, 0, 1)];
  const c = dot(d1, r);
  if (e <= 1e-9) return [clamp(-c / a, 0, 1), 0];
  const b = dot(d1, d2);
  const denom = a * e - b * b;
  let s = denom > 1e-9 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp(-c / a, 0, 1);
  } else if (t > 1) {
    t = 1;
    s = clamp((b - c) / a, 0, 1);
  }
  return [s, t];
}

export const segmentAt = (item, s) => clamp(Math.floor(s * item.heat.length), 0, item.heat.length - 1);

export function segmentFlame(item, k) {
  const fire = item.fire[k];
  if (!fire) return 0;
  return MATERIALS[item.kind].flame * Math.sqrt(Math.max(0, item.mass)) * (1 - 0.45 * item.chars[k] ** 2) * fire;
}

export function flameStrength(item) {
  if (!item.burning) return 0;
  let sum = 0;
  for (let k = 0; k < item.fire.length; k++) sum += segmentFlame(item, k);
  return sum / item.fire.length;
}

function summarize(item) {
  let fire = 0;
  let heat = 0;
  let char = 0;
  for (let k = 0; k < item.heat.length; k++) {
    fire += item.fire[k];
    heat = Math.max(heat, item.heat[k]);
    char += item.chars[k];
  }
  item.burning = fire > 0;
  item.temp = heat;
  item.char = char / item.heat.length;
  return fire / item.heat.length;
}

const centerOf = (item, k) => lerp(item.a, item.b, (k + 0.5) / item.heat.length);

export const inHearth = (item) => (item.a.z + item.b.z) / 2 >= 0;

export class World {
  constructor(options, random) {
    this.options = options;
    this.random = random;
    this.items = [];
    this.sparks = [];
    this.impacts = [];
    this.contacts = [];
    this.embers = new Float32Array(EMBER_COLUMNS);
    this.ash = new Float32Array(EMBER_COLUMNS);
    this.grab = null;
    this.match = null;
    this.ids = 0;
    this.spareTimer = 0;
    this.statics = [];
    this.fixtures = [];
    this.drops = [];
    this.steam = [];
    this.events = [];
    this.pourCarry = 0;
    const patches = BOARDS.cols * BOARDS.rows;
    this.boards = {
      heat: new Float32Array(patches),
      fire: new Float32Array(patches),
      fuel: new Float32Array(patches).fill(1),
      char: new Float32Array(patches),
      vigor: new Float32Array(patches),
      contact: new Float32Array(patches),
      wet: new Float32Array(patches),
      rug: new Uint8Array(patches),
    };
    for (let row = RUG.row0; row <= RUG.row1; row++) for (let col = RUG.col0; col <= RUG.col1; col++) this.boards.rug[row * BOARDS.cols + col] = 1;
    const bottom = HEARTH.floor - GRATE.radius;
    const bar = (a, b) => this.statics.push({ kind: "iron", static: true, a, b, r: GRATE.radius, length: length3(sub(a, b)) });
    for (let x = GRATE.left; x <= GRATE.right + 0.1; x += GRATE.spacing) bar({ x, y: bottom, z: GRATE.z }, { x, y: GRATE.top, z: GRATE.z });
    for (const y of [GRATE.top, GRATE.top + 9]) bar({ x: GRATE.left, y, z: GRATE.z }, { x: GRATE.right, y, z: GRATE.z });
    // Books never move: they are fixed in place, and only fire reaching them can light them.
    BOOKS.forEach((book, n) => {
      const r = MATERIALS.book.radius;
      const y = book.y + BOOK_Z * DEPTH_LIFT;
      const item = this.make("book", { x: book.left + r, y, z: BOOK_Z }, { x: book.right - r, y, z: BOOK_Z }, { asleep: true, id: -1 - n });
      item.static = true;
      this.fixtures.push(item);
    });
  }

  spawn(kind, a, b, state = {}) {
    const item = this.make(kind, a, b, state);
    this.items.push(item);
    return item;
  }

  make(kind, a, b, state = {}) {
    const material = MATERIALS[kind];
    const id = state.id ?? ++this.ids;
    const item = {
      id,
      kind,
      a: particle(a),
      b: particle(b),
      r0: material.radius,
      mass: 1,
      char: 0,
      temp: 0,
      burning: false,
      asleep: false,
      still: 0,
      seed: Math.floor(hash(this.options.seed, id) * 65536),
      ...state,
    };
    // Burning thins a log until it can no longer hold its place in a stack.
    item.wakeMass ??= item.kind === "log" ? 0.45 + 0.3 * hash(item.seed, 7) : item.kind === "stick" ? 0.7 : 0.3;
    item.length0 ??= length3(sub(b, a));
    const n = Math.max(1, Math.round(item.length0 / SEGMENT));
    const fill = (value, from) =>
      from
        ? Float32Array.from({ length: n }, (_, k) => from[Math.min(from.length - 1, Math.floor(((k + 0.5) / n) * from.length))])
        : new Float32Array(n).fill(value);
    item.heat = fill(item.temp, state.heat);
    item.fire = fill(item.burning ? 1 : 0, state.fire);
    item.chars = fill(item.char, state.chars);
    // Soaked sections cannot burn until they dry.
    item.wet = fill(0, state.wet);
    item.bark = fill(kind === "log" ? 1 : 0, state.bark);
    summarize(item);
    item.r = item.r0;
    item.length = item.length0;
    return item;
  }

  // Three logs lean into a teepee over a nest of sticks and two balls of paper.
  buildTeepee({ logs = 3, lit = true } = {}) {
    const floor = HEARTH.floor;
    const apex = { x: 240, y: floor - 62, z: 42 };
    const feet = [
      { x: 206, z: 26, r: 6.4 },
      { x: 274, z: 28, r: 6.1 },
      { x: 241, z: 68, r: 6.6 },
    ].slice(0, logs);
    if (logs === 2) apex.z = 27;
    for (const foot of feet) {
      if (logs === 1) {
        this.spawn("log", { x: 202, y: floor - foot.r, z: 40 }, { x: 278, y: floor - foot.r, z: 40 }, { r0: foot.r });
        continue;
      }
      const hx = foot.x - apex.x;
      const hz = foot.z - apex.z;
      const reach = Math.hypot(hx, hz) || 1;
      // Logs cross a little past the apex, so each one nests in the crotch of the others.
      const through = { x: apex.x + (hx / reach) * foot.r, y: apex.y, z: apex.z + (hz / reach) * foot.r };
      const base = { x: foot.x, y: floor - foot.r, z: foot.z };
      const axis = sub(through, base);
      const top = { x: through.x + axis.x * 0.22, y: through.y + axis.y * 0.22, z: through.z + axis.z * 0.22 };
      this.spawn("log", base, top, { r0: foot.r, char: 0.05 });
    }
    const center = { x: 240, z: 42 };
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + 0.4;
      const foot = { x: center.x + Math.cos(angle) * 14, y: floor - 1.8, z: center.z + Math.sin(angle) * 12 };
      this.spawn("stick", foot, { x: center.x + Math.cos(angle) * 2, y: floor - 32, z: center.z + Math.sin(angle) * 2 });
    }
    const paper = { burning: lit, temp: lit ? 1 : 0 };
    this.spawn("paper", { x: 233, y: floor - 6, z: 40 }, { x: 235, y: floor - 6, z: 40 }, { ...paper });
    this.spawn("paper", { x: 247, y: floor - 6, z: 46 }, { x: 249, y: floor - 6, z: 45 }, { ...paper });
    this.settle();
  }

  // Resolve a hand-placed arrangement into a resting pose without the overlap
  // corrections turning into velocity.
  // The lower end of each rod stays pinned while the upper ends work out their contacts.
  settle(rounds = 160) {
    const feet = this.items.map((item) => {
      const foot = item.a.y >= item.b.y ? item.a : item.b;
      return [foot, foot.x, foot.y, foot.z];
    });
    for (let round = 0; round < rounds; round++) {
      this.substep(0.15);
      for (const [foot, x, y, z] of feet) Object.assign(foot, { x, y, z });
      for (const item of this.items) {
        for (const p of [item.a, item.b]) {
          p.px = p.x;
          p.py = p.y;
          p.pz = p.z;
        }
      }
    }
    for (const item of this.items) item.asleep = true;
    this.impacts = [];
  }

  wake(item) {
    if (!item.asleep) return;
    item.asleep = false;
    item.still = 0;
  }

  wakeAround(item) {
    for (const other of this.items) {
      if (other === item || !other.asleep) continue;
      const [s, t] = closestParams(item.a, item.b, other.a, other.b);
      if (length3(sub(lerp(item.a, item.b, s), lerp(other.a, other.b, t))) < item.r + other.r + 2) this.wake(other);
    }
  }

  spawnSpare() {
    for (const spot of PILE) {
      const free = this.items.every((item) => Math.hypot((item.a.x + item.b.x) / 2 - spot.x, (item.a.z + item.b.z) / 2 - spot.z) > 14);
      const patch = boardAt(spot.x, spot.z);
      if (!free || (patch >= 0 && this.boards.fire[patch] > 0)) continue;
      const r = 6 + hash(this.ids, 3) * 0.8;
      const half = 34 + hash(this.ids, 5) * 6;
      this.spawn(
        "log",
        { x: spot.x - half, y: ROOM_FLOOR - r - 2, z: spot.z },
        { x: spot.x + half, y: ROOM_FLOOR - r - 2, z: spot.z + 3 },
        { r0: r }
      );
      return true;
    }
    return false;
  }

  // A dropped item, as from the controls: it falls into the hearth from above.
  drop(kind) {
    if (this.items.length >= MAX_ITEMS || this.items.filter(inHearth).length >= MAX_HEARTH_ITEMS) return null;
    const material = MATERIALS[kind];
    const x = 240 + (this.random() - 0.5) * 40;
    const tilt = (this.random() - 0.5) * 0.7;
    const half = (kind === "log" ? 38 : material.length / 2) * (0.9 + this.random() * 0.2);
    const y = 140;
    return this.spawn(
      kind,
      { x: x - Math.cos(tilt) * half, y: y - Math.sin(tilt) * half, z: 36 },
      { x: x + Math.cos(tilt) * half, y: y + Math.sin(tilt) * half, z: 46 }
    );
  }

  hitTest(sx, sy) {
    let best = null;
    let bestZ = Infinity;
    for (const item of this.items) {
      const ax = item.a.x;
      const ay = screenY(item.a.y, item.a.z);
      const dx = item.b.x - ax;
      const dy = screenY(item.b.y, item.b.z) - ay;
      const len2 = dx * dx + dy * dy;
      const s = len2 > 1e-9 ? clamp(((sx - ax) * dx + (sy - ay) * dy) / len2, 0, 1) : 0.5;
      const distance = Math.hypot(ax + dx * s - sx, ay + dy * s - sy);
      const z = item.a.z + (item.b.z - item.a.z) * s;
      if (distance <= item.r + 3 && z < bestZ) {
        best = { item, s, z };
        bestZ = z;
      }
    }
    return best;
  }

  supplyAt(sx, sy) {
    for (const [kind, box] of Object.entries(SUPPLIES)) {
      if (sx >= box.x && sx <= box.x + box.width && sy >= box.y && sy <= box.y + box.height) return kind;
    }
    return null;
  }

  grabAt(sx, sy) {
    let hit = this.hitTest(sx, sy);
    if (!hit) {
      const kind = this.supplyAt(sx, sy);
      if (!kind || this.items.length >= MAX_ITEMS) return false;
      const z = -30;
      const y = sy + z * DEPTH_LIFT;
      const half = MATERIALS[kind].length / 2;
      const item = this.spawn(kind, { x: sx - half, y: y - half * 0.3, z }, { x: sx + half, y: y + half * 0.3, z });
      hit = { item, s: 0.5, z };
    }
    this.wake(hit.item);
    this.grab = { ...hit, sx, sy };
    return true;
  }

  dragTo(sx, sy) {
    if (!this.grab) return;
    this.grab.sx = clamp(sx, 0, SCENE.width);
    this.grab.sy = clamp(sy, 0, SCENE.height);
  }

  release() {
    const item = this.grab?.item;
    if (item?.burning && Math.max(length3(motion(item.a)), length3(motion(item.b))) > 2) this.events.push({ type: "fling" });
    this.grab = null;
  }

  strike(sx, sy) {
    this.match = { x: sx, y: sy, z: insideOpening(sx, sy) ? HEARTH.depth / 2 : -20, life: 1.6 };
  }

  physics(dt) {
    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this.substep(GRAVITY * h * h);
  }

  substep(gravity) {
    const items = this.items;
    for (const item of items) {
      if (item.asleep) continue;
      for (const p of [item.a, item.b]) {
        const vx = (p.x - p.px) * 0.998;
        const vy = (p.y - p.py) * 0.998;
        const vz = (p.z - p.pz) * 0.998;
        p.px = p.x;
        p.py = p.y;
        p.pz = p.z;
        p.x += vx;
        p.y += vy + gravity;
        p.z += vz;
        p.contact = false;
        p.impact = 0;
      }
    }
    const grab = this.grab;
    if (grab) {
      const { sx, sy, item } = grab;
      let target = -20;
      if (insideOpening(sx, sy) && sy < HEARTH.floor - 2) target = HEARTH.depth / 2;
      else if (sy > ROOM_FLOOR - 10) target = clamp((ROOM_FLOOR - item.r - 2 - sy) / DEPTH_LIFT, ROOM_DEPTH + 12, -16);
      grab.z += clamp(target - grab.z, -3, 3);
    }
    this.contacts = [];
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (const item of items) this.rod(item);
      if (grab && items.includes(grab.item)) this.pull(grab);
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) this.touch(items[i], items[j], iteration);
        for (const bar of this.statics) this.touch(items[i], bar, iteration);
        for (const book of this.fixtures) this.touch(items[i], book, iteration);
      }
      for (const item of items) {
        if (item.asleep) continue;
        const free = grab?.item !== item;
        this.bound(item.a, item.r, free);
        this.bound(item.b, item.r, free);
      }
    }
    this.friction();
    for (const item of items) {
      if (item.asleep) continue;
      let moved = 0;
      for (const p of [item.a, item.b]) moved = Math.max(moved, Math.hypot(p.x - p.px, p.y - p.py, p.z - p.pz));
      item.still = moved < 0.04 && grab?.item !== item ? item.still + 1 : 0;
      if (item.still > 72) item.asleep = true;
      for (const p of [item.a, item.b]) {
        const move = Math.hypot(p.x - p.px, p.y - p.py, p.z - p.pz);
        if (move > 12) {
          const k = 12 / move;
          p.x = p.px + (p.x - p.px) * k;
          p.y = p.py + (p.y - p.py) * k;
          p.z = p.pz + (p.z - p.pz) * k;
        }
        if (p.impact > 1.2) this.impacts.push({ x: p.x, y: p.y, z: p.z, strength: p.impact, items: [item] });
      }
    }
  }

  weight(item) {
    if (item.static || item.asleep) return 0;
    const base = 1 / (MATERIALS[item.kind].weight * (0.15 + 0.85 * item.mass));
    return this.grab && this.grab.item === item ? base * 0.3 : base;
  }

  rod(item) {
    if (item.asleep) return;
    const { a, b } = item;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const k = ((len - item.length) / len) * 0.5;
    a.x += dx * k;
    a.y += dy * k;
    a.z += dz * k;
    b.x -= dx * k;
    b.y -= dy * k;
    b.z -= dz * k;
  }

  pull({ item, s, sx, sy, z }) {
    this.wake(item);
    const target = { x: sx, y: sy + z * DEPTH_LIFT, z };
    const point = lerp(item.a, item.b, s);
    const scale = 0.5 / ((1 - s) ** 2 + s * s);
    for (const axis of ["x", "y", "z"]) {
      const delta = (target[axis] - point[axis]) * scale;
      item.a[axis] += delta * (1 - s);
      item.b[axis] += delta * s;
    }
  }

  touch(A, B, iteration) {
    if (A.asleep && (B.asleep || B.static)) return;
    const reach = A.r + B.r;
    const { a: pa, b: qa } = A;
    const { a: pb, b: qb } = B;
    if (Math.min(pa.x, qa.x) - reach > Math.max(pb.x, qb.x) || Math.min(pb.x, qb.x) - reach > Math.max(pa.x, qa.x)) return;
    if (Math.min(pa.y, qa.y) - reach > Math.max(pb.y, qb.y) || Math.min(pb.y, qb.y) - reach > Math.max(pa.y, qa.y)) return;
    if (Math.min(pa.z, qa.z) - reach > Math.max(pb.z, qb.z) || Math.min(pb.z, qb.z) - reach > Math.max(pa.z, qa.z)) return;
    const [s, t] = closestParams(pa, qa, pb, qb);
    const c1 = lerp(pa, qa, s);
    const c2 = lerp(pb, qb, t);
    const d = sub(c1, c2);
    const distance = length3(d);
    const depth = reach - distance;
    // Resting contacts are usually resolved by the last pass; keep them for friction.
    if (depth <= -0.3) return;
    const n = distance > 1e-6 ? { x: d.x / distance, y: d.y / distance, z: d.z / distance } : { x: 0, y: -1, z: 0 };
    // A push from a moving body wakes a resting one.
    if (depth > 0.35) {
      if (A.asleep) this.wake(A);
      if (B.asleep) this.wake(B);
    }
    const wA = this.weight(A);
    const wB = this.weight(B);
    const g = wA * ((1 - s) ** 2 + s * s) + wB * ((1 - t) ** 2 + t * t);
    if (g <= 0) return;
    if (iteration === ITERATIONS - 1) this.contacts.push({ A, B, s, t, n, wA, wB, g });
    if (depth <= 0) return;
    if (iteration === 0) {
      const mA = lerp(motion(pa), motion(qa), s);
      const mB = B.static ? { x: 0, y: 0, z: 0 } : lerp(motion(pb), motion(qb), t);
      const approach = -dot(sub(mA, mB), n);
      if (approach > 1) this.impacts.push({ ...c2, strength: approach, items: [A, B] });
    }
    const k = depth / g;
    for (const axis of ["x", "y", "z"]) {
      const push = n[axis] * k;
      pa[axis] += push * wA * (1 - s);
      qa[axis] += push * wA * s;
      if (!B.static) {
        pb[axis] -= push * wB * (1 - t);
        qb[axis] -= push * wB * t;
      }
    }
  }

  // free: not in hand. A held item is lifted over the mantel shelf rather than caught on it.
  bound(p, r, free = true) {
    p.x = clamp(p.x, r, SCENE.width - r);
    p.z = clamp(p.z, ROOM_DEPTH + r, HEARTH.depth - r);
    if (p.y < -60) p.y = -60;
    if (p.z > -r) {
      const fits = p.x - r >= HEARTH.left && p.x + r <= HEARTH.right && p.y - r >= archTopAt(p.x);
      if (!fits) {
        if (p.pz > -r + 0.01) {
          p.x = clamp(p.x, HEARTH.left + r, HEARTH.right - r);
          p.y = Math.max(p.y, archTopAt(p.x) + r);
        } else p.z = -r;
      }
    }
    if (free && p.x >= SHELF.left && p.x <= SHELF.right && p.z <= SHELF.back && p.z >= SHELF.front) {
      const top = shelfTop(p.z) - r;
      if (p.y > top && p.py <= top + 1.5) {
        p.impact = Math.max(p.impact, p.y - p.py);
        p.y = top;
        p.contact = true;
        return;
      }
    }
    const floor = floorAt(p.x, p.z) - r;
    if (p.y > floor) {
      p.impact = Math.max(p.impact, p.y - p.py);
      p.y = floor;
      p.contact = true;
    }
  }

  friction() {
    const grip = this.options.friction;
    for (const item of this.items) {
      if (item.asleep) continue;
      const mu = grip * MATERIALS[item.kind].friction * (1 - 0.35 * item.char);
      for (const p of [item.a, item.b]) {
        if (!p.contact) continue;
        const dx = p.x - p.px;
        const dz = p.z - p.pz;
        if (Math.hypot(dx, dz) < 0.35 * mu) {
          p.x = p.px;
          p.z = p.pz;
        } else {
          p.x = p.px + dx * (1 - 0.5 * mu);
          p.z = p.pz + dz * (1 - 0.5 * mu);
        }
      }
    }
    for (const { A, B, s, t, n, wA, wB, g } of this.contacts) {
      if (A.asleep && (B.asleep || B.static)) continue;
      const mA = lerp(motion(A.a), motion(A.b), s);
      const mB = B.static ? { x: 0, y: 0, z: 0 } : lerp(motion(B.a), motion(B.b), t);
      const rel = sub(mA, mB);
      const normal = dot(rel, n);
      const slip = { x: rel.x - n.x * normal, y: rel.y - n.y * normal, z: rel.z - n.z * normal };
      const amount = length3(slip);
      if (amount < 1e-6) continue;
      const mu = grip * 0.5 * (MATERIALS[A.kind].friction + (B.static ? 1 : MATERIALS[B.kind].friction));
      const share = (amount < 0.3 * mu ? 1 : 0.4 * mu) / g;
      for (const axis of ["x", "y", "z"]) {
        const fix = slip[axis] * share;
        A.a[axis] -= fix * wA * (1 - s);
        A.b[axis] -= fix * wA * s;
        if (!B.static) {
          B.a[axis] += fix * wB * (1 - t);
          B.b[axis] += fix * wB * t;
        }
      }
    }
  }

  emberColumn(x) {
    return Math.floor((x - HEARTH.left) / 2);
  }

  // Each section of wood warms toward the heat around it: hot gas from the fluid
  // (exposure, per section, set by the caller), radiation from nearby flames, the
  // ember bed, a burning floor, the candle, a match, and conduction from the sections next to it.
  burn(dt, exposure) {
    const { burnScale, emberSeconds } = this.options;
    const match = this.match;
    const struck = match ? this.hitTest(match.x, match.y) : null;
    const removed = [];
    const radiant = this.radiation();
    const boards = this.boards;
    boards.contact.fill(0);
    for (const item of [...this.items, ...this.fixtures]) {
      if (item.spent) continue;
      const fixed = !!item.static;
      const material = MATERIALS[item.kind];
      const n = item.heat.length;
      const gas = exposure.get(item);
      const rays = radiant.get(item);
      const before = Float32Array.from(item.heat);
      const was = item.burning;
      const warm = Math.min(1, (material.warm * dt) / burnScale);
      const conduct = Math.min(0.5, (material.conduct * dt) / burnScale);
      const lit = struck && struck.item === item ? segmentAt(item, struck.s) : -9;
      const charRate = dt / (material.char * burnScale);
      let candle = false;
      for (let k = 0; k < n; k++) {
        let heat = Math.max(gas ? gas[k] * material.convect : 0, rays ? rays[k] : 0);
        // A match is small: it lights paper or a twig, and only scorches a log.
        if (Math.abs(k - lit) <= (item.kind === "log" ? 0 : 1)) heat = Math.max(heat, 1.1);
        const p = centerOf(item, k);
        if (!fixed && p.z < 0) {
          const sy = screenY(p.y, p.z);
          if (Math.abs(p.x - CANDLE_FLAME.x) <= item.r + 2 && sy >= CANDLE_FLAME.y - item.r - 5 && sy <= CANDLE_FLAME.y + item.r + 3) {
            heat = Math.max(heat, item.kind === "log" ? 0.35 : 1.1);
            candle = true;
          }
        }
        if (p.z >= -7 && p.y + item.r >= floorAt(p.x, p.z) - 3) {
          const column = this.emberColumn(p.x);
          if (column >= 0 && column < EMBER_COLUMNS) heat = Math.max(heat, this.embers[column] * 0.45);
        } else if (!fixed && p.y + item.r >= ROOM_FLOOR - 3) {
          const patch = boardAt(p.x, p.z);
          if (patch >= 0) {
            heat = Math.max(heat, boards.fire[patch] * 0.9);
            const glow = item.heat[k] >= 0.5 ? item.heat[k] * 0.85 : 0;
            if (item.fire[k] || glow) boards.contact[patch] = Math.max(boards.contact[patch], segmentFlame(item, k), glow);
          }
        }
        if (item.wet[k] > 0) {
          // Drying takes longer the cooler it is around the wood.
          item.wet[k] = Math.max(0, item.wet[k] - (dt * (0.08 + 0.3 * Math.max(0, heat))) / burnScale);
          heat = Math.min(heat, 0.15);
          if (item.fire[k]) item.fire[k] = Math.max(0, item.fire[k] - dt * 2 * item.wet[k]);
        }
        const neighbors = (before[Math.max(0, k - 1)] + before[Math.min(n - 1, k + 1)]) / 2;
        if (item.fire[k]) {
          // A flame grows with the heat feeding it: its own, plus what the fire around it adds.
          const support = clamp((heat + material.sustain - material.out) / (1 - material.out), 0, 1);
          item.fire[k] += (support - item.fire[k]) * warm;
          if (item.fire[k] < 0.06) item.fire[k] = 0;
          item.heat[k] = item.fire[k] ? 0.6 + 0.4 * item.fire[k] : material.out;
          item.chars[k] = Math.min(1, item.chars[k] + charRate * (1 - item.chars[k]) * (0.4 + 0.6 * item.fire[k]));
          if (item.bark[k] > 0) item.bark[k] = Math.max(0, item.bark[k] - (dt / (BARK_LAYER.seconds * burnScale)) * (0.3 + 0.7 * item.fire[k]));
        } else {
          const bark = item.bark[k];
          const t = before[k] + (heat - before[k]) * warm * (1 - BARK_LAYER.slow * bark) + (neighbors - before[k]) * conduct;
          item.heat[k] = t;
          if (t >= material.ignite + BARK_LAYER.shield * bark) item.fire[k] = 0.3;
        }
      }
      const fire = summarize(item);
      if (!was && item.burning) {
        const near =
          match &&
          Math.hypot((item.a.x + item.b.x) / 2 - match.x, screenY((item.a.y + item.b.y) / 2, (item.a.z + item.b.z) / 2) - match.y) <
            item.length / 2 + item.r + 12;
        const source = struck?.item === item || near ? "match" : candle ? "candle" : "spread";
        this.events.push({ type: "ignite", kind: item.kind, source, inHearth: inHearth(item) });
      }
      if (fire > 0) {
        const rate = (dt / (material.burn * burnScale)) * fire;
        item.mass -= rate * (0.5 + 0.5 * item.char);
        if (inHearth(item)) {
          for (let k = 0; k < n; k++) {
            if (!item.fire[k]) continue;
            const column = this.emberColumn(centerOf(item, k).x);
            for (let c = column - 1; c <= column + 1; c++) {
              if (c >= 0 && c < EMBER_COLUMNS) this.embers[c] = Math.min(1, this.embers[c] + (rate * material.embers * 9 * item.fire[k]) / n);
            }
          }
        }
      }
      if (fixed) {
        // A burnt book stays on the shelf as a charred husk.
        if (item.mass < 0.2) {
          item.spent = true;
          item.fire.fill(0);
          item.chars.fill(1);
          item.heat.fill(0);
          summarize(item);
        }
        continue;
      }
      if (item.asleep && item.mass < item.wakeMass) {
        this.wake(item);
        this.wakeAround(item);
      }
      if (item.kind === "paper") item.r = item.r0 * (0.35 + 0.65 * item.mass);
      else if (!item.asleep) {
        item.length = item.length0 * (0.55 + 0.45 * item.mass);
        item.r = Math.max(item.kind === "stick" ? 0.8 : 1.5, item.r0 * Math.sqrt(item.mass));
      }
      const breakable = item.kind === "log" && item.burning && item.mass < 0.55 && item.char > 0.75 && item.length > item.r * 5;
      if (breakable && this.grab?.item !== item && this.random() < dt * 0.03) this.split(item);
      else if (item.mass < 0.06) removed.push(item);
    }
    for (const item of removed) this.consume(item);
    this.burnBoards(dt, exposure.floor);
    for (let c = 0; c < EMBER_COLUMNS; c++) {
      const cooled = (this.embers[c] * dt) / emberSeconds;
      this.embers[c] = Math.max(0, this.embers[c] - cooled);
      this.ash[c] = Math.min(1, this.ash[c] + cooled * 0.6);
    }
    if (match && (match.life -= dt) <= 0) this.match = null;
    const spares = this.items.filter((item) => item.kind === "log" && !item.burning && (item.a.z + item.b.z) / 2 < -20 && this.grab?.item !== item);
    if (spares.length < 2 && (this.spareTimer += dt) > 2.5) {
      this.spawnSpare();
      this.spareTimer = 0;
    }
  }

  // Floor patches warm from burning wood lying on them, from neighbors that are
  // alight, and a little from hot gas just above (gas, per patch, from the caller).
  burnBoards(dt, gas) {
    const { burnScale } = this.options;
    const { heat, fire, fuel, char, vigor, contact, wet, rug } = this.boards;
    const { cols, rows } = BOARDS;
    const rates = [BOARD, RUG_PATCH].map((patch) => [Math.min(1, (patch.warm * dt) / burnScale), Math.min(1, (patch.touch * dt) / burnScale)]);
    const previous = Float32Array.from(fire);
    for (let i = 0; i < cols * rows; i++) {
      if (fuel[i] <= 0) continue;
      const patch = rug[i] ? RUG_PATCH : BOARD;
      const [rate, touch] = rates[rug[i]];
      const col = i % cols;
      const row = (i / cols) | 0;
      let around = 0;
      let strongest = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || col + dx < 0 || col + dx >= cols || row + dy < 0 || row + dy >= rows) continue;
          const j = i + dy * cols + dx;
          if (!previous[j]) continue;
          around += previous[j] * (dx && dy ? 0.25 : 0.45);
          strongest = Math.max(strongest, vigor[j]);
        }
      }
      let target = Math.max(contact[i], gas ? gas[i] * 0.5 : 0, around);
      if (wet[i] > 0) {
        wet[i] = Math.max(0, wet[i] - (dt * (0.05 + 0.3 * target)) / burnScale);
        target = Math.min(target, 0.15);
        if (fire[i]) fire[i] = Math.max(0, fire[i] - dt * 2 * wet[i]);
      }
      if (fire[i]) {
        if (contact[i] > 0.2) vigor[i] = 1;
        const support = clamp((target + patch.sustain - patch.out) / (1 - patch.out), 0, 1);
        const goal = support * vigor[i] * Math.min(1, fuel[i] * 3);
        fire[i] += (goal - fire[i]) * Math.min(1, rate * 4);
        fuel[i] = Math.max(0, fuel[i] - (dt / (patch.burn * burnScale)) * fire[i]);
        char[i] = Math.max(char[i], 1 - fuel[i]);
        if (fire[i] < 0.05 || fuel[i] <= 0.02) {
          fire[i] = 0;
          heat[i] = patch.out * 0.5;
          if (fuel[i] <= 0.02) fuel[i] = 0;
        } else heat[i] = 0.6 + 0.4 * fire[i];
      } else {
        heat[i] += (target - heat[i]) * (contact[i] > around ? touch : rate);
        if (heat[i] > patch.singe) char[i] = Math.max(char[i], (heat[i] - patch.singe) * 0.5);
        if (heat[i] >= patch.ignite) {
          fire[i] = 0.3;
          // Fire reaching the rug from the boards starts fresh there.
          vigor[i] = contact[i] >= around ? 1 : rug[i] ? Math.max(0.85, strongest) * patch.spread : strongest * patch.spread;
          this.events.push({ type: "floor", rug: !!rug[i] });
        }
      }
    }
  }

  boardsBurning() {
    let count = 0;
    for (const value of this.boards.fire) if (value > 0) count++;
    return count;
  }

  // Burning sections heat nearby wood even where no hot gas reaches it, falling
  // off roughly with the square of the gap between the two surfaces. Flame
  // touching a book heats it directly.
  radiation() {
    const heat = new Map();
    const sources = [];
    const all = [...this.items, ...this.fixtures];
    for (const item of all) {
      if (!item.burning) continue;
      for (let k = 0; k < item.heat.length; k++) {
        // Charred wood still radiates: its heat moves from flame into glowing coal.
        const strength = MATERIALS[item.kind].flame * Math.sqrt(Math.max(0, item.mass)) * item.fire[k];
        if (strength > 0) sources.push({ item, p: centerOf(item, k), r: item.r, strength });
      }
    }
    if (!sources.length) return heat;
    for (const item of all) {
      if (item.spent) continue;
      const n = item.heat.length;
      let field = null;
      for (let k = 0; k < n; k++) {
        const p = centerOf(item, k);
        let total = 0;
        for (const source of sources) {
          if (source.item === item) continue;
          const dy = p.y - source.p.y;
          const distance = Math.hypot(p.x - source.p.x, dy, p.z - source.p.z) || 1e-6;
          const gap = Math.max(0, distance - item.r - source.r);
          // Flames lean up, so wood above a fire catches far sooner than wood beside or below it.
          const above = clamp(0.55 - (0.75 * dy) / distance, 0.25, 1.3);
          total += source.strength * 0.6 * above * (RADIANT_REACH / (gap + RADIANT_REACH)) ** 2;
          if ((item.static || source.item.static) && gap < 3) total += source.strength * 0.8;
        }
        if (total > 0) {
          field ??= new Float32Array(n);
          field[k] = Math.min(1, total);
        }
      }
      if (field) heat.set(item, field);
    }
    return heat;
  }

  // Water from the mug falls as drops. amount: how much water leaves the mug this frame.
  pour(x, y, amount) {
    this.pourCarry += amount * 110;
    const inside = insideOpening(x, y);
    const onShelf = !inside && x >= SHELF.left && x <= SHELF.right && y < SHELF.y;
    while (this.pourCarry >= 1 && this.drops.length < DROP_LIMIT) {
      this.pourCarry -= 1;
      this.drops.push({
        x: x + (this.random() - 0.5) * 3,
        y: y + this.random() * 2,
        vx: (this.random() - 0.5) * 24,
        vy: 30 + this.random() * 30,
        z: inside ? HEARTH.depth / 2 : -20,
        land: inside ? HEARTH.floor - 1 : onShelf ? SHELF.y : Math.max(BOARDS.top + 1, y + 6),
        left: 3,
        last: null,
      });
    }
    if (this.pourCarry >= 1) this.pourCarry = 0;
  }

  // Each drop cools what it lands on. Hot surfaces hiss into steam.
  updateDrops(dt) {
    const kept = [];
    for (const drop of this.drops) {
      drop.vy += 700 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      // A drop runs on down through the wood, wetting a few pieces on its way.
      const hit = this.wetTarget(drop);
      if (hit) {
        if (this.douse(hit.item, segmentAt(hit.item, hit.s))) this.hiss(drop.x, drop.y, 3);
        drop.last = hit.item;
        drop.vy *= 0.4;
        drop.vx += (this.random() - 0.5) * 30;
        if (--drop.left <= 0) continue;
      }
      if (drop.y < drop.land) {
        kept.push(drop);
        continue;
      }
      if (drop.z >= 0) {
        const column = this.emberColumn(drop.x);
        let hot = false;
        for (let c = column - 2; c <= column + 2; c++) {
          if (c < 0 || c >= EMBER_COLUMNS) continue;
          if (this.embers[c] > 0.05) hot = true;
          this.embers[c] = Math.max(0, this.embers[c] * 0.7 - 0.05);
        }
        if (hot) this.hiss(drop.x, drop.land, 2);
      } else if (drop.land >= BOARDS.top) {
        const col = Math.floor(drop.x / BOARDS.width);
        const row = Math.floor((drop.land - BOARDS.top) / BOARDS.height);
        if (col >= 0 && col < BOARDS.cols && row >= 0 && row < BOARDS.rows) {
          const { fire, heat } = this.boards;
          const i = row * BOARDS.cols + col;
          const hot = fire[i] > 0 || heat[i] > 0.3;
          const was = fire[i] > 0;
          fire[i] = Math.max(0, fire[i] - 0.5);
          if (fire[i] < 0.05) fire[i] = 0;
          heat[i] = Math.max(-0.6, Math.min(heat[i], 0.2) - 0.3);
          this.boards.wet[i] = Math.min(3, this.boards.wet[i] + 1);
          if (was && !fire[i]) this.events.push({ type: "douse" });
          if (hot) this.hiss(drop.x, drop.land, 2);
        }
      }
    }
    this.drops = kept;
    const steam = [];
    for (const puff of this.steam) {
      puff.age += dt;
      if (puff.age >= puff.life) continue;
      puff.vx *= 0.97;
      puff.vy *= 0.985;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      steam.push(puff);
    }
    this.steam = steam;
  }

  wetTarget(drop) {
    for (const item of [...this.items, ...this.fixtures]) {
      if (item === drop.last || (item.a.z + item.b.z) / 2 >= 0 !== drop.z >= 0) continue;
      const ax = item.a.x;
      const ay = screenY(item.a.y, item.a.z);
      const dx = item.b.x - ax;
      const dy = screenY(item.b.y, item.b.z) - ay;
      const len2 = dx * dx + dy * dy;
      const s = len2 > 1e-9 ? clamp(((drop.x - ax) * dx + (drop.y - ay) * dy) / len2, 0, 1) : 0.5;
      if (Math.hypot(ax + dx * s - drop.x, ay + dy * s - drop.y) <= item.r + 1) return { item, s };
    }
    return null;
  }

  // Water knocks a flame down and soaks the wood, which must dry before it can catch again.
  douse(item, k) {
    const n = item.heat.length;
    const was = item.fire[k] > 0;
    const hot = was || item.heat[k] > 0.3;
    for (let j = Math.max(0, k - 2); j <= Math.min(n - 1, k + 2); j++) {
      const share = j === k ? 1 : Math.abs(j - k) === 1 ? 0.6 : 0.3;
      item.fire[j] = Math.max(0, item.fire[j] - 0.8 * share);
      if (item.fire[j] < 0.06) item.fire[j] = 0;
      item.wet[j] = Math.min(3, item.wet[j] + 1.2 * share);
      item.heat[j] = Math.max(-0.8, Math.min(item.heat[j], 0.3) - 0.5 * share);
    }
    summarize(item);
    if (was && !item.fire[k]) this.events.push({ type: "douse" });
    return hot;
  }

  hiss(x, y, count) {
    for (let i = 0; i < count && this.steam.length < STEAM_LIMIT; i++) {
      this.steam.push({
        x: x + (this.random() - 0.5) * 6,
        y: y - 2,
        vx: (this.random() - 0.5) * 16,
        vy: -(14 + this.random() * 22),
        age: 0,
        life: 0.7 + this.random() * 1.1,
      });
    }
  }
  split(item) {
    const { a, b } = item;
    const axis = sub(b, a);
    const len = length3(axis) || 1;
    const unit = { x: axis.x / len, y: axis.y / len, z: axis.z / len };
    const half = len / 2 - item.r * 0.4;
    const scale = 0.55 + 0.45 * item.mass;
    const state = { r0: item.r0, mass: item.mass, length0: half / scale };
    const n = item.heat.length;
    const part = (from, to) => ({
      ...state,
      heat: item.heat.slice(from, to),
      fire: item.fire.slice(from, to),
      chars: item.chars.slice(from, to),
      wet: item.wet.slice(from, to),
      bark: item.bark.slice(from, to),
    });
    const end = (p, sign) => ({ x: p.x + unit.x * half * sign, y: p.y + unit.y * half * sign, z: p.z + unit.z * half * sign });
    const first = this.spawn(item.kind, a, end(a, 1), part(0, Math.ceil(n / 2)));
    const second = this.spawn(item.kind, end(b, -1), b, part(Math.floor(n / 2), n));
    for (const [piece, from] of [
      [first, a],
      [second, b],
    ]) {
      for (const p of [piece.a, piece.b]) {
        p.px = p.x - (from.x - from.px);
        p.py = p.y - (from.y - from.py);
        p.pz = p.z - (from.z - from.pz);
      }
    }
    this.items.splice(this.items.indexOf(item), 1);
    this.wakeAround(item);
    this.events.push({ type: "split" });
    const mid = lerp(a, b, 0.5);
    this.burst(mid.x, screenY(mid.y, mid.z), 26, 1);
  }

  consume(item) {
    const index = this.items.indexOf(item);
    if (index < 0) return;
    this.items.splice(index, 1);
    this.wakeAround(item);
    if (this.grab?.item === item) this.grab = null;
    const material = MATERIALS[item.kind];
    if (inHearth(item)) {
      const from = this.emberColumn(Math.min(item.a.x, item.b.x));
      const to = this.emberColumn(Math.max(item.a.x, item.b.x));
      for (let c = Math.max(0, from - 1); c <= Math.min(EMBER_COLUMNS - 1, to + 1); c++) {
        this.embers[c] = Math.min(1, this.embers[c] + material.embers * 0.5);
      }
    }
    const mid = lerp(item.a, item.b, 0.5);
    this.burst(mid.x, screenY(mid.y, mid.z), item.kind === "log" ? 30 : 10, item.kind === "paper" ? 0.5 : 0.8);
  }

  // Turn this step's collisions into kicked-up embers where something hot was hit.
  kick() {
    for (const hit of this.impacts) {
      let hot = hit.items.some((item) => item.burning) ? 1 : 0;
      if (hit.z >= -7) {
        const column = this.emberColumn(hit.x);
        if (column >= 0 && column < EMBER_COLUMNS) hot = Math.max(hot, this.embers[column] * 1.6);
      }
      if (hot < 0.05) continue;
      const count = Math.min(36, Math.round(hit.strength * 4 * hot));
      this.burst(hit.x, screenY(hit.y, hit.z), count, Math.min(1.6, 0.4 + hit.strength * 0.18));
    }
    this.impacts = [];
  }

  burst(x, y, count, power) {
    for (let i = 0; i < count && this.sparks.length < SPARK_LIMIT; i++) {
      this.sparks.push({
        x: x + (this.random() - 0.5) * 6,
        y: y - this.random() * 4,
        vx: (this.random() - 0.5) * 170 * power,
        vy: -(50 + this.random() * 230) * power,
        life: 0.5 + this.random() * 1.7,
        age: 0,
      });
    }
  }

  // A knot in the wood pops and throws an ember forward over the grate onto the floor in front.
  pop(x, y) {
    if (this.sparks.length >= SPARK_LIMIT) return;
    this.sparks.push({
      x,
      y,
      vx: (240 - x) * 0.3 + (this.random() - 0.5) * 50,
      vy: -(90 + this.random() * 70),
      land: BOARDS.top + 1 + this.random() * 22,
      life: 2.4 + this.random(),
      age: 0,
    });
  }

  // Sparks ride the hot gas, fall when it cools, and bounce on the hearth.
  updateSparks(dt, flowAt) {
    const kept = [];
    for (const spark of this.sparks) {
      spark.age += dt;
      if (spark.age >= spark.life) continue;
      const flow = flowAt(spark.x, spark.y);
      // A popped ember is heavy enough to fly through the draft.
      spark.vy += (spark.land ? 420 : 160) * dt;
      if (flow && !spark.land) {
        spark.vx += (flow.u - spark.vx) * 0.12;
        spark.vy += (flow.v - spark.vy) * 0.12 - flow.t * 500 * dt;
      }
      spark.vx *= 0.985;
      spark.vy *= 0.985;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const inside = !spark.land && spark.x > HEARTH.left && spark.x < HEARTH.right;
      const floor = inside ? HEARTH.floor - 1 : spark.land || ROOM_FLOOR + 6;
      if (spark.y > floor) {
        if (!inside && spark.vy > 40) {
          const col = Math.floor(spark.x / BOARDS.width);
          const row = Math.floor((floor - BOARDS.top) / BOARDS.height);
          const i = row * BOARDS.cols + col;
          if (col >= 0 && col < BOARDS.cols && row >= 0 && row < BOARDS.rows && this.boards.rug[i] && this.boards.fuel[i] > 0) {
            this.boards.heat[i] = Math.min(1, this.boards.heat[i] + 0.04);
            this.boards.char[i] = Math.min(1, this.boards.char[i] + 0.02);
          }
        }
        spark.y = floor;
        spark.vy *= -0.3;
        spark.vx *= 0.6;
      }
      if (spark.x > 0 && spark.x < SCENE.width && spark.y > 0) kept.push(spark);
    }
    this.sparks = kept;
  }
}
