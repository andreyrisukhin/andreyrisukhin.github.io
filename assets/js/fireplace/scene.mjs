// Shared scene geometry, in canvas pixels. The world is a shallow 3D box seen
// from the front: x right, y down, z into the firebox. Depth lifts things on screen.
export const SCENE = Object.freeze({ width: 480, height: 320, pixel: 2 });
export const HEARTH = Object.freeze({ left: 158, right: 322, floor: 251, depth: 80, center: 240, archY: 160, archRise: 48, archHalf: 82 });
export const ROOM_FLOOR = 269;
export const DEPTH_LIFT = 0.15;
export const ROOM_DEPTH = -340;
export const GRATE = Object.freeze({ z: 6, left: 172, right: 308, top: 233, spacing: 13.6, radius: 1.6 });

export function archTopAt(x) {
  const dx = (x - HEARTH.center) / HEARTH.archHalf;
  if (Math.abs(dx) >= 1) return HEARTH.archY;
  return HEARTH.archY - HEARTH.archRise * Math.sqrt(1 - dx * dx);
}

export function insideOpening(x, y) {
  return x >= HEARTH.left && x <= HEARTH.right && y >= archTopAt(x) && y <= HEARTH.floor;
}

// The firebox floor runs out onto the hearth lip, then steps down twice to the room.
export function floorAt(x, z) {
  if (z >= -7 && x >= 125 && x <= 356) return HEARTH.floor;
  if (z >= -14 && x >= 116 && x <= 365) return 260;
  return ROOM_FLOOR;
}

export const screenY = (y, z) => y - z * DEPTH_LIFT;

export const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);

export function hash(x, y) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
  const b = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + b * sy;
}

export function generator(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
