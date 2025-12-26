// assets/js/terrarium/scenes/creatures.js
export const creaturesScene = {
  id: "creatures",
  init({ ctx, size }) {
    this.ctx = ctx;
    this.time = 0;
    this.seed = Math.random() * 1000;
    this.size = size;
  },
  update(dt, { w, h }) {
    this.time += dt;
    this.size = { w, h };
  },
  render({ w, h }) {
    this.ctx.fillStyle = "rgba(12,14,18,0.35)";
    this.ctx.fillRect(0, 0, w, h);

    const count = 20;
    for (let i = 0; i < count; i++) {
      const t = this.time * 0.6 + i * 0.4 + this.seed;
      const x = w * 0.5 + Math.cos(t * 1.3) * (w * 0.32) + Math.cos(t * 3.1) * 40;
      const y = h * 0.5 + Math.sin(t * 1.1) * (h * 0.28) + Math.sin(t * 2.7) * 30;
      const r = 6 + 4 * Math.sin(t * 2.2);

      this.ctx.beginPath();
      this.ctx.fillStyle = `rgba(140, 210, 255, ${0.2 + 0.6 * Math.sin(t * 0.9)})`;
      this.ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
      this.ctx.fill();
    }
  },
};
