// The fireplace simulation: physical logs, sticks, and paper (world.mjs) feed
// hot gas into two small fluid solvers, one inside the firebox and one for the
// room in front of it. Light is computed from that gas (light.mjs). Everything
// is drawn as solid 2×2 pixel cells from fixed palettes.
import { Fluid } from "./fluid.mjs";
import { LIGHT_H, LIGHT_W, findLights, lightAt, lightField, surfaceMap } from "./light.mjs";
import { HEARTH, SCENE, archTopAt, clamp, generator, hash, insideOpening, noise, screenY } from "./scene.mjs";
import { EMBER_COLUMNS, MATERIALS, STEP, SUPPLIES, World, flameStrength, inHearth, segmentAt, segmentFlame } from "./world.mjs";

export { MATERIALS, STEP, SUPPLIES };
export const HIGHLIGHT = "#f8d69b";
export const FIRE_COLORS = [null, "#8e241c", "#c33619", "#e65316", "#f67c1d", "#ffa52a", "#ffc345", "#ffda65", "#ffe990", "#fff3be"];
const BARK = ["#24170f", "#3d281b", "#523622", "#68462b", "#7f5937"];
const TWIG = ["#2e2017", "#4a3424", "#654730", "#80603f", "#9c7a50"];
const CHAR = ["#0c0908", "#140f0d", "#1f1612", "#2c201a", "#3a2a21"];
const GRAIN = ["#3a2819", "#5c3f27", "#7a5734", "#9a7447", "#b48a55"];
const PAPER = ["#3d3a33", "#625c4f", "#8c8370", "#b9ae94", "#e2d8bf"];
const IRON = ["#0f0c0c", "#1a1514", "#241c19", "#33251f", "#4a3328"];
const ASH = ["#211b19", "#2c2522", "#3b3330"];
const VISIBLE = 0.1;
const CELLS_W = SCENE.width / SCENE.pixel;
const CELLS_H = SCENE.height / SCENE.pixel;
const FLAME_LIMIT = 2600;
const FLAME_EDGE = 0.16;
const POCKET_REACH = 6;

export const DEFAULTS = Object.freeze({
  seed: 7,
  flameHeight: 1,
  turbulence: 1,
  sway: 0.6,
  wind: 0,
  puffHz: 2.6,
  burnScale: 1,
  emberSeconds: 300,
  friction: 1,
  logs: 3,
  lit: 1,
});

const LIMITS = {
  seed: [0, 2147483647],
  flameHeight: [0.3, 3],
  turbulence: [0, 3],
  sway: [0, 3],
  wind: [-3, 3],
  puffHz: [0.5, 8],
  burnScale: [0.01, 100],
  emberSeconds: [1, 86400],
  friction: [0, 2],
  logs: [0, 3],
  lit: [0, 1],
};

export function fireOptions(overrides = {}) {
  const options = { ...DEFAULTS };
  for (const [key, [low, high]] of Object.entries(LIMITS)) {
    const raw = overrides[key];
    const value = Number(raw);
    if (raw === undefined || raw === null || raw === "" || !Number.isFinite(value)) continue;
    options[key] = clamp(value, low, high);
  }
  options.seed = Math.floor(options.seed);
  options.logs = Math.round(options.logs);
  options.lit = Math.round(options.lit);
  return options;
}

export function heatIndex(heat) {
  if (!(heat >= VISIBLE)) return 0;
  return Math.min(FIRE_COLORS.length - 1, 1 + Math.floor(((heat - VISIBLE) / (1 - VISIBLE)) * (FIRE_COLORS.length - 1)));
}

const smooth = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

// Visit every grid cell covered by an item's on-screen capsule. v is the signed
// distance across the rod in radii; negative is the upper side, or the side
// facing the fire for an upright rod.
export function raster(item, ox, oy, cell, gw, gh, pad, visit) {
  const ax = item.a.x;
  const ay = screenY(item.a.y, item.a.z);
  const dx = item.b.x - ax;
  const dy = screenY(item.b.y, item.b.z) - ay;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  const r = item.r + pad;
  let nx = len > 1e-6 ? -dy / len : 0;
  let ny = len > 1e-6 ? dx / len : 1;
  if (Math.abs(ny) > 0.3 ? ny < 0 : nx * ((ax + item.b.x) / 2 - HEARTH.center) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const x0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - r - ox) / cell));
  const x1 = Math.min(gw - 1, Math.floor((Math.max(ax, ax + dx) + r - ox) / cell));
  const y0 = Math.max(0, Math.floor((Math.min(ay, ay + dy) - r - oy) / cell));
  const y1 = Math.min(gh - 1, Math.floor((Math.max(ay, ay + dy) + r - oy) / cell));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const px = ox + (gx + 0.5) * cell;
      const py = oy + (gy + 0.5) * cell;
      const rx = px - ax;
      const ry = py - ay;
      const s = len2 > 1e-9 ? (rx * dx + ry * dy) / len2 : 0.5;
      const sc = s < 0 ? 0 : s > 1 ? 1 : s;
      const qx = ax + dx * sc - px;
      const qy = ay + dy * sc - py;
      if (qx * qx + qy * qy > r * r) continue;
      const z = item.a.z + (item.b.z - item.a.z) * sc;
      visit(gx, gy, s, (rx * nx + ry * ny) / Math.max(0.5, item.r), z, s * len, gy * gw + gx, len);
    }
  }
}

// Steep rods show their cut at the top; lying rods at the end nearer the viewer.
function faceEnd(item) {
  const dz = item.b.z - item.a.z;
  const steep = Math.abs(item.b.y - item.a.y) > Math.abs(item.b.x - item.a.x);
  if (steep) return item.a.y < item.b.y ? "a" : "b";
  if (Math.abs(dz) > 2) return dz > 0 ? "a" : "b";
  return "b";
}

function itemColor(item, s, v, along, len, light, time, gx, gy) {
  const level = clamp(Math.floor(light * 4), 0, 4);
  if (item.kind === "iron") return IRON[v < -0.2 ? Math.min(4, level + 1) : Math.max(0, level - 1)];
  const k = segmentAt(item, s);
  const char = item.chars[k];
  const burning = item.fire[k] > 0;
  const temp = item.heat[k];
  const key = item.seed;
  const gu = Math.floor(along / 2);
  const gv = Math.floor((v + 1) * item.r * 0.5);
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.7 + gu * 0.9 + gv * 2.1);
  const ember = (amount) => FIRE_COLORS[1 + Math.floor(pulse * 3.99 * clamp(amount, 0, 1))];
  if (item.kind === "paper") {
    if (Math.abs(v) > 0.55 && hash(gx * 3 + key, gy * 7) < 0.22) return null;
    const grain = hash(gx + key, gy * 5 + 3);
    if (grain < char) return burning && hash(gx * 5, gy + key) < 0.3 ? ember(0.6) : ASH[clamp(level - 1, 0, 2)];
    if (burning && grain < char + 0.18) return FIRE_COLORS[5 + Math.floor(pulse * 3)];
    return PAPER[hash(gx * 7 + key, gy * 3) < 0.3 ? Math.max(0, level - 1) : level];
  }
  const face = faceEnd(item);
  if ((s < 0 && face === "a") || (s > 1 && face === "b")) {
    const ring = Math.hypot(s < 0 ? -along : along - len, v * item.r) / Math.max(0.5, item.r);
    if (char > 0.3 && ring > 0.7) return CHAR[level];
    if (burning && char > 0.55 && ring < 0.5) return ember(temp);
    return GRAIN[clamp(level - (Math.floor(ring * 4) % 2), 0, 4)];
  }
  if (hash(gu * 7 + key, gv * 13) < char * 1.35 - (v + 1) * 0.3 + 0.1) {
    // Hot char glows even after its flame has died.
    if ((burning || temp > 0.3) && hash(gu * 3 + key, gv * 5 + 1) < 0.25 * char) return ember(temp);
    return CHAR[level];
  }
  const index = hash(key + (gu >> 2), gv * 7 + 3) < 0.3 ? Math.max(0, level - 1) : level;
  return (item.kind === "stick" ? TWIG : BARK)[index];
}

export function createFire(overrides = {}) {
  const options = fireOptions(overrides);
  const random = generator(options.seed);
  const world = new World(options, random);
  world.buildTeepee({ logs: options.logs, lit: options.lit > 0 });
  world.spawnSpare();
  world.spawnSpare();
  const inner = new Fluid({
    x: HEARTH.left,
    y: 100,
    cell: 2,
    width: (HEARTH.right - HEARTH.left) / 2,
    height: 75,
    solid: (x, y) => y < archTopAt(x) + 1,
    // The flue above the arch draws hot gas up the chimney.
    sink: (x, y) => (y < archTopAt(x) + 10 && Math.abs(x - HEARTH.center) < 34 ? 0.15 : 0),
  });
  const outer = new Fluid({ x: 0, y: 0, cell: 4, width: SCENE.width / 4, height: SCENE.height / 4 });
  for (const fluid of [inner, outer]) {
    const n = fluid.w * fluid.h;
    fluid.owner = new Int32Array(n);
    fluid.along = new Float32Array(n);
    fluid.depth = new Float32Array(n);
    fluid.part = new Float32Array(n);
  }
  const surfaces = surfaceMap();
  const light = new Float32Array(LIGHT_W * LIGHT_H).fill(0.13);
  const occluders = new Float32Array(LIGHT_W * LIGHT_H);
  const cellsZ = new Float32Array(CELLS_W * CELLS_H);
  const cellItem = new Int32Array(CELLS_W * CELLS_H);
  const cellS = new Float32Array(CELLS_W * CELLS_H);
  const cellV = new Float32Array(CELLS_W * CELLS_H);
  const cellAlong = new Float32Array(CELLS_W * CELLS_H);
  const cellLength = new Float32Array(CELLS_W * CELLS_H);
  const touched = new Int32Array(CELLS_W * CELLS_H);
  const salt = options.seed % 997;
  const flames = [];
  const innerGrid = new Float32Array(CELLS_W * CELLS_H);
  const outerGrid = new Float32Array(CELLS_W * CELLS_H);
  const flameZ = new Float32Array(CELLS_W * CELLS_H);
  const roots = new Map([
    [innerGrid, new Uint8Array(CELLS_W * CELLS_H)],
    [outerGrid, new Uint8Array(CELLS_W * CELLS_H)],
  ]);
  const attached = new Uint8Array(CELLS_W * CELLS_H);
  const outlined = new Uint8Array(CELLS_W * CELLS_H);
  const queue = new Int32Array(CELLS_W * CELLS_H);
  let steps = 0;
  let pending = 0;
  let output = 0;

  // Items become obstacles in the gas, and burning ones release heat from their upper surfaces.
  function feed(fluid, isInner, exposure, time) {
    const { w, h, owner, along, depth, part } = fluid;
    fluid.block.set(fluid.wall);
    owner.fill(0);
    depth.fill(Infinity);
    const items = world.items;
    items.forEach((item, k) =>
      raster(item, fluid.x, fluid.y, fluid.cell, w, h, fluid.cell * 0.35, (gx, gy, s, v, z, distance, i) => {
        if (isInner ? z < -item.r : z >= -item.r) return;
        fluid.block[i] = 1;
        if (z < depth[i]) {
          depth[i] = z;
          owner[i] = k + 1;
          along[i] = distance;
          part[i] = s;
        }
      })
    );
    const low = items.map((item) => Math.max(screenY(item.a.y, item.a.z), screenY(item.b.y, item.b.z)) + item.r);
    const high = items.map((item) => Math.min(screenY(item.a.y, item.a.z), screenY(item.b.y, item.b.z)) - item.r);
    const phase = 2 * Math.PI * options.puffHz * time;
    const t = fluid.t;
    const block = fluid.block;
    for (let i = w; i < w * h - w; i++) {
      const k = owner[i] - 1;
      if (k < 0) continue;
      const item = items[k];
      const segment = segmentAt(item, part[i]);
      const gx = i % w;
      const strength = segmentFlame(item, segment);
      if (!strength) continue;
      // Burning gas leaves any exposed face; one tucked under another item escapes through the first gap above it.
      let j = i - w;
      for (let up = 0; up < 4 && j >= w && block[j] && owner[j] !== owner[i] && !fluid.wall[j]; up++) j -= w;
      if (block[j]) j = gx > 0 && !block[i - 1] ? i - 1 : gx < w - 1 && !block[i + 1] ? i + 1 : -1;
      if (j < 0) continue;
      const py = fluid.y + (Math.floor(i / w) + 0.5) * fluid.cell;
      const rise = clamp((low[k] - py) / Math.max(24, low[k] - high[k]), 0, 1);
      const jet = item.kind === "paper" ? 1 : smooth(0.3, 0.68, noise(along[i] * 0.085 + (item.seed % 89), time * 0.55));
      const pulse = 0.62 + 0.38 * Math.sin(phase + along[i] * 0.06 + item.seed);
      const value = Math.min(1.05, strength * (1 - 0.5 * rise) * (0.16 + 0.84 * jet) * pulse);
      fluid.add(j, value * 0.7, (value * 2) / fluid.cell);
      if (random() < 0.6 * (0.25 + 0.75 * jet)) emit(fluid, j, Math.min(1, value * 1.25), isInner, depth[i] + (random() * 2 - 1) * item.r);
    }
    if (isInner) {
      for (let c = 0; c < EMBER_COLUMNS; c++) {
        const glow = world.embers[c];
        if (glow > 0.02) fluid.add((h - 1) * w + c, glow * 0.45 * (0.35 + 0.65 * noise(c * 0.4, time * 1.2)), 0.1);
      }
    }
    const match = world.match;
    if (match && match.z >= 0 === isInner) {
      const i = fluid.cellAt(match.x, match.y - 3);
      if (i >= 0) {
        for (const j of [i - 1, i, i + 1]) fluid.add(j, 0.95, 0.5);
        if (random() < 0.7) emit(fluid, i, 0.75, isInner, match.z);
      }
    }
  }

  // The gas just around each section of wood: above it, to each side, and below.
  // Sampled in place, so wood hidden behind other wood still feels the heat.
  function expose(exposure) {
    for (const item of world.items) {
      const n = item.heat.length;
      const felt = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const s = (k + 0.5) / n;
        const z = item.a.z + (item.b.z - item.a.z) * s;
        const fluid = z >= -item.r ? inner : outer;
        const x = item.a.x + (item.b.x - item.a.x) * s;
        const y = screenY(item.a.y + (item.b.y - item.a.y) * s, z);
        const reach = item.r + fluid.cell * 1.5;
        felt[k] = Math.max(
          fluid.temperatureAt(x, y - reach),
          fluid.temperatureAt(x - reach, y),
          fluid.temperatureAt(x + reach, y),
          0.6 * fluid.temperatureAt(x, y + reach)
        );
      }
      exposure.set(item, felt);
    }
  }

  // Flame is drawn from small parcels of burning gas. Each one rides the
  // solver's velocity, rises on its own buoyancy, licks around solid items,
  // and cools as it goes. Parcels also heat the gas they pass through, which
  // feeds the updraft that carries them.
  function emit(fluid, j, heat, isInner, z) {
    if (flames.length >= FLAME_LIMIT) return;
    const x = fluid.x + ((j % fluid.w) + random()) * fluid.cell;
    const y = fluid.y + (Math.floor(j / fluid.w) + random()) * fluid.cell;
    flames.push({ x, y, px: x, py: y, vx: 0, vy: -(0.8 + heat * 1.4), heat, z, age: 0, cool: 0.045 + 0.045 * random(), inner: isInner });
  }

  function moveFlames() {
    let kept = 0;
    for (const parcel of flames) {
      const fluid = parcel.inner ? inner : outer;
      const gx = (parcel.x - fluid.x) / fluid.cell - 0.5;
      const gy = (parcel.y - fluid.y) / fluid.cell - 0.5;
      parcel.vx += (fluid.sample(fluid.u, gx, gy) * fluid.cell - parcel.vx) * 0.35 + (random() - 0.5) * 0.5 * options.turbulence;
      parcel.vy += (fluid.sample(fluid.v, gx, gy) * fluid.cell - parcel.vy) * 0.04 - 0.3 * parcel.heat;
      parcel.vx = clamp(parcel.vx, -6, 6);
      parcel.vy = clamp(parcel.vy, -9, 3);
      parcel.px = parcel.x;
      parcel.py = parcel.y;
      parcel.x += parcel.vx;
      parcel.y += parcel.vy;
      let i = fluid.cellAt(parcel.x, parcel.y);
      if (i >= 0 && fluid.block[i] && !fluid.wall[i]) {
        // Blocked by wood: slide along it instead of passing through.
        parcel.y = parcel.py;
        parcel.x += parcel.vx >= 0 ? 1.5 : -1.5;
        parcel.vy *= 0.3;
        parcel.heat *= 0.94;
        i = fluid.cellAt(parcel.x, parcel.y);
      }
      parcel.heat *= 1 - parcel.cool / options.flameHeight;
      parcel.age++;
      if (parcel.heat < 0.08 || i < 0 || fluid.wall[i]) continue;
      if (!fluid.block[i] && fluid.t[i] < parcel.heat * 0.85) fluid.t[i] = parcel.heat * 0.85;
      flames[kept++] = parcel;
    }
    flames.length = kept;
  }

  function flowAt(x, y) {
    const fluid = insideOpening(x, y) ? inner : outer;
    if (fluid.cellAt(x, y) < 0) return null;
    const gx = (x - fluid.x) / fluid.cell - 0.5;
    const gy = (y - fluid.y) / fluid.cell - 0.5;
    const scale = fluid.cell / STEP;
    return { u: fluid.sample(fluid.u, gx, gy) * scale, v: fluid.sample(fluid.v, gx, gy) * scale, t: fluid.sample(fluid.t, gx, gy) };
  }

  function advance(physicsOnly = false) {
    world.physics(STEP);
    if (physicsOnly) {
      world.impacts = [];
      return;
    }
    steps++;
    const time = steps * STEP;
    world.kick();
    const exposure = new Map();
    feed(inner, true, exposure, time);
    feed(outer, false, exposure, time);
    const gas = {
      vorticity: 0.28 * options.turbulence,
      cooling: 0.075 / options.flameHeight,
      decay: 0.004,
      sway: options.sway,
      wind: options.wind,
      time,
      salt,
    };
    inner.step({ ...gas, buoyancy: 0.3 });
    outer.step({ ...gas, buoyancy: 0.15 });
    moveFlames();
    expose(exposure);
    world.burn(STEP, exposure);
    world.updateSparks(STEP, flowAt);
    for (const item of world.items) {
      if (!item.burning || random() > flameStrength(item) * 0.12) continue;
      const point = { x: item.a.x + (item.b.x - item.a.x) * random(), y: Math.min(item.a.y, item.b.y) };
      world.burst(point.x, screenY(point.y, (item.a.z + item.b.z) / 2) - item.r, 1, 0.5);
    }
  }

  for (let i = 0; i < 60; i++) advance(true);
  for (let i = 0; i < 24; i++) advance();

  // highlight: id of an item to outline, such as the one under the pointer.
  function render(highlight = 0) {
    const time = steps * STEP;
    const solids = [...world.items, ...world.statics];
    let count = 0;
    cellsZ.fill(Infinity);
    solids.forEach((item, k) =>
      raster(item, 0, 0, SCENE.pixel, CELLS_W, CELLS_H, 0, (gx, gy, s, v, z, distance, i, len) => {
        if (z >= cellsZ[i]) return;
        if (cellsZ[i] === Infinity) touched[count++] = i;
        cellsZ[i] = z;
        cellItem[i] = k;
        cellS[i] = s;
        cellV[i] = v;
        cellAlong[i] = distance;
        cellLength[i] = len;
      })
    );
    occluders.fill(-Infinity);
    for (let n = 0; n < count; n++) {
      const i = touched[n];
      if (cellsZ[i] < 0 || solids[cellItem[i]].static) continue;
      const j = ((i / CELLS_W) >> 1) * LIGHT_W + (i % CELLS_W >> 1);
      if (cellsZ[i] > occluders[j]) occluders[j] = cellsZ[i];
    }
    const outerLights = outer.active > 0 ? findLights(outer, -20, 4, 4) : [];
    if (world.match) outerLights.push({ ...world.match, power: 0.35 });
    output = lightField(light, { surfaces, inner: findLights(inner, HEARTH.depth / 2), outer: outerLights, occluders, candle: true, time });

    const layers = { back: [], bed: [], flames: [], front: [], room: [], outer: [], sparks: [] };
    innerGrid.fill(0);
    outerGrid.fill(0);
    flameZ.fill(Infinity);
    for (const root of roots.values()) root.fill(0);
    for (const parcel of flames) splat(parcel.inner ? innerGrid : outerGrid, parcel);
    attach(innerGrid);
    attach(outerGrid);
    for (const [grid, list] of [
      [innerGrid, layers.flames],
      [outerGrid, layers.outer],
    ]) {
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] >= FLAME_EDGE) list.push(i % CELLS_W, Math.floor(i / CELLS_W), FIRE_COLORS[heatIndex(grid[i])]);
      }
    }
    for (let n = 0; n < count; n++) {
      const i = touched[n];
      const gx = i % CELLS_W;
      const gy = (i / CELLS_W) | 0;
      const item = solids[cellItem[i]];
      const color = itemColor(item, cellS[i], cellV[i], cellAlong[i], cellLength[i], lightAt(light, gx * 2 + 1, gy * 2 + 1), time, gx, gy);
      if (!color) continue;
      const z = cellsZ[i];
      // Wood behind the flame in this cell shows through only where the flame is thin.
      const behind = innerGrid[i] >= FLAME_EDGE && flameZ[i] < z;
      (z < 0 ? layers.room : behind ? layers.back : layers.front).push(gx, gy, color);
    }
    layers.outline = [];
    if (highlight) {
      outlined.fill(0);
      for (let n = 0; n < count; n++) if (solids[cellItem[touched[n]]].id === highlight) outlined[touched[n]] = 1;
      for (let n = 0; n < count; n++) {
        const i = touched[n];
        if (outlined[i] !== 1) continue;
        const gx = i % CELLS_W;
        for (const j of [i - CELLS_W, i + CELLS_W, gx > 0 ? i - 1 : -1, gx < CELLS_W - 1 ? i + 1 : -1]) {
          if (j < 0 || j >= outlined.length || outlined[j]) continue;
          outlined[j] = 2;
          layers.outline.push(j % CELLS_W, Math.floor(j / CELLS_W), HIGHLIGHT);
        }
      }
    }
    const left = HEARTH.left / SCENE.pixel;
    const floorRow = Math.floor(HEARTH.floor / SCENE.pixel);
    for (let c = 0; c < EMBER_COLUMNS; c++) {
      const glow = world.embers[c];
      const ash = world.ash[c];
      if (glow < 0.02 && ash < 0.03) continue;
      const height = 1 + Math.round(glow * 2.5 + ash * 1.5);
      for (let k = 0; k < height; k++) {
        if (k === height - 1 && k > 0 && hash(c, 11 + k) > 0.6) continue;
        const heat = glow * (0.35 + 0.65 * noise(c * 0.7 + k * 3, time * 0.9)) * (k ? 0.8 : 1);
        const level = clamp(Math.floor(lightAt(light, (left + c) * 2, (floorRow - k) * 2) * 3), 0, 2);
        layers.bed.push(left + c, floorRow - k, heat > 0.18 ? FIRE_COLORS[Math.min(5, 1 + Math.floor((heat - 0.18) * 7))] : ASH[level]);
      }
    }
    for (const spark of world.sparks) {
      const left = 1 - spark.age / spark.life;
      layers.sparks.push(Math.floor(spark.x / 2), Math.floor(spark.y / 2), FIRE_COLORS[left > 0.7 ? 8 : left > 0.45 ? 6 : left > 0.25 ? 4 : 2]);
    }
    layers.light = light;
    return layers;
  }

  // A parcel paints a soft disc, hotter ones larger, plus its path since the last step.
  function splat(grid, parcel) {
    const radius = 0.7 + parcel.heat * 1.7;
    const moved = Math.hypot(parcel.x - parcel.px, parcel.y - parcel.py) / SCENE.pixel;
    const samples = Math.min(4, Math.ceil(moved / radius));
    for (let k = 0; k <= samples; k++) {
      const f = samples ? k / samples : 1;
      const cx = (parcel.px + (parcel.x - parcel.px) * f) / SCENE.pixel;
      const cy = (parcel.py + (parcel.y - parcel.py) * f) / SCENE.pixel;
      const heat = parcel.heat * (0.8 + 0.2 * f);
      for (let gy = Math.max(0, Math.floor(cy - radius)); gy <= Math.min(CELLS_H - 1, Math.floor(cy + radius)); gy++) {
        for (let gx = Math.max(0, Math.floor(cx - radius)); gx <= Math.min(CELLS_W - 1, Math.floor(cx + radius)); gx++) {
          const d = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) / radius;
          if (d >= 1) continue;
          const i = gy * CELLS_W + gx;
          const value = heat * (1 - d * d);
          grid[i] = Math.min(1, Math.max(grid[i], value) + value * 0.08);
          if (value > FLAME_EDGE && parcel.z < flameZ[i]) flameZ[i] = parcel.z;
          if (value > FLAME_EDGE && parcel.age < 3) roots.get(grid)[i] = 1;
        }
      }
    }
  }

  // A flame stays joined to its fuel. Only near a tongue's tip do pockets break
  // away, and those burn out within a few frames; nothing floats free above the fire.
  function attach(grid) {
    const root = roots.get(grid);
    attached.fill(0);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < grid.length; i++) {
      if (root[i] && grid[i] >= FLAME_EDGE) {
        attached[i] = 1;
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const i = queue[head++];
      const gx = i % CELLS_W;
      for (const j of [i - CELLS_W, i + CELLS_W, gx > 0 ? i - 1 : -1, gx < CELLS_W - 1 ? i + 1 : -1]) {
        if (j < 0 || j >= grid.length || attached[j] || grid[j] < FLAME_EDGE) continue;
        attached[j] = 1;
        queue[tail++] = j;
      }
    }
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] < FLAME_EDGE || attached[i]) continue;
      const gx = i % CELLS_W;
      const gy = Math.floor(i / CELLS_W);
      let near = false;
      for (let d = 1; d <= POCKET_REACH && !near && gy + d < CELLS_H; d++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = gx + dx;
          if (x >= 0 && x < CELLS_W && attached[(gy + d) * CELLS_W + x]) near = true;
        }
      }
      // A breakaway pocket keeps its color until it is gone, rather than dimming into a red puff.
      grid[i] = near && heatIndex(grid[i]) >= 3 ? grid[i] : 0;
    }
  }

  const snapshot = (item) => ({
    id: item.id,
    kind: item.kind,
    a: { x: item.a.x, y: item.a.y, z: item.a.z },
    b: { x: item.b.x, y: item.b.y, z: item.b.z },
    r: item.r,
    length: item.length,
    mass: item.mass,
    char: item.char,
    temp: item.temp,
    burning: item.burning,
    inHearth: inHearth(item),
    fire: Array.from(item.fire),
    heat: Array.from(item.heat),
  });

  return {
    options,
    step(dt) {
      pending = Math.min(pending + Math.max(0, dt), STEP * 4);
      while (pending >= STEP) {
        pending -= STEP;
        advance();
      }
    },
    render,
    stats: () => ({
      output,
      items: world.items.length,
      burning: world.items.filter((item) => item.burning).length,
      embers: world.embers.reduce((sum, value) => sum + value, 0) / EMBER_COLUMNS,
      sparks: world.sparks.length,
      outside: outer.active > 0,
    }),
    items: () => world.items.map(snapshot),
    heat: () => Float32Array.from(inner.t),
    outerHeat: () => Float32Array.from(outer.t),
    // What the pointer is over: an item (with its id) or a supply to take from.
    hover(x, y) {
      const hit = world.hitTest(x, y);
      if (hit) return { type: "item", id: hit.item.id, kind: hit.item.kind };
      const supply = world.supplyAt(x, y);
      return supply ? { type: "supply", kind: supply } : null;
    },
    held: () => world.grab?.item.id ?? 0,
    grab: (x, y) => world.grabAt(x, y),
    drag: (x, y) => world.dragTo(x, y),
    release: () => world.release(),
    holding: () => !!world.grab,
    match: () => (world.match ? { x: world.match.x, y: world.match.y, life: world.match.life } : null),
    strike: (x, y) => world.strike(x, y),
    drop: (kind) => !!world.drop(kind),
    lightHearth: () => world.strike(HEARTH.center, HEARTH.floor - 6),
  };
}
