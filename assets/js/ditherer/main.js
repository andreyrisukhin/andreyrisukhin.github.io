const fileInput = document.getElementById("ditherer-file");
const presetSelect = document.getElementById("ditherer-preset");
const paletteInput = document.getElementById("ditherer-palette");
const kInput = document.getElementById("ditherer-k");
const pixelInput = document.getElementById("ditherer-pixel");
const pixelValue = document.getElementById("ditherer-pixel-value");
const methodSelect = document.getElementById("ditherer-method");
const resetButton = document.getElementById("ditherer-reset");
const downloadButton = document.getElementById("ditherer-download");
const statusEl = document.getElementById("ditherer-status");
const swatchesEl = document.getElementById("ditherer-swatches");
const sourceCanvas = document.getElementById("ditherer-source");
const outputCanvas = document.getElementById("ditherer-output");

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

function renderSwatches(colors) {
  swatchesEl.innerHTML = "";
  colors.forEach((color) => {
    const swatch = document.createElement("span");
    swatch.className = "ditherer-swatch";
    swatch.style.background = color.hex;
    swatchesEl.appendChild(swatch);
  });
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function ign(x, y) {
  const value = 0.06711056 * x + 0.00583715 * y;
  return value - Math.floor(value);
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
  renderSwatches(palette);
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

      const noise = ign(x, y) - 0.5;

      let color;
      if (method === "closest") {
        const nr = clamp(Math.round(r + noise * noiseStrength * 255), 0, 255);
        const ng = clamp(Math.round(g + noise * noiseStrength * 255), 0, 255);
        const nb = clamp(Math.round(b + noise * noiseStrength * 255), 0, 255);
        color = nearestColor(paletteSubset, nr, ng, nb);
      } else {
        const luma = luminance(r, g, b);
        const adjusted = clamp(luma + noise * noiseStrength, 0, 0.9999);
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

  downloadButton.disabled = false;
  setStatus(`Output: ${smallWidth} x ${smallHeight} pixels, ${k} colors.`);
}

function scheduleRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame(() => {
    drawSourcePreview();
    applyDither();
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
      scheduleRender();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function resetControls() {
  presetSelect.value = "custom";
  paletteInput.value = "#000000, #ffffff";
  kInput.value = "0";
  pixelInput.value = "6";
  methodSelect.value = "bands";
  pixelValue.textContent = "6";
  renderSwatches(parsePalette(paletteInput.value));
  if (sourceImage) {
    scheduleRender();
  } else {
    setStatus("Load an image to start.");
    downloadButton.disabled = true;
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  loadImage(file);
});

presetSelect.addEventListener("change", () => {
  if (presetSelect.value !== "custom") {
    paletteInput.value = presets[presetSelect.value] || paletteInput.value;
  }
  scheduleRender();
});

paletteInput.addEventListener("input", () => {
  presetSelect.value = "custom";
  renderSwatches(parsePalette(paletteInput.value));
  scheduleRender();
});

[kInput, pixelInput, methodSelect].forEach((input) => {
  input.addEventListener("input", () => scheduleRender());
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

renderSwatches(parsePalette(paletteInput.value));
