// assets/js/terrarium/scenes/particles.js
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 400;
    this.vy = (Math.random() - 0.5) * 400;
    this.r = 4 + Math.random() * 6;
  }
}

export const particlesScene = {
  id: "particles",
  init({ canvas, ctx, size }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.params = {
      gravity: 900, // px/s^2 in device pixels
      bounce: 0.75,
      drag: 0.999,
      maxParticles: 400,
    };
    this.particles = [];
    this.reset(size);

    this.onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      if (this.particles.length < this.params.maxParticles) {
        this.particles.push(new Particle(x, y));
      }
    };
    canvas.addEventListener("pointerdown", this.onPointer);
  },
  reset(size, count = 120) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(Math.random() * size.w, Math.random() * size.h));
    }
  },
  update(dt, { w, h }) {
    for (const p of this.particles) {
      p.vy += this.params.gravity * dt;
      p.vx *= this.params.drag;
      p.vy *= this.params.drag;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < p.r) {
        p.x = p.r;
        p.vx = Math.abs(p.vx) * this.params.bounce;
      }
      if (p.x > w - p.r) {
        p.x = w - p.r;
        p.vx = -Math.abs(p.vx) * this.params.bounce;
      }
      if (p.y < p.r) {
        p.y = p.r;
        p.vy = Math.abs(p.vy) * this.params.bounce;
      }
      if (p.y > h - p.r) {
        p.y = h - p.r;
        p.vy = -Math.abs(p.vy) * this.params.bounce;
      }
    }
  },
  render({ w, h }) {
    this.ctx.fillStyle = "rgba(15,15,18,0.25)";
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = "rgba(220,220,235,0.9)";
    for (const p of this.particles) {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  },
  destroy() {
    if (this.onPointer) {
      this.canvas.removeEventListener("pointerdown", this.onPointer);
    }
  },
};
