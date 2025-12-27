const fileInput = document.getElementById("ditherer-file");
const presetSelect = document.getElementById("ditherer-preset");
const paletteInput = document.getElementById("ditherer-palette");
const paletteEditor = document.getElementById("ditherer-palette-editor");
const paletteAddButton = document.getElementById("ditherer-palette-add");
const colorPicker = document.getElementById("ditherer-color-picker");
const kInput = document.getElementById("ditherer-k");
const pixelInput = document.getElementById("ditherer-pixel");
const pixelValue = document.getElementById("ditherer-pixel-value");
const blurInput = document.getElementById("ditherer-blur");
const blurValue = document.getElementById("ditherer-blur-value");
const methodSelect = document.getElementById("ditherer-method");
const stochasticToggle = document.getElementById("ditherer-stochastic");
const stochasticRow = document.getElementById("ditherer-stochastic-row");
const previewsEl = document.querySelector(".ditherer-previews");
const resetButton = document.getElementById("ditherer-reset");
const downloadButton = document.getElementById("ditherer-download");
const statusEl = document.getElementById("ditherer-status");
const sourceCanvas = document.getElementById("ditherer-source");
const outputCanvas = document.getElementById("ditherer-output");
const sampleButtons = Array.from(document.querySelectorAll("[data-sample]"));

const namedColors = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  gray: "#808080",
  grey: "#808080",
};

const presets = {
  bw: "#000000, #ffffff",
  rgb: "#ff0000, #808080, #000000",
  gameboy: "#0f380f, #306230, #8bac0f, #9bbc0f",
};

let sourceImage = null;
let renderQueued = false;
let paletteHex = [];

function setStatus(message) {
  statusEl.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(value) {
  const trimmed = value.trim().toLowerCase();
  const named = namedColors[trimmed];
  const hex = named ? named.replace("#", "") : trimmed.replace("#", "");

  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b, hex: `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` };
  }

  if (hex.length === 6 && /^[0-9a-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, hex: `#${hex}` };
  }

  return null;
}

function parsePalette(value) {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const colors = [];
  tokens.forEach((token) => {
    const parsed = parseHexColor(token);
    if (parsed) {
      colors.push(parsed);
    }
  });
  return colors;
}

function syncPaletteInput() {
  paletteInput.value = paletteHex.join(", ");
}

function renderPaletteEditor() {
  paletteEditor.innerHTML = "";
  paletteHex.forEach((hex, index) => {
    const item = document.createElement("div");
    item.className = "ditherer-swatch-item";

    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "ditherer-swatch";
    swatch.style.setProperty("--swatch-color", hex);
    swatch.setAttribute("aria-label", `Edit color ${index + 1}`);
    swatch.addEventListener("click", () => {
      colorPicker.value = hex;
      colorPicker.dataset.index = String(index);
      colorPicker.click();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ditherer-swatch-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Remove color ${index + 1}`);
    remove.disabled = paletteHex.length <= 1;
    remove.addEventListener("click", () => {
      if (paletteHex.length <= 1) {
        return;
      }
      paletteHex.splice(index, 1);
      syncPaletteInput();
      renderPaletteEditor();
      scheduleRender();
    });

    item.appendChild(swatch);
    item.appendChild(remove);
    paletteEditor.appendChild(item);
  });
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function fract(value) {
  return value - Math.floor(value);
}

function ign(x, y) {
  return fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y));
}

function nearestColor(colors, r, g, b) {
  let best = colors[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < colors.length; i += 1) {
    const candidate = colors[i];
    const dr = r - candidate.r;
    const dg = g - candidate.g;
    const db = b - candidate.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function nearestTwoColors(colors, r, g, b) {
  let first = colors[0];
  let second = colors[0];
  let firstDist = Number.POSITIVE_INFINITY;
  let secondDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < colors.length; i += 1) {
    const candidate = colors[i];
    const dr = r - candidate.r;
    const dg = g - candidate.g;
    const db = b - candidate.b;
    const dist = dr * dr + dg * dg + db * db;

    if (dist < firstDist) {
      second = first;
      secondDist = firstDist;
      first = candidate;
      firstDist = dist;
    } else if (dist < secondDist) {
      second = candidate;
      secondDist = dist;
    }
  }

  return { first, second, firstDist, secondDist };
}

function drawSourcePreview() {
  if (!sourceImage) {
    return;
  }
  const maxPreview = 520;
  const scale = Math.min(1, maxPreview / Math.max(sourceImage.width, sourceImage.height));
  const width = Math.max(1, Math.floor(sourceImage.width * scale));
  const height = Math.max(1, Math.floor(sourceImage.height * scale));

  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const ctx = sourceCanvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sourceImage, 0, 0, width, height);
}

function applyDither() {
  renderQueued = false;
  if (!sourceImage) {
    return;
  }

  const palette = parsePalette(paletteInput.value);
  if (palette.length === 0) {
    setStatus("Palette is empty or invalid.");
    downloadButton.disabled = true;
    return;
  }

  let k = parseInt(kInput.value, 10);
  if (Number.isNaN(k) || k <= 0) {
    k = palette.length;
  }
  k = clamp(k, 1, palette.length);
  const paletteSubset = palette.slice(0, k);

  const pixelSize = clamp(parseInt(pixelInput.value, 10) || 6, 2, 32);
  pixelValue.textContent = `${pixelSize}`;

  const method = methodSelect.value;
  const noiseStrength = 0.35;

  const smallWidth = Math.max(1, Math.floor(sourceImage.width / pixelSize));
  const smallHeight = Math.max(1, Math.floor(sourceImage.height / pixelSize));

  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = smallWidth;
  smallCanvas.height = smallHeight;
  const smallCtx = smallCanvas.getContext("2d");
  smallCtx.drawImage(sourceImage, 0, 0, smallWidth, smallHeight);

  const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight);
  const data = imageData.data;

  for (let y = 0; y < smallHeight; y += 1) {
    for (let x = 0; x < smallWidth; x += 1) {
      const idx = (y * smallWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const noise01 = ign(x, y);
      const noiseCentered = noise01 - 0.5;

      let color;
      if (method === "closest") {
        if (stochasticToggle.checked && paletteSubset.length > 1) {
          const { first, second, firstDist, secondDist } = nearestTwoColors(paletteSubset, r, g, b);
          const denom = firstDist + secondDist;
          const threshold = denom === 0 ? 0 : firstDist / denom;
          color = noise01 < threshold ? second : first;
        } else {
          const nr = clamp(Math.round(r + noiseCentered * noiseStrength * 255), 0, 255);
          const ng = clamp(Math.round(g + noiseCentered * noiseStrength * 255), 0, 255);
          const nb = clamp(Math.round(b + noiseCentered * noiseStrength * 255), 0, 255);
          color = nearestColor(paletteSubset, nr, ng, nb);
        }
      } else {
        const luma = luminance(r, g, b);
        const adjusted = clamp(luma + noiseCentered * noiseStrength, 0, 0.9999);
        const bandIndex = Math.min(k - 1, Math.floor(adjusted * k));
        color = paletteSubset[bandIndex];
      }

      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }

  smallCtx.putImageData(imageData, 0, 0);

  outputCanvas.width = smallWidth * pixelSize;
  outputCanvas.height = smallHeight * pixelSize;
  const outCtx = outputCanvas.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outCtx.drawImage(smallCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  const maxBlur = Math.max(0, Math.round(Math.min(outputCanvas.width, outputCanvas.height) * 0.03));
  if (blurInput) {
    blurInput.max = String(maxBlur);
    const blurPx = clamp(parseInt(blurInput.value, 10) || 0, 0, maxBlur);
    blurInput.value = String(blurPx);
    blurValue.textContent = String(blurPx);
    if (blurPx > 0) {
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = outputCanvas.width;
      blurCanvas.height = outputCanvas.height;
      const blurCtx = blurCanvas.getContext("2d");
      blurCtx.drawImage(outputCanvas, 0, 0);
      outCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      outCtx.filter = `blur(${blurPx}px)`;
      outCtx.drawImage(blurCanvas, 0, 0);
      outCtx.filter = "none";
    }
  }

  downloadButton.disabled = false;
  setStatus(`Output: ${smallWidth} x ${smallHeight} pixels, ${k} colors.`);
}

function scheduleRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame(() => {
    applyDither();
    drawSourcePreview();
    updateLayoutDirection();
  });
}

function loadImage(file) {
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      downloadButton.disabled = false;
      scheduleRender();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function loadImageFromUrl(url) {
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    downloadButton.disabled = false;
    scheduleRender();
  };
  img.src = url;
}

function resetControls() {
  presetSelect.value = "custom";
  paletteInput.value = "#000000, #ffffff";
  paletteHex = ["#000000", "#ffffff"];
  kInput.value = "0";
  pixelInput.value = "6";
  methodSelect.value = "bands";
  stochasticToggle.checked = false;
  pixelValue.textContent = "6";
  if (blurInput) {
    blurInput.value = "0";
    blurInput.max = "0";
  }
  if (blurValue) {
    blurValue.textContent = "0";
  }
  renderPaletteEditor();
  updateOptionVisibility();
  if (sourceImage) {
    scheduleRender();
  } else {
    setStatus("Load an image to start.");
    downloadButton.disabled = true;
  }
}

function updateOptionVisibility() {
  const showStochastic = methodSelect.value === "closest";
  stochasticRow.style.display = showStochastic ? "grid" : "none";
}

function updateLayoutDirection() {
  if (!previewsEl || !sourceImage) {
    return;
  }
  const isPortrait = sourceImage.height >= sourceImage.width;
  previewsEl.dataset.layout = isPortrait ? "vertical" : "horizontal";
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  loadImage(file);
});

presetSelect.addEventListener("change", () => {
  if (presetSelect.value !== "custom") {
    paletteInput.value = presets[presetSelect.value] || paletteInput.value;
    paletteHex = parsePalette(paletteInput.value).map((color) => color.hex);
    renderPaletteEditor();
  }
  scheduleRender();
});

paletteInput.addEventListener("input", () => {
  presetSelect.value = "custom";
  paletteHex = parsePalette(paletteInput.value).map((color) => color.hex);
  renderPaletteEditor();
  scheduleRender();
});

[kInput, pixelInput, methodSelect, stochasticToggle, blurInput].forEach((input) => {
  if (!input) {
    return;
  }
  input.addEventListener("input", () => {
    updateOptionVisibility();
    scheduleRender();
  });
});

resetButton.addEventListener("click", () => resetControls());

downloadButton.addEventListener("click", () => {
  if (!sourceImage) {
    return;
  }
  const link = document.createElement("a");
  link.download = "dithered.png";
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
});

paletteHex = parsePalette(paletteInput.value).map((color) => color.hex);
renderPaletteEditor();
updateOptionVisibility();
updateLayoutDirection();

window.addEventListener("resize", () => updateLayoutDirection());

const sampleConfigs = {
  llamamerc: {
    palette: "#0f380f, #306230, #8bac0f, #9bbc0f",
    pixel: 6,
    method: "closest",
    stochastic: false,
    k: 0,
  },
  brightsignals: {
    palette: "#000000, #ffffff",
    pixel: 8,
    method: "bands",
    stochastic: false,
    k: 0,
  },
  flymeaccorded: {
    palette: "#ffefe0, #e39c52, #4a3a26, #0d0c0b",
    pixel: 7,
    method: "closest",
    stochastic: true,
    k: 0,
  },
};

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sample;
    const config = sampleConfigs[key];
    const url = button.dataset.url;
    if (!config) {
      return;
    }
    presetSelect.value = "custom";
    paletteInput.value = config.palette;
    paletteHex = parsePalette(paletteInput.value).map((color) => color.hex);
    kInput.value = String(config.k);
    pixelInput.value = String(config.pixel);
    methodSelect.value = config.method;
    stochasticToggle.checked = config.stochastic;
    pixelValue.textContent = String(config.pixel);
    renderPaletteEditor();
    updateOptionVisibility();
    fileInput.value = "";
    downloadButton.disabled = true;
    loadImageFromUrl(url);
  });
});

paletteAddButton.addEventListener("click", () => {
  const fallback = paletteHex[paletteHex.length - 1] || "#ffffff";
  paletteHex.push(fallback);
  syncPaletteInput();
  renderPaletteEditor();
  scheduleRender();
});

colorPicker.addEventListener("input", (event) => {
  const index = parseInt(event.target.dataset.index, 10);
  if (Number.isNaN(index) || !paletteHex[index]) {
    return;
  }
  paletteHex[index] = event.target.value;
  syncPaletteInput();
  renderPaletteEditor();
  scheduleRender();
});
