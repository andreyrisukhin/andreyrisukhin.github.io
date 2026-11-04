import { ign, luminance, paletteIndex } from "../ditherer/texture.mjs";
import { lightAt } from "./light.mjs";
import { FIRE_COLORS, HIGHLIGHT, SUPPLIES, createFire } from "./pixel-fire.mjs";
import { SCENE, insideOpening } from "./scene.mjs";

const canvas = document.getElementById("fireplace");
const output = canvas.getContext("2d");
const status = document.getElementById("hearth-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const W = canvas.width;
const H = canvas.height;
const surface = document.createElement("canvas");
surface.width = W;
surface.height = H;
const ctx = surface.getContext("2d", { willReadFrequently: true });

if (!output || !ctx) {
  status.textContent = "This browser cannot draw the fire.";
} else {
  // Tuning from the URL, e.g. /fireplace/?flame=1.4&wind=0.4&burn=0.2
  const query = new URLSearchParams(window.location.search);
  const names = {
    seed: "seed",
    flame: "flameHeight",
    turbulence: "turbulence",
    sway: "sway",
    wind: "wind",
    puff: "puffHz",
    burn: "burnScale",
    embers: "emberSeconds",
    friction: "friction",
    logs: "logs",
    lit: "lit",
  };
  const tuning = {};
  for (const [param, option] of Object.entries(names)) if (query.has(param)) tuning[option] = query.get(param);
  const fire = createFire(tuning);
  const CW = W / SCENE.pixel;
  const CH = H / SCENE.pixel;
  // The room is drawn once as plain surface brightness. Each frame multiplies it
  // by the light from the fire and prints it in a small, warm ink palette.
  const palette = [
    [10, 9, 9],
    [16, 14, 13],
    [24, 20, 17],
    [34, 27, 21],
    [47, 35, 25],
    [64, 44, 29],
    [84, 54, 32],
    [108, 65, 35],
    [137, 77, 37],
    [169, 89, 39],
    [199, 108, 44],
    [221, 135, 56],
    [237, 166, 76],
    [247, 196, 111],
    [252, 220, 156],
    [255, 237, 199],
  ];
  const GAIN = 1.9;
  // Matches live in a box on the mantel.
  const MATCHBOX = { x: 171, y: 71, width: 16, height: 8 };
  const inBox = (box, x, y) => x >= box.x - 2 && x <= box.x + box.width + 2 && y >= box.y - 2 && y <= box.y + box.height + 2;
  const gray = (value) => `rgb(${value},${value},${value})`;
  const rect = (x, y, w, h, value) => {
    ctx.fillStyle = gray(value);
    ctx.fillRect(x, y, w, h);
  };
  function polygon(points, value) {
    ctx.beginPath();
    points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = gray(value);
    ctx.fill();
  }
  function arch() {
    ctx.beginPath();
    ctx.moveTo(158, 251);
    ctx.lineTo(158, 160);
    ctx.bezierCurveTo(158, 96, 322, 96, 322, 160);
    ctx.lineTo(322, 251);
    ctx.closePath();
  }

  function drawRoom() {
    rect(0, 0, W, H, 36);
    rect(0, 269, W, 51, 70);
    for (let y = 277; y < H; y += 13) {
      rect(0, y, W, 1, 96);
      for (let x = (y % 3) * 67; x < W; x += 121) rect(x, y, 1, 13, 44);
    }

    // Chimney breast, individual stones, and a deep arched firebox.
    rect(122, 24, 236, 244, 70);
    for (let row = 0; row < 9; row++) {
      for (let col = -1; col < 5; col++) {
        const x = 124 + col * 57 + (row % 2) * 28;
        const left = Math.max(124, x);
        const right = Math.min(356, x + 54);
        if (right <= left) continue;
        rect(left, 26 + row * 27, right - left, 24, 92 + ign(col + 2, row) * 30);
        rect(left, 26 + row * 27, right - left, 1, 130);
      }
    }
    rect(112, 94, 256, 9, 50);
    rect(103, 82, 274, 12, 140);
    rect(99, 79, 282, 5, 175);
    rect(108, 94, 264, 3, 90);
    arch();
    ctx.fillStyle = gray(58);
    ctx.fill();
    ctx.save();
    arch();
    ctx.clip();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 6; col++) rect(140 + col * 36 + (row % 2) * 18, 112 + row * 17, 33, 14, 92 + ign(col, row) * 26);
    }
    rect(158, 244, 164, 7, 70);
    ctx.restore();
    // Cut stones around the arch.
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i * Math.PI) / 11;
      const b = a + Math.PI / 11 - 0.022;
      polygon(
        [
          [240 + Math.cos(a) * 85, 160 + Math.sin(a) * 52],
          [240 + Math.cos(a) * 103, 160 + Math.sin(a) * 70],
          [240 + Math.cos(b) * 103, 160 + Math.sin(b) * 70],
          [240 + Math.cos(b) * 85, 160 + Math.sin(b) * 52],
        ],
        138 + i * 3
      );
    }
    for (let y = 161; y < 248; y += 22) {
      rect(137, y, 19, 20, 128);
      rect(324, y, 19, 20, 138);
      rect(154, y, 3, 20, 165);
      rect(323, y, 3, 20, 175);
    }
    rect(125, 251, 231, 10, 140);
    rect(116, 260, 249, 9, 110);
    rect(116, 260, 249, 2, 170);

    // Candle and books on the mantel.
    rect(143, 73, 23, 6, 150);
    rect(151, 49, 8, 24, 225);
    rect(151, 49, 8, 2, 250);
    rect(154, 45, 1, 5, 20);
    rect(296, 73, 42, 5, 170);
    rect(298, 68, 36, 5, 100);
    rect(300, 69, 31, 2, 200);
    rect(293, 63, 40, 5, 135);
    rect(298, 58, 34, 5, 190);
    rect(300, 59, 29, 2, 230);

    // Kindling basket: drag a stick out of it.
    const basket = SUPPLIES.stick;
    polygon(
      [
        [71, 240],
        [108, 240],
        [103, 264],
        [77, 264],
      ],
      100
    );
    for (let x = 78; x < 105; x += 5) rect(x, 243, 1, 19, 140);
    for (let y = 246; y < 263; y += 5) rect(77, y, 28, 1, 60);
    for (const [x0, x1, top, value] of [
      [74, 82, basket.y + 7, 130],
      [86, 92, basket.y + 3, 110],
      [95, 103, basket.y + 10, 150],
    ]) {
      polygon(
        [
          [x0, 240],
          [x0 - 4, top],
          [x0 + 3, top - 2],
          [x1, 240],
        ],
        value
      );
    }

    // A stack of old newspaper: drag a sheet out and crumple it into tinder.
    const paper = SUPPLIES.paper;
    for (let k = 0; k < 4; k++) {
      rect(paper.x + 2 + (k % 2) * 2, paper.y + 12 - k * 3, paper.width - 6, 3, 175 + k * 15);
      rect(paper.x + 6 + (k % 2) * 2, paper.y + 13 - k * 3, paper.width - 16, 1, 120);
    }

    // A matchbox beside the candle.
    rect(MATCHBOX.x, MATCHBOX.y + 2, MATCHBOX.width, MATCHBOX.height - 2, 120);
    rect(MATCHBOX.x, MATCHBOX.y + 2, MATCHBOX.width, 1, 190);
    rect(MATCHBOX.x + 2, MATCHBOX.y + 4, MATCHBOX.width - 4, 2, 60);
    rect(MATCHBOX.x + 10, MATCHBOX.y, 5, 2, 150);

    // A cup.
    rect(370, 264, 29, 2, 100);
    ctx.strokeStyle = gray(200);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(394, 253, 5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    polygon(
      [
        [374, 245],
        [392, 245],
        [390, 261],
        [377, 261],
      ],
      205
    );
    rect(376, 245, 14, 2, 50);
  }

  drawRoom();
  const albedo = new Float32Array(W * H);
  const pixels = ctx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) albedo[i] = luminance(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
  const opening = new Uint8Array(CW * CH);
  for (let gy = 0; gy < CH; gy++) {
    for (let gx = 0; gx < CW; gx++) opening[gy * CW + gx] = insideOpening(gx * 2 + 1, gy * 2 + 1) ? 1 : 0;
  }
  const cellLight = new Float32Array(CW * CH);
  const frame = ctx.createImageData(W, H);
  const data = frame.data;
  const rgb = new Map();
  const parse = (hex) => {
    let value = rgb.get(hex);
    if (!value) {
      value = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      rgb.set(hex, value);
    }
    return value;
  };
  function pixel(x, y, color) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = parse(color);
    const offset = (y * W + x) * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
  }
  function cells(list, clip) {
    for (let n = 0; n < list.length; n += 3) {
      const gx = list[n];
      const gy = list[n + 1];
      if (gx < 0 || gy < 0 || gx >= CW || gy >= CH || (clip && !opening[gy * CW + gx])) continue;
      const [r, g, b] = parse(list[n + 2]);
      for (const offset of [
        (gy * 2 * W + gx * 2) * 4,
        (gy * 2 * W + gx * 2 + 1) * 4,
        ((gy * 2 + 1) * W + gx * 2) * 4,
        ((gy * 2 + 1) * W + gx * 2 + 1) * 4,
      ]) {
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
      }
    }
  }

  function draw(time) {
    const layers = fire.render(hovered?.type === "item" ? hovered.id : 0);
    for (let gy = 0; gy < CH; gy++) {
      for (let gx = 0; gx < CW; gx++) cellLight[gy * CW + gx] = lightAt(layers.light, gx * 2 + 1, gy * 2 + 1) * GAIN;
    }
    for (let y = 0; y < H; y++) {
      const row = (y >> 1) * CW;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const color = palette[paletteIndex(albedo[i] * cellLight[row + (x >> 1)], palette.length, ign(x, y))];
        data[i * 4] = color[0];
        data[i * 4 + 1] = color[1];
        data[i * 4 + 2] = color[2];
        data[i * 4 + 3] = 255;
      }
    }
    // Inside the firebox, from the back wall forward.
    cells(layers.bed, true);
    cells(layers.back, true);
    cells(layers.flames, true);
    cells(layers.front, true);
    cells(layers.room, false);
    cells(layers.outer, false);
    cells(layers.outline, false);
    cells(layers.sparks, false);
    // Supplies show corner marks when the pointer is over them.
    const box = hovered?.type === "supply" ? SUPPLIES[hovered.kind] : hovered?.type === "matches" ? MATCHBOX : null;
    if (box) {
      for (const [cx, cy, dx, dy] of [
        [box.x - 2, box.y - 2, 1, 1],
        [box.x + box.width + 1, box.y - 2, -1, 1],
        [box.x - 2, box.y + box.height + 1, 1, -1],
        [box.x + box.width + 1, box.y + box.height + 1, -1, -1],
      ]) {
        for (let k = 0; k < 4; k++) {
          pixel(cx + k * dx, cy, HIGHLIGHT);
          pixel(cx, cy + k * dy, HIGHLIGHT);
        }
      }
    }
    // An unstruck match follows the pointer while it is in hand.
    if (holdingMatch && pointer) {
      const x = Math.round(pointer.x);
      const y = Math.round(pointer.y);
      for (let k = 0; k < 9; k++) pixel(x + 2 + Math.floor(k * 0.6), y + 2 + k, "#c9a56a");
      for (const [dx, dy] of [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ])
        pixel(x + dx, y + dy, "#b8321f");
    }
    // The candle flame, one canvas pixel at a time.
    const lean = Math.sin(time * 2.3) > 0.6 ? 1 : 0;
    for (let y = 38; y < 45; y++) {
      const core = y > 40;
      pixel(154 + (y < 41 ? lean : 0), y, core ? FIRE_COLORS[9] : FIRE_COLORS[6]);
      if (y > 40 && y < 44) pixel(155, y, FIRE_COLORS[7]);
    }
    const match = fire.match();
    if (match) {
      const x = Math.round(match.x);
      const y = Math.round(match.y);
      for (let k = 0; k < 9; k++) pixel(x + 2 + Math.floor(k * 0.6), y + 2 + k, k < 2 ? "#3a1f17" : "#c9a56a");
      const flare = match.life > 1.3 ? 2 : 0;
      for (let k = 0; k < 4 + flare; k++) {
        pixel(x + 1, y + 1 - k, FIRE_COLORS[k < 2 ? 9 : k < 4 ? 7 : 5]);
        if (k < 3) pixel(x + 2, y + 1 - k, FIRE_COLORS[k < 1 ? 8 : 6]);
      }
    }
    output.putImageData(frame, 0, 0);
    const state = fire.stats();
    if (state.burning > 0) everLit = true;
    const out = everLit && state.burning === 0 && state.embers < 0.05;
    if (out !== burnedOut) {
      burnedOut = out;
      if (out) say("The fire has burned down. Add wood and strike a match to start again.");
    }
  }

  let paused = reducedMotion.matches;
  let animation = 0;
  let last = null;
  let time = 4;
  let burnedOut = false;
  let everLit = false;
  let holdingMatch = false;
  let dragging = null;
  let pointer = null;
  let hovered = null;
  const say = (message) => {
    status.textContent = message;
  };
  function tick(now) {
    animation = 0;
    if (paused || document.hidden) return;
    if (last === null) last = now;
    if (now - last >= 1000 / 24) {
      const elapsed = Math.min((now - last) / 1000, 0.1);
      time += elapsed;
      last = now;
      fire.step(elapsed);
      draw(time);
    }
    animation = requestAnimationFrame(tick);
  }
  function syncAnimation() {
    cancelAnimationFrame(animation);
    last = null;
    if (!paused && !document.hidden) animation = requestAnimationFrame(tick);
  }
  // A still scene still answers the pointer.
  const refresh = () => {
    if (paused || document.hidden) draw(time);
  };

  function scenePoint(event) {
    const box = canvas.getBoundingClientRect();
    return { x: ((event.clientX - box.left) * W) / box.width, y: ((event.clientY - box.top) * H) / box.height };
  }
  function aim(point) {
    pointer = point;
    if (dragging !== null) {
      hovered = { type: "item", id: fire.held() };
      canvas.style.cursor = "grabbing";
      return;
    }
    hovered = point ? (inBox(MATCHBOX, point.x, point.y) ? { type: "matches" } : holdingMatch ? null : fire.hover(point.x, point.y)) : null;
    canvas.style.cursor = holdingMatch ? "none" : hovered ? (hovered.type === "matches" ? "pointer" : "grab") : "";
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const point = scenePoint(event);
    event.preventDefault();
    if (inBox(MATCHBOX, point.x, point.y)) {
      holdingMatch = !holdingMatch;
      say(holdingMatch ? "You take a match. Click anywhere to strike it." : "You put the match back.");
    } else if (holdingMatch) {
      fire.strike(point.x, point.y);
      holdingMatch = false;
      say("You strike the match.");
    } else if (fire.grab(point.x, point.y)) {
      dragging = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
    }
    aim(point);
    refresh();
  });
  canvas.addEventListener("pointermove", (event) => {
    const point = scenePoint(event);
    if (dragging === event.pointerId) fire.drag(point.x, point.y);
    aim(point);
    refresh();
  });
  canvas.addEventListener("pointerleave", () => {
    if (dragging !== null) return;
    aim(null);
    refresh();
  });
  const letGo = (event) => {
    if (dragging !== event.pointerId) return;
    dragging = null;
    // The held item keeps the speed of the hand, so a quick flick throws it.
    fire.release();
    aim(event.type === "pointercancel" ? null : scenePoint(event));
    refresh();
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  // Space pauses and resumes the fire when the scene has keyboard focus.
  canvas.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    paused = !paused;
    say(paused ? "Paused. Press Space to resume." : "");
    syncAnimation();
  });

  reducedMotion.addEventListener("change", (event) => {
    paused = event.matches;
    say(paused ? "Motion is off to match your device setting." : "");
    syncAnimation();
  });
  document.addEventListener("visibilitychange", syncAnimation);
  if (paused) say("Motion is off to match your device setting. Press Space on the scene to play.");
  draw(time);
  syncAnimation();
}
