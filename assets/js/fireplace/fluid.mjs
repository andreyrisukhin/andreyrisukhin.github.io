// A small stable-fluids solver (Stam 1999) for hot gas: semi-Lagrangian
// advection, buoyancy from temperature, vorticity confinement, and a pressure
// projection that keeps the flow incompressible. Velocities are cells per step.
import { noise } from "./scene.mjs";

export class Fluid {
  constructor({ x, y, cell, width, height, solid = () => false, sink = () => 0 }) {
    Object.assign(this, { x, y, cell, w: width, h: height });
    const n = width * height;
    for (const name of ["u", "v", "t", "u2", "v2", "t2", "p", "div", "curl", "sinks"]) this[name] = new Float32Array(n);
    this.wall = new Uint8Array(n);
    this.block = new Uint8Array(n);
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        const px = x + (gx + 0.5) * cell;
        const py = y + (gy + 0.5) * cell;
        this.wall[gy * width + gx] = solid(px, py) ? 1 : 0;
        this.sinks[gy * width + gx] = sink(px, py);
      }
    }
    this.block.set(this.wall);
    this.active = 0;
  }

  cellAt(px, py) {
    const gx = Math.floor((px - this.x) / this.cell);
    const gy = Math.floor((py - this.y) / this.cell);
    return gx < 0 || gy < 0 || gx >= this.w || gy >= this.h ? -1 : gy * this.w + gx;
  }

  // Bilinear sample at cell coordinates; cell centers sit on integers.
  sample(field, gx, gy, open = false) {
    const { w, h } = this;
    if (open && (gy < -0.5 || gx < -0.5 || gx > w - 0.5)) return 0;
    gx = Math.min(w - 1, Math.max(0, gx));
    gy = Math.min(h - 1, Math.max(0, gy));
    const x0 = Math.min(w - 2, Math.floor(gx));
    const y0 = Math.min(h - 2, Math.floor(gy));
    const fx = gx - x0;
    const fy = gy - y0;
    const i = y0 * w + x0;
    return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) + (field[i + w] * (1 - fx) + field[i + w + 1] * fx) * fy;
  }

  temperatureAt(px, py) {
    return this.sample(this.t, (px - this.x) / this.cell - 0.5, (py - this.y) / this.cell - 0.5, true);
  }

  add(i, temperature, kick) {
    if (i < 0 || this.block[i]) return;
    if (temperature > this.t[i]) this.t[i] = temperature;
    if (-kick < this.v[i]) this.v[i] = -kick;
    this.active = 48;
  }

  step({ buoyancy, vorticity, cooling, decay, sway, wind, time, salt }) {
    if (this.active <= 0) return;
    const { w, h, u, v, t, block, curl } = this;
    const scale = this.cell * 0.035;
    for (let gy = 0; gy < h; gy++) {
      for (let gx = 0; gx < w; gx++) {
        const i = gy * w + gx;
        if (block[i]) {
          u[i] = v[i] = 0;
          continue;
        }
        v[i] -= buoyancy * t[i];
        if (t[i] > 0.02) u[i] += wind * 0.03 + sway * 0.06 * (noise(gx * scale + salt, gy * scale - time * 0.9) - 0.5);
      }
    }
    for (let gy = 1; gy < h - 1; gy++) {
      for (let gx = 1; gx < w - 1; gx++) {
        const i = gy * w + gx;
        curl[i] = 0.5 * (v[i + 1] - v[i - 1] - (u[i + w] - u[i - w]));
      }
    }
    if (vorticity > 0) {
      for (let gy = 2; gy < h - 2; gy++) {
        for (let gx = 2; gx < w - 2; gx++) {
          const i = gy * w + gx;
          if (block[i]) continue;
          const nx = 0.5 * (Math.abs(curl[i + 1]) - Math.abs(curl[i - 1]));
          const ny = 0.5 * (Math.abs(curl[i + w]) - Math.abs(curl[i - w]));
          const length = Math.hypot(nx, ny) + 1e-5;
          u[i] += vorticity * (ny / length) * curl[i];
          v[i] -= vorticity * (nx / length) * curl[i];
        }
      }
    }
    this.advect(u, this.u2, false);
    this.advect(v, this.v2, false);
    [this.u, this.u2] = [this.u2, this.u];
    [this.v, this.v2] = [this.v2, this.v];
    this.project();
    this.advect(this.t, this.t2, true);
    [this.t, this.t2] = [this.t2, this.t];
    const temp = this.t;
    let hottest = 0;
    for (let i = 0; i < w * h; i++) {
      const value = block[i] ? 0 : temp[i] * (1 - cooling - this.sinks[i]) - decay;
      temp[i] = value > 0 ? value : 0;
      if (temp[i] > hottest) hottest = temp[i];
      this.u[i] *= 0.985;
      this.v[i] *= 0.985;
    }
    this.active = hottest > 0.02 ? 48 : this.active - 1;
    if (this.active <= 0) {
      this.u.fill(0);
      this.v.fill(0);
      this.t.fill(0);
    }
  }

  advect(source, target, open) {
    const { w, h, u, v, block } = this;
    for (let gy = 0; gy < h; gy++) {
      for (let gx = 0; gx < w; gx++) {
        const i = gy * w + gx;
        if (block[i]) {
          target[i] = 0;
          continue;
        }
        const value = this.sample(source, gx - u[i], gy - v[i], open);
        target[i] = open ? value : Math.max(-8, Math.min(8, value));
      }
    }
  }

  project() {
    const { w, h, u, v, p, div, block } = this;
    const vel = (field, i, gx, gy) => (gx < 0 || gx >= w || gy >= h || (gy >= 0 && block[i]) ? 0 : gy < 0 ? field[i + w] : field[i]);
    for (let gy = 0; gy < h; gy++) {
      for (let gx = 0; gx < w; gx++) {
        const i = gy * w + gx;
        p[i] = 0;
        div[i] = block[i]
          ? 0
          : -0.5 * (vel(u, i + 1, gx + 1, gy) - vel(u, i - 1, gx - 1, gy) + vel(v, i + w, gx, gy + 1) - vel(v, i - w, gx, gy - 1));
      }
    }
    for (let iteration = 0; iteration < 18; iteration++) {
      for (let gy = 0; gy < h; gy++) {
        for (let gx = 0; gx < w; gx++) {
          const i = gy * w + gx;
          if (block[i]) continue;
          let sum = div[i];
          let open = 0;
          if (gx > 0 && !block[i - 1]) (sum += p[i - 1]), open++;
          if (gx < w - 1 && !block[i + 1]) (sum += p[i + 1]), open++;
          if (gy < h - 1 && !block[i + w]) (sum += p[i + w]), open++;
          if (gy === 0) open++;
          else if (!block[i - w]) (sum += p[i - w]), open++;
          p[i] = open ? sum / open : 0;
        }
      }
    }
    const pressure = (i, gx, gy, center) => (gy < 0 ? 0 : gx < 0 || gx >= w || gy >= h || block[i] ? center : p[i]);
    for (let gy = 0; gy < h; gy++) {
      for (let gx = 0; gx < w; gx++) {
        const i = gy * w + gx;
        if (block[i]) continue;
        u[i] -= 0.5 * (pressure(i + 1, gx + 1, gy, p[i]) - pressure(i - 1, gx - 1, gy, p[i]));
        v[i] -= 0.5 * (pressure(i + w, gx, gy + 1, p[i]) - pressure(i - w, gx, gy - 1, p[i]));
      }
    }
  }
}
