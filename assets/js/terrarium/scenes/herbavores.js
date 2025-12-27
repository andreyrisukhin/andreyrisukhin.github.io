// assets/js/terrarium/scenes/herbavores.js
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function length(vec) {
  return Math.hypot(vec.x, vec.y);
}

function normalize(vec) {
  const len = length(vec) || 1;
  return { x: vec.x / len, y: vec.y / len };
}

export function createHerbavoresScene() {
  return {
    id: "herbavores",
    init({ ctx, size }) {
      this.ctx = ctx;
      this.size = size;
      this.time = 0;
      this.food = [];
      this.herbavores = [];
      this.occupancy = new Float32Array(60 * 34);
      this.occupancyW = 60;
      this.occupancyH = 34;
      this.lastSpawnT = 0;
      this.params = {
        hungerRate: 0.04,
        vision: 220,
        maxSpeed: 120,
        accelRate: 2.8,
        brakeRate: 7.5,
        foodSpawnChance: 0.08,
        reproCooldown: 18,
        lifespan: 140,
      };

      const initial = 12;
      for (let i = 0; i < initial; i++) {
        this.herbavores.push(this.createHerbavore(size));
      }
    },
    createHerbavore(size) {
      return {
        x: randRange(0, size.w),
        y: randRange(0, size.h),
        vx: randRange(-40, 40),
        vy: randRange(-40, 40),
        hunger: randRange(0.2, 0.6),
        age: randRange(0, 15),
        sociabilityBase: randRange(0.2, 0.9),
        sociability: 0.5,
        crowdedTime: 0,
        lastRepro: -999,
        lastEat: -999,
      };
    },
    setParams(next) {
      this.params = { ...this.params, ...next };
    },
    updateOccupancy(dt, size) {
      const decay = Math.exp(-dt * 0.35);
      for (let i = 0; i < this.occupancy.length; i++) {
        this.occupancy[i] *= decay;
      }
      for (const h of this.herbavores) {
        const x = Math.floor((h.x / size.w) * this.occupancyW);
        const y = Math.floor((h.y / size.h) * this.occupancyH);
        if (x >= 0 && x < this.occupancyW && y >= 0 && y < this.occupancyH) {
          this.occupancy[y * this.occupancyW + x] = 1;
        }
      }
    },
    trySpawnFood(dt, size) {
      if (this.time - this.lastSpawnT < 0.2) return;
      this.lastSpawnT = this.time;

      const baseChance = this.params.foodSpawnChance;
      if (Math.random() > baseChance) return;

      const x = randRange(0, size.w);
      const y = randRange(0, size.h);
      const gx = Math.floor((x / size.w) * this.occupancyW);
      const gy = Math.floor((y / size.h) * this.occupancyH);
      if (gx < 0 || gx >= this.occupancyW || gy < 0 || gy >= this.occupancyH) return;
      const occ = this.occupancy[gy * this.occupancyW + gx];
      const quiet = occ < 0.2;
      if (!quiet) return;

      const food = {
        x,
        y,
        age: 0,
        size: randRange(3, 6),
      };
      this.food.push(food);
    },
    findNearestFood(herb, visionSq) {
      let best = null;
      let bestD = Infinity;
      for (const f of this.food) {
        const d = distSq(herb, f);
        if (d < visionSq && d < bestD) {
          best = f;
          bestD = d;
        }
      }
      return best;
    },
    update(dt, size) {
      this.time += dt;
      this.size = size;

      this.updateOccupancy(dt, size);
      this.trySpawnFood(dt, size);

      const hungerRate = this.params.hungerRate;
      const reproCooldown = this.params.reproCooldown;
      const hungerThreshold = 0.45;
      const vision = this.params.vision;
      const maxSpeed = this.params.maxSpeed;

      for (const food of this.food) {
        food.age += dt;
      }

      for (const herb of this.herbavores) {
        const reproPenalty = this.time - herb.lastRepro < 8 ? 1.6 : 1;
        herb.hunger = clamp(herb.hunger + hungerRate * reproPenalty * dt, 0, 1);
        herb.age += dt;
        const hungry = herb.hunger > hungerThreshold;
        const foodMood = clamp(1 - herb.hunger, 0, 1);
        const recentlyFed = clamp(1 - (this.time - herb.lastEat) / 6, 0, 1);
        herb.sociability = clamp(herb.sociabilityBase + 0.25 * foodMood + 0.15 * recentlyFed, 0, 1);
        herb.crowdedTime = Math.max(0, herb.crowdedTime - dt);

        const visionSq = vision * vision;
        const target = this.findNearestFood(herb, visionSq);

        const steer = { x: 0, y: 0 };
        if (target && hungry) {
          const dir = normalize({ x: target.x - herb.x, y: target.y - herb.y });
          steer.x += dir.x * 80;
          steer.y += dir.y * 80;
        } else {
          steer.x += Math.cos(this.time * 0.8 + herb.x * 0.005) * 15;
          steer.y += Math.sin(this.time * 0.7 + herb.y * 0.005) * 15;
        }

        let separationScale = hungry ? 90 : 35;
        let cohesionScale = hungry ? 10 : 35;
        let neighbors = 0;
        const center = { x: 0, y: 0 };

        for (const other of this.herbavores) {
          if (other === herb) continue;
          const d2 = distSq(herb, other);
          if (d2 < 160 * 160) {
            neighbors += 1;
            center.x += other.x;
            center.y += other.y;
            if (d2 < 40 * 40) {
              const away = normalize({ x: herb.x - other.x, y: herb.y - other.y });
              const strength = separationScale * (1 - Math.sqrt(d2) / 40);
              steer.x += away.x * strength;
              steer.y += away.y * strength;
            }
          }
        }

        const crowdThreshold = 4;
        if (neighbors > crowdThreshold && herb.sociability < 0.55) {
          herb.crowdedTime = Math.max(herb.crowdedTime, 4 + (0.6 - herb.sociability) * 6);
        }

        if (neighbors > 0) {
          center.x /= neighbors;
          center.y /= neighbors;
          const toCenter = normalize({ x: center.x - herb.x, y: center.y - herb.y });
          if (herb.crowdedTime > 0) {
            const away = { x: -toCenter.x, y: -toCenter.y };
            steer.x += away.x * 55;
            steer.y += away.y * 55;
          } else {
            const socialBoost = herb.sociability * 25;
            steer.x += toCenter.x * (cohesionScale + socialBoost);
            steer.y += toCenter.y * (cohesionScale + socialBoost);
          }
        }

        const steerMag = length(steer);
        let desiredVx = 0;
        let desiredVy = 0;
        if (steerMag > 0.0001) {
          const desiredSpeed = Math.min(maxSpeed, steerMag);
          desiredVx = (steer.x / steerMag) * desiredSpeed;
          desiredVy = (steer.y / steerMag) * desiredSpeed;
        }

        const currentSpeed = Math.hypot(herb.vx, herb.vy);
        const desiredSpeed = Math.hypot(desiredVx, desiredVy);
        const rate = desiredSpeed < currentSpeed ? this.params.brakeRate : this.params.accelRate;
        const lerp = Math.min(1, rate * dt);
        herb.vx += (desiredVx - herb.vx) * lerp;
        herb.vy += (desiredVy - herb.vy) * lerp;

        herb.x += herb.vx * dt;
        herb.y += herb.vy * dt;

        if (herb.x < 8) {
          herb.x = 8;
          herb.vx *= -0.6;
        }
        if (herb.x > size.w - 8) {
          herb.x = size.w - 8;
          herb.vx *= -0.6;
        }
        if (herb.y < 8) {
          herb.y = 8;
          herb.vy *= -0.6;
        }
        if (herb.y > size.h - 8) {
          herb.y = size.h - 8;
          herb.vy *= -0.6;
        }

        for (let i = this.food.length - 1; i >= 0; i--) {
          const f = this.food[i];
          if (distSq(herb, f) < (10 + f.size) * (10 + f.size)) {
            this.food.splice(i, 1);
            herb.hunger = clamp(herb.hunger - 0.5, 0, 1);
            herb.crowdedTime = Math.max(0, herb.crowdedTime - 2.5);
            herb.lastEat = this.time;
            break;
          }
        }
      }

      for (let i = this.herbavores.length - 1; i >= 0; i--) {
        if (this.herbavores[i].age > this.params.lifespan) {
          this.herbavores.splice(i, 1);
        }
      }

      for (let i = 0; i < this.herbavores.length; i++) {
        const a = this.herbavores[i];
        for (let j = i + 1; j < this.herbavores.length; j++) {
          const b = this.herbavores[j];
          const close = distSq(a, b) < 28 * 28;
          const aReady = a.hunger < hungerThreshold && this.time - a.lastRepro > reproCooldown;
          const bReady = b.hunger < hungerThreshold && this.time - b.lastRepro > reproCooldown;
          if (close && aReady && bReady && Math.random() < 0.08) {
            const child = this.createHerbavore(size);
            child.x = (a.x + b.x) / 2;
            child.y = (a.y + b.y) / 2;
            child.hunger = 0.5;
            const inherited = (a.sociabilityBase + b.sociabilityBase) / 2;
            child.sociabilityBase = clamp(inherited + randRange(-0.08, 0.08), 0.1, 0.95);
            this.herbavores.push(child);
            a.lastRepro = this.time;
            b.lastRepro = this.time;
            a.hunger = clamp(a.hunger + 0.1, 0, 1);
            b.hunger = clamp(b.hunger + 0.1, 0, 1);
            break;
          }
        }
      }
    },
    render({ w, h }) {
      this.ctx.fillStyle = "rgba(10, 12, 16, 0.35)";
      this.ctx.fillRect(0, 0, w, h);

      for (const f of this.food) {
        const alpha = clamp(f.age / 6, 0.1, 0.9);
        this.ctx.fillStyle = `rgba(110, 255, 140, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        this.ctx.fill();
      }

      for (const herb of this.herbavores) {
        const hunger = herb.hunger;
        const ready = hunger < 0.45 && this.time - herb.lastRepro > this.params.reproCooldown;
        const baseR = 8;
        const color = {
          r: Math.floor(120 + hunger * 120),
          g: Math.floor(200 - hunger * 100),
          b: Math.floor(160 - hunger * 60),
        };
        this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.beginPath();
        this.ctx.arc(herb.x, herb.y, baseR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = ready ? "rgba(255, 220, 120, 0.9)" : "rgba(255,255,255,0.15)";
        this.ctx.lineWidth = ready ? 2 : 1;
        this.ctx.beginPath();
        this.ctx.arc(herb.x, herb.y, baseR + 4, 0, Math.PI * 2);
        this.ctx.stroke();

        const ageRatio = clamp(herb.age / this.params.lifespan, 0, 1);
        this.ctx.strokeStyle = `rgba(255,255,255,${0.15 + ageRatio * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(herb.x, herb.y, baseR + 7, -Math.PI / 2, -Math.PI / 2 + ageRatio * Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.fillStyle = "rgba(255,255,255,0.7)";
      this.ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
      this.ctx.fillText(`food: ${this.food.length}`, 16, h - 16);
      this.ctx.fillText(`herbavores: ${this.herbavores.length}`, 100, h - 16);
    },
  };
}

export const herbavoresScene = createHerbavoresScene();

export function createHerbavoresSimulation({ params = {}, size = { w: 900, h: 520 }, initial = 12, state = null } = {}) {
  const scene = createHerbavoresScene();
  scene.init({ ctx: null, size });
  scene.setParams({ ...scene.params, ...params });
  if (state) {
    scene.time = state.time || 0;
    scene.params = { ...scene.params, ...state.params };
    scene.food = (state.food || []).map((f) => ({ ...f }));
    scene.herbavores = (state.herbavores || []).map((h) => ({ ...h }));
  } else if (Number.isFinite(initial)) {
    scene.herbavores = [];
    for (let i = 0; i < initial; i++) {
      scene.herbavores.push(scene.createHerbavore(size));
    }
  }
  return {
    step(dt) {
      scene.update(dt, size);
    },
    getPopulation() {
      return scene.herbavores.length;
    },
    getFoodCount() {
      return scene.food.length;
    },
    getState() {
      return scene;
    },
  };
}
