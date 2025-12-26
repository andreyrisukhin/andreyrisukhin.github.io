// assets/js/terrarium/main.js
import { createEngine } from "./core/engine.js";
import { registerScenes, getScene } from "./core/scene-registry.js";
import { particlesScene } from "./scenes/particles.js";
import { creaturesScene } from "./scenes/creatures.js";

const canvas = document.getElementById("terrarium-canvas");
if (!canvas) {
  throw new Error("Terrarium canvas not found.");
}

registerScenes([particlesScene, creaturesScene]);

const engine = createEngine(canvas, {
  onFps: (fps) => {
    const fpsEl = document.getElementById("fps");
    if (fpsEl) fpsEl.textContent = `${fps.toFixed(0)} fps`;
  },
});

const alertEl = document.getElementById("terrarium-alert");
function setAlert(message) {
  if (alertEl) {
    alertEl.textContent = message || "";
  }
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
