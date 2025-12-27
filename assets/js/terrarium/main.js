// assets/js/terrarium/main.js
import { createEngine } from "./core/engine.js";
import { registerScenes, getScene } from "./core/scene-registry.js";
import { particlesScene } from "./scenes/particles.js";
import { creaturesScene } from "./scenes/creatures.js";
import { herbavoresScene, createHerbavoresSimulation } from "./scenes/herbavores.js";

const canvas = document.getElementById("terrarium-canvas");
if (!canvas) {
  throw new Error("Terrarium canvas not found.");
}

registerScenes([particlesScene, creaturesScene, herbavoresScene]);

const engine = createEngine(canvas, {
  onFps: (fps) => {
    const fpsEl = document.getElementById("fps");
    if (fpsEl) fpsEl.textContent = `${fps.toFixed(0)} fps`;
  },
});

const alertEl = document.getElementById("terrarium-alert");
const panelEl = document.getElementById("terrarium-panel");
const herbControls = {
  hungerRate: document.getElementById("herb-hunger-rate"),
  hungerRateValue: document.getElementById("herb-hunger-rate-value"),
  vision: document.getElementById("herb-vision"),
  visionValue: document.getElementById("herb-vision-value"),
  maxSpeed: document.getElementById("herb-max-speed"),
  maxSpeedValue: document.getElementById("herb-max-speed-value"),
  simSpeed: document.getElementById("herb-sim-speed"),
  simSpeedValue: document.getElementById("herb-sim-speed-value"),
  foodRate: document.getElementById("herb-food-rate"),
  foodRateValue: document.getElementById("herb-food-rate-value"),
  reproCooldown: document.getElementById("herb-repro-cd"),
  reproCooldownValue: document.getElementById("herb-repro-cd-value"),
  lifespan: document.getElementById("herb-lifespan"),
  lifespanValue: document.getElementById("herb-lifespan-value"),
  simDuration: document.getElementById("herb-sim-duration"),
  simDurationValue: document.getElementById("herb-sim-duration-value"),
  simulate: document.getElementById("herb-simulate"),
  plot: document.getElementById("herb-plot"),
  togglePanel: document.getElementById("herb-toggle-panel"),
};

const simSpeedSteps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 50];

function setAlert(message) {
  if (alertEl) {
    alertEl.textContent = message || "";
  }
}

function setPanelVisible(visible) {
  if (!panelEl) return;
  panelEl.classList.toggle("is-visible", visible);
}

function setPanelCollapsed(collapsed) {
  if (!panelEl || !herbControls.togglePanel) return;
  panelEl.classList.toggle("is-collapsed", collapsed);
  herbControls.togglePanel.textContent = collapsed ? "Show" : "Hide";
  herbControls.togglePanel.setAttribute("aria-expanded", String(!collapsed));
}

function setHerbControlValues(params) {
  if (!herbControls.hungerRate) return;
  herbControls.hungerRate.value = params.hungerRate;
  herbControls.hungerRateValue.textContent = params.hungerRate.toFixed(3);
  herbControls.vision.value = params.vision;
  herbControls.visionValue.textContent = `${Math.round(params.vision)} px`;
  herbControls.maxSpeed.value = params.maxSpeed;
  herbControls.maxSpeedValue.textContent = `${Math.round(params.maxSpeed)} px/s`;
  const currentSpeed = engine.getSpeed?.() ?? 1;
  let closestIndex = 0;
  let closestDist = Infinity;
  for (let i = 0; i < simSpeedSteps.length; i++) {
    const d = Math.abs(simSpeedSteps[i] - currentSpeed);
    if (d < closestDist) {
      closestDist = d;
      closestIndex = i;
    }
  }
  herbControls.simSpeed.value = String(closestIndex);
  herbControls.simSpeedValue.textContent = `${simSpeedSteps[closestIndex]}x`;
  herbControls.foodRate.value = params.foodSpawnChance;
  herbControls.foodRateValue.textContent = params.foodSpawnChance.toFixed(3);
  herbControls.reproCooldown.value = params.reproCooldown;
  herbControls.reproCooldownValue.textContent = `${Math.round(params.reproCooldown)} s`;
  herbControls.lifespan.value = params.lifespan;
  herbControls.lifespanValue.textContent = `${Math.round(params.lifespan)} s`;
  if (herbControls.simDuration) {
    if (!herbControls.simDuration.value) {
      herbControls.simDuration.value = "300";
    }
    const duration = Number(herbControls.simDuration.value || 300);
    herbControls.simDurationValue.textContent = `${Math.round(duration)} s`;
  }
}

function bindHerbControls(scene) {
  if (!scene?.setParams || !scene?.params || !herbControls.hungerRate) return;
  setHerbControlValues(scene.params);

  herbControls.togglePanel?.addEventListener("click", () => {
    const collapsed = panelEl?.classList.contains("is-collapsed");
    setPanelCollapsed(!collapsed);
  });

  herbControls.hungerRate.oninput = () => {
    const hungerRate = Number(herbControls.hungerRate.value);
    scene.setParams({ hungerRate });
    setHerbControlValues(scene.params);
  };
  herbControls.vision.oninput = () => {
    const vision = Number(herbControls.vision.value);
    scene.setParams({ vision });
    setHerbControlValues(scene.params);
  };
  herbControls.maxSpeed.oninput = () => {
    const maxSpeed = Number(herbControls.maxSpeed.value);
    scene.setParams({ maxSpeed });
    setHerbControlValues(scene.params);
  };
  herbControls.simSpeed.oninput = () => {
    const index = Number(herbControls.simSpeed.value);
    const simSpeed = simSpeedSteps[Math.max(0, Math.min(simSpeedSteps.length - 1, index))];
    engine.setSpeed(simSpeed);
    herbControls.simSpeedValue.textContent = `${simSpeed}x`;
  };
  herbControls.foodRate.oninput = () => {
    const foodSpawnChance = Number(herbControls.foodRate.value);
    scene.setParams({ foodSpawnChance });
    setHerbControlValues(scene.params);
  };
  herbControls.reproCooldown.oninput = () => {
    const reproCooldown = Number(herbControls.reproCooldown.value);
    scene.setParams({ reproCooldown });
    setHerbControlValues(scene.params);
  };
  herbControls.lifespan.oninput = () => {
    const lifespan = Number(herbControls.lifespan.value);
    scene.setParams({ lifespan });
    setHerbControlValues(scene.params);
  };
  herbControls.simDuration.oninput = () => {
    const duration = Number(herbControls.simDuration.value);
    herbControls.simDurationValue.textContent = `${Math.round(duration)} s`;
  };

  herbControls.simulate?.addEventListener("click", () => {
    const duration = Number(herbControls.simDuration?.value || 300);
    runPopulationSimulation(scene, scene.params, duration);
  });
}

function runPopulationSimulation(scene, params, durationSec = 300) {
  if (!herbControls.plot) return;
  const dt = 1 / 60;
  const steps = Math.round(durationSec / dt);
  const sampleEvery = Math.max(30, Math.round(steps / 120));
  const herbSamples = [];
  const foodSamples = [];
  const sim = createHerbavoresSimulation({
    params,
    size: scene?.size,
    state: scene?.id === "herbavores" ? scene : null,
  });

  for (let i = 0; i < steps; i++) {
    sim.step(dt);
    if (i % sampleEvery === 0) {
      herbSamples.push(sim.getPopulation());
      foodSamples.push(sim.getFoodCount());
    }
  }

  const maxValue = Math.max(1, ...herbSamples, ...foodSamples);
  drawPopulationPlot(
    herbControls.plot,
    {
      herb: herbSamples,
      food: foodSamples,
    },
    { maxY: maxValue }
  );
}

function drawPopulationPlot(canvas, series, { maxY }) {
  const ctx = canvas.getContext("2d");
  if (!ctx || series.herb.length < 2) return;
  const w = canvas.width;
  const h = canvas.height;
  const padding = 10;
  const plotW = w - padding * 2;
  const plotH = h - padding * 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  function drawSeries(samples, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = padding + (i / (samples.length - 1)) * plotW;
      const yNorm = Math.min(1, samples[i] / maxY);
      const y = padding + (1 - yNorm) * plotH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  drawSeries(series.food, "rgba(80, 220, 140, 0.9)");
  drawSeries(series.herb, "rgba(110, 170, 255, 0.95)");

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("0", 2, h - padding + 3);
  ctx.fillText(String(Math.round(maxY)), 2, padding + 6);
}

function setActiveButton(sceneId) {
  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scene === sceneId);
  });
}

function getSceneFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scene");
}

function setScene(sceneId, { pushHistory = true } = {}) {
  const scene = getScene(sceneId) || getScene("particles");
  if (!scene) {
    setAlert("Scene not found.");
    return;
  }
  engine.setScene(scene);
  setActiveButton(scene.id);
  setAlert("");
  setPanelVisible(scene.id === "herbavores");
  setPanelCollapsed(false);
  if (scene.id === "herbavores") {
    bindHerbControls(scene);
  }
  if (pushHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("scene", scene.id);
    window.history.replaceState({}, "", url);
  }
}

document.getElementById("btn-reset")?.addEventListener("click", () => engine.resetScene());
document.getElementById("btn-pause")?.addEventListener("click", (e) => {
  const paused = engine.togglePause();
  e.target.textContent = paused ? "Resume" : "Pause";
});

document.querySelectorAll("[data-scene]").forEach((button) => {
  button.addEventListener("click", () => {
    setScene(button.dataset.scene);
  });
});

setScene(getSceneFromUrl(), { pushHistory: false });
engine.start();
