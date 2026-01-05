const fileInput = document.getElementById("ditherer-file");
const presetSelect = document.getElementById("ditherer-preset");
const paletteInput = document.getElementById("ditherer-palette");
const paletteEditor = document.getElementById("ditherer-palette-editor");
const paletteAddButton = document.getElementById("ditherer-palette-add");
const paletteUndoButton = document.getElementById("ditherer-palette-undo");
const paletteRedoButton = document.getElementById("ditherer-palette-redo");
const paletteSortToggle = document.getElementById("ditherer-palette-sort-toggle");
const paletteSortMenu = document.querySelector(".ditherer-palette-sort-menu");
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
let paletteHistory = [];
let paletteFuture = [];
let dragIndex = null;

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

function updateUndoRedoButtons() {
  if (paletteUndoButton) {
    paletteUndoButton.disabled = paletteHistory.length === 0;
  }
  if (paletteRedoButton) {
    paletteRedoButton.disabled = paletteFuture.length === 0;
  }
}

function setPaletteHex(nextPalette, options = {}) {
  const { recordHistory = true, updateInput = true } = options;
  const normalized = nextPalette.slice();
  const currentSnapshot = paletteHex.join("|");
  const nextSnapshot = normalized.join("|");
  if (currentSnapshot === nextSnapshot) {
    return;
  }
  if (recordHistory) {
    const lastSnapshot = paletteHistory.length
      ? paletteHistory[paletteHistory.length - 1].join("|")
      : null;
    if (currentSnapshot !== lastSnapshot) {
      paletteHistory.push(paletteHex.slice());
    }
    paletteFuture = [];
  }
  paletteHex = normalized;
  if (updateInput) {
    syncPaletteInput();
  }
  renderPaletteEditor();
  scheduleRender();
  updateUndoRedoButtons();
}

function swapPaletteIndices(first, second) {
  const nextPalette = paletteHex.slice();
  const temp = nextPalette[first];
  nextPalette[first] = nextPalette[second];
  nextPalette[second] = temp;
  setPaletteHex(nextPalette, { recordHistory: true });
}

function movePaletteIndex(fromIndex, toIndex) {
  if (fromIndex === toIndex) {
    return;
  }
  const nextPalette = paletteHex.slice();
  const [moved] = nextPalette.splice(fromIndex, 1);
  const clampedIndex = clamp(toIndex, 0, nextPalette.length);
  nextPalette.splice(clampedIndex, 0, moved);
  setPaletteHex(nextPalette, { recordHistory: true });
}

function renderPaletteEditor() {
  paletteEditor.innerHTML = "";
  // TODO: Reintroduce per-swatch move controls with more reliable interaction.
  paletteHex.forEach((hex, index) => {
    const item = document.createElement("div");
    item.className = "ditherer-swatch-item";
    item.dataset.index = String(index);

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "ditherer-swatch-handle";
    handle.textContent = "drag";
    handle.setAttribute("aria-label", `Reorder color ${index + 1}`);
    handle.draggable = true;
    handle.addEventListener("dragstart", (event) => {
      dragIndex = index;
      item.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }
    });
    handle.addEventListener("dragend", () => {
      dragIndex = null;
      item.classList.remove("is-dragging");
      paletteEditor
        .querySelectorAll(".ditherer-swatch-item.is-drop-target")
        .forEach((el) => el.classList.remove("is-drop-target"));
    });

    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "ditherer-swatch";
    swatch.style.setProperty("--swatch-color", hex);
    swatch.setAttribute("aria-label", `Edit color ${index + 1}`);
    swatch.title = "Alt+Left or Alt+Right to swap";
    swatch.addEventListener("click", () => {
      colorPicker.value = hex;
      colorPicker.dataset.index = String(index);
      colorPicker.click();
    });
    swatch.addEventListener("keydown", (event) => {
      if (!event.altKey) {
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        swapPaletteIndices(index, index - 1);
      } else if (event.key === "ArrowRight" && index < paletteHex.length - 1) {
        event.preventDefault();
        swapPaletteIndices(index, index + 1);
      }
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
      const nextPalette = paletteHex.slice();
      nextPalette.splice(index, 1);
      setPaletteHex(nextPalette, { recordHistory: true });
    });

    item.appendChild(handle);
    item.appendChild(swatch);
    item.appendChild(remove);
    paletteEditor.appendChild(item);

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === index) {
        return;
      }
      item.classList.add("is-drop-target");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("is-drop-target");
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === index) {
        item.classList.remove("is-drop-target");
        return;
      }
      const fromIndex = dragIndex;
      const toIndex = index;
      const nextPalette = paletteHex.slice();
      const [moved] = nextPalette.splice(fromIndex, 1);
      const insertIndex = toIndex;
      nextPalette.splice(insertIndex, 0, moved);
      dragIndex = null;
      item.classList.remove("is-drop-target");
      setPaletteHex(nextPalette, { recordHistory: true });
    });
  });
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function rgbToHsl(r, g, b) {
  const r01 = r / 255;
  const g01 = g / 255;
  const b01 = b / 255;
  const max = Math.max(r01, g01, b01);
  const min = Math.min(r01, g01, b01);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r01:
        h = (g01 - b01) / delta + (g01 < b01 ? 6 : 0);
        break;
      case g01:
        h = (b01 - r01) / delta + 2;
        break;
      default:
        h = (r01 - g01) / delta + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}

function sortPaletteBy(mode) {
  const nextPalette = paletteHex.slice().sort((firstHex, secondHex) => {
    const firstColor = parseHexColor(firstHex);
    const secondColor = parseHexColor(secondHex);
    if (!firstColor || !secondColor) {
      return 0;
    }
    if (mode === "hue" || mode === "saturation") {
      const firstHsl = rgbToHsl(firstColor.r, firstColor.g, firstColor.b);
      const secondHsl = rgbToHsl(secondColor.r, secondColor.g, secondColor.b);
      const firstKey = mode === "hue" ? firstHsl.h : firstHsl.s;
      const secondKey = mode === "hue" ? secondHsl.h : secondHsl.s;
      return firstKey - secondKey;
    }
    const firstKey = luminance(firstColor.r, firstColor.g, firstColor.b);
    const secondKey = luminance(secondColor.r, secondColor.g, secondColor.b);
    return firstKey - secondKey;
  });
  setPaletteHex(nextPalette, { recordHistory: true });
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
  paletteHistory = [];
  paletteFuture = [];
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
  updateUndoRedoButtons();
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

function undoPalette() {
  if (paletteHistory.length === 0) {
    return;
  }
  const previous = paletteHistory.pop();
  paletteFuture.push(paletteHex.slice());
  setPaletteHex(previous, { recordHistory: false });
}

function redoPalette() {
  if (paletteFuture.length === 0) {
    return;
  }
  const next = paletteFuture.pop();
  paletteHistory.push(paletteHex.slice());
  setPaletteHex(next, { recordHistory: false });
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  loadImage(file);
});

presetSelect.addEventListener("change", () => {
  if (presetSelect.value !== "custom") {
    paletteInput.value = presets[presetSelect.value] || paletteInput.value;
    const nextPalette = parsePalette(paletteInput.value).map((color) => color.hex);
    setPaletteHex(nextPalette, { recordHistory: true, updateInput: false });
  }
  scheduleRender();
});

paletteInput.addEventListener("input", () => {
  presetSelect.value = "custom";
  const nextPalette = parsePalette(paletteInput.value).map((color) => color.hex);
  setPaletteHex(nextPalette, { recordHistory: false, updateInput: false });
});

paletteInput.addEventListener("change", () => {
  presetSelect.value = "custom";
  const nextPalette = parsePalette(paletteInput.value).map((color) => color.hex);
  setPaletteHex(nextPalette, { recordHistory: true, updateInput: true });
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

if (paletteUndoButton) {
  paletteUndoButton.addEventListener("click", () => undoPalette());
}

if (paletteRedoButton) {
  paletteRedoButton.addEventListener("click", () => redoPalette());
}

if (paletteSortMenu) {
  paletteSortMenu.querySelectorAll("button[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.sort;
      if (mode) {
        sortPaletteBy(mode);
      }
      if (paletteSortToggle) {
        paletteSortToggle.setAttribute("aria-expanded", "false");
        paletteSortToggle.focus();
      }
    });
  });
}

if (paletteSortToggle) {
  paletteSortToggle.addEventListener("click", () => {
    const expanded = paletteSortToggle.getAttribute("aria-expanded") === "true";
    paletteSortToggle.setAttribute("aria-expanded", String(!expanded));
  });
  const sortContainer = paletteSortToggle.closest(".ditherer-palette-sort");
  if (sortContainer) {
    sortContainer.addEventListener("focusout", (event) => {
      if (!sortContainer.contains(event.relatedTarget)) {
        paletteSortToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
}

if (paletteEditor) {
  paletteEditor.addEventListener("keydown", (event) => {
    const isRedo =
      (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
    if (isRedo) {
      event.preventDefault();
      redoPalette();
    } else if (isUndo) {
      event.preventDefault();
      undoPalette();
    }
  });
  paletteEditor.addEventListener("dragover", (event) => {
    if (dragIndex === null) {
      return;
    }
    event.preventDefault();
  });
  paletteEditor.addEventListener("drop", (event) => {
    if (dragIndex === null) {
      return;
    }
    if (event.target.closest(".ditherer-swatch-item")) {
      return;
    }
    event.preventDefault();
    const nextPalette = paletteHex.slice();
    const [moved] = nextPalette.splice(dragIndex, 1);
    nextPalette.push(moved);
    dragIndex = null;
    setPaletteHex(nextPalette, { recordHistory: true });
  });
}

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
updateUndoRedoButtons();
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
    const nextPalette = parsePalette(paletteInput.value).map((color) => color.hex);
    kInput.value = String(config.k);
    pixelInput.value = String(config.pixel);
    methodSelect.value = config.method;
    stochasticToggle.checked = config.stochastic;
    pixelValue.textContent = String(config.pixel);
    setPaletteHex(nextPalette, { recordHistory: true, updateInput: false });
    updateOptionVisibility();
    fileInput.value = "";
    downloadButton.disabled = true;
    loadImageFromUrl(url);
  });
});

paletteAddButton.addEventListener("click", () => {
  const fallback = paletteHex[paletteHex.length - 1] || "#ffffff";
  const nextPalette = paletteHex.slice();
  nextPalette.push(fallback);
  setPaletteHex(nextPalette, { recordHistory: true });
});

colorPicker.addEventListener("input", (event) => {
  const index = parseInt(event.target.dataset.index, 10);
  if (Number.isNaN(index) || !paletteHex[index]) {
    return;
  }
  const nextPalette = paletteHex.slice();
  nextPalette[index] = event.target.value;
  setPaletteHex(nextPalette, { recordHistory: true });
});
