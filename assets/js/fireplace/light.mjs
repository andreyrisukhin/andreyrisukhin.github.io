// Light comes only from hot gas, embers, the candle, and a struck match.
// Inside the firebox, rays are marched toward each light through the items
// behind it, so logs throw shadows on the brick. Light reaches the room floor
// only through the hearth opening and between the grate bars.
import { DEPTH_LIFT, GRATE, HEARTH, ROOM_FLOOR, SCENE, insideOpening } from "./scene.mjs";

export const LIGHT_CELL = 4;
export const LIGHT_W = SCENE.width / LIGHT_CELL;
export const LIGHT_H = SCENE.height / LIGHT_CELL;
export const SURFACE = Object.freeze({ FACE: 0, INTERIOR: 1, FLOOR: 2 });
export const CANDLE = Object.freeze({ x: 155, y: 42 });

export function surfaceMap() {
  const map = new Uint8Array(LIGHT_W * LIGHT_H);
  for (let gy = 0; gy < LIGHT_H; gy++) {
    for (let gx = 0; gx < LIGHT_W; gx++) {
      const x = (gx + 0.5) * LIGHT_CELL;
      const y = (gy + 0.5) * LIGHT_CELL;
      let type = SURFACE.FACE;
      if (insideOpening(x, y) && y < HEARTH.floor) type = SURFACE.INTERIOR;
      else if (y >= ROOM_FLOOR || (y >= 251 && y < 255 && x >= 125 && x <= 356) || (y >= 260 && y < 264 && x >= 116 && x <= 365)) {
        type = SURFACE.FLOOR;
      }
      map[gy * LIGHT_W + gx] = type;
    }
  }
  return map;
}

// The hottest regions of a fluid become point lights at their heat centroid.
export function findLights(fluid, z, count = 7, bin = 8) {
  const bins = [];
  for (let by = 0; by < fluid.h; by += bin) {
    for (let bx = 0; bx < fluid.w; bx += bin) {
      let sum = 0;
      let sx = 0;
      let sy = 0;
      for (let gy = by; gy < Math.min(fluid.h, by + bin); gy++) {
        for (let gx = bx; gx < Math.min(fluid.w, bx + bin); gx++) {
          const t = fluid.t[gy * fluid.w + gx];
          if (t < 0.08) continue;
          const weight = t * t * fluid.cell * fluid.cell;
          sum += weight;
          sx += weight * gx;
          sy += weight * gy;
        }
      }
      if (sum > 2) bins.push({ x: fluid.x + (sx / sum + 0.5) * fluid.cell, y: fluid.y + (sy / sum + 0.5) * fluid.cell, z, power: sum });
    }
  }
  bins.sort((a, b) => b.power - a.power);
  return bins.slice(0, count).map((light) => ({ ...light, power: Math.min(1.6, light.power / 110) }));
}

function throughOpening(light, x, y, z) {
  const ly = light.y + light.z * DEPTH_LIFT;
  for (const plane of [GRATE.z, 0]) {
    const t = (light.z - plane) / (light.z - z);
    if (t <= 0 || t >= 1) continue;
    const cx = light.x + (x - light.x) * t;
    const cy = ly + (y - ly) * t;
    if (plane === 0 && (!insideOpening(cx, cy) || cy > HEARTH.floor)) return false;
    if (plane === GRATE.z && cx >= GRATE.left - 2 && cx <= GRATE.right + 2 && cy >= GRATE.top - GRATE.radius) {
      const along = (cx - GRATE.left) % GRATE.spacing;
      if (Math.min(along, GRATE.spacing - along) < GRATE.radius + 0.4) return false;
      if (Math.abs(cy - GRATE.top) < GRATE.radius + 0.4 || Math.abs(cy - GRATE.top - 9) < GRATE.radius + 0.4) return false;
    }
  }
  return true;
}

// occluders: farthest depth of an item covering each light cell (-Infinity when empty).
export function lightField(out, { surfaces, inner, outer, occluders, candle, time }) {
  const innerTotal = inner.reduce((sum, light) => sum + light.power, 0);
  const ambient = 0.17 + 0.04 * Math.min(3, innerTotal);
  for (let gy = 0; gy < LIGHT_H; gy++) {
    for (let gx = 0; gx < LIGHT_W; gx++) {
      const i = gy * LIGHT_W + gx;
      const x = (gx + 0.5) * LIGHT_CELL;
      const y = (gy + 0.5) * LIGHT_CELL;
      const type = surfaces[i];
      let light = ambient;
      if (type === SURFACE.INTERIOR) {
        for (const source of inner) {
          const dx = x - source.x;
          const dy = y - source.y;
          const distance = Math.hypot(dx, dy);
          let shade = 1;
          const steps = Math.floor(distance / LIGHT_CELL);
          for (let step = 2; step < steps; step++) {
            const f = step / steps;
            const cx = Math.floor((source.x + dx * f) / LIGHT_CELL);
            const cy = Math.floor((source.y + dy * f) / LIGHT_CELL);
            const j = cy * LIGHT_W + cx;
            if (j !== i && occluders[j] > source.z - 6) {
              shade = 0.18;
              break;
            }
          }
          light += (source.power * shade) / (1 + (distance * distance) / 1600);
        }
      } else if (type === SURFACE.FLOOR) {
        const floorY = y >= ROOM_FLOOR ? ROOM_FLOOR : y >= 260 ? 260 : HEARTH.floor;
        const z = y >= ROOM_FLOOR ? Math.min(-14, -(y - ROOM_FLOOR) / DEPTH_LIFT) : y >= 260 ? -10 : -3;
        for (const source of inner) {
          if (!throughOpening(source, x, floorY, z)) continue;
          const ly = source.y + source.z * DEPTH_LIFT;
          const distance = Math.hypot(x - source.x, floorY - ly, z - source.z);
          const facing = Math.max(0, (floorY - ly) / distance);
          light += (source.power * 2.4 * facing) / (1 + (distance * distance) / 9000);
        }
      } else if (insideOpening(x, y + 8) || insideOpening(x - 8, y) || insideOpening(x + 8, y)) {
        // The arch reveal catches a little light from the fire.
        light += innerTotal * 0.12;
      }
      if (type !== SURFACE.INTERIOR) {
        for (const source of outer) {
          const distance = Math.hypot(x - source.x, y - source.y);
          light += source.power / (1 + (distance * distance) / 2500);
        }
      }
      if (candle && y < 80 && type === SURFACE.FACE) {
        const distance = Math.hypot(x - CANDLE.x, y - CANDLE.y);
        const flicker = 0.92 + 0.08 * Math.sin(time * 7.3) * Math.sin(time * 3.1);
        light += (0.5 * flicker) / (1 + (distance * distance) / 160);
      }
      out[i] = out[i] * 0.4 + light * 0.6;
    }
  }
  return innerTotal;
}

export function lightAt(field, x, y) {
  const gx = Math.min(LIGHT_W - 1.001, Math.max(0, x / LIGHT_CELL - 0.5));
  const gy = Math.min(LIGHT_H - 1.001, Math.max(0, y / LIGHT_CELL - 0.5));
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const i = y0 * LIGHT_W + x0;
  const j = Math.min(i + LIGHT_W, field.length - 2);
  return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) + (field[j] * (1 - fx) + field[j + 1] * fx) * fy;
}
