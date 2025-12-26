// assets/js/terrarium/core/engine.js
export function createEngine(canvas, { onFps } = {}) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Terrarium canvas context not available.");

  const state = {
    paused: false,
    scene: null,
    fixedDt: 1 / 120,
    accumulator: 0,
    lastT: performance.now(),
    fpsAcc: 0,
    fpsN: 0,
    fpsLast: performance.now(),
    size: { w: 0, h: 0, dpr: 1 },
  };

  function resizeCanvasToDisplaySize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    state.size = { w, h, dpr };
    return state.size;
  }

  function setScene(scene) {
    if (state.scene?.destroy) state.scene.destroy();
    resizeCanvasToDisplaySize();
    state.scene = scene;
    state.scene.init({
      canvas,
      ctx,
      size: state.size,
      dpr: state.size.dpr,
    });
    state.accumulator = 0;
  }

  function resetScene() {
    if (!state.scene) return;
    setScene(state.scene);
  }

  function togglePause() {
    state.paused = !state.paused;
    return state.paused;
  }

  function loop(t) {
    const { w, h } = resizeCanvasToDisplaySize();
    const frameDt = Math.min(0.05, (t - state.lastT) / 1000);
    state.lastT = t;

    if (!state.paused && state.scene) {
      state.accumulator += frameDt;
      while (state.accumulator >= state.fixedDt) {
        state.scene.update(state.fixedDt, { w, h });
        state.accumulator -= state.fixedDt;
      }
    }

    if (state.scene) {
      state.scene.render({ w, h });
    }

    state.fpsAcc += frameDt;
    state.fpsN += 1;
    if (t - state.fpsLast > 500) {
      const fps = state.fpsN / state.fpsAcc;
      if (onFps) onFps(fps);
      state.fpsAcc = 0;
      state.fpsN = 0;
      state.fpsLast = t;
    }

    requestAnimationFrame(loop);
  }

  function start() {
    resizeCanvasToDisplaySize();
    ctx.fillStyle = "rgb(15,15,18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.addEventListener("visibilitychange", () => {
      state.paused = document.hidden;
    });
    requestAnimationFrame(loop);
  }

  return {
    start,
    setScene,
    resetScene,
    togglePause,
  };
}
