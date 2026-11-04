// node _scripts/fireplace-test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const load = (file) => import(pathToFileURL(path.join(root, "assets/js", file)));

async function main() {
  const shared = await load("ditherer/texture.mjs");
  const pixelFire = await load("fireplace/pixel-fire.mjs");
  const scene = await load("fireplace/scene.mjs");
  const light = await load("fireplace/light.mjs");
  const { createFire, fireOptions, heatIndex, FIRE_COLORS, STEP, SUPPLIES } = pixelFire;
  const { HEARTH, screenY } = scene;
  const run = (fire, seconds) => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) fire.step(STEP);
  };
  const logs = (fire) => fire.items().filter((item) => item.kind === "log" && item.inHearth);
  const upright = (item) => Math.abs(item.a.y - item.b.y) > Math.abs(item.a.x - item.b.x);
  const top = (item) => Math.min(screenY(item.a.y, item.a.z), screenY(item.b.y, item.b.z)) - item.r;
  const highestFlame = (layers) => {
    let row = Infinity;
    for (let n = 1; n < layers.flames.length; n += 3) row = Math.min(row, layers.flames[n] * 2);
    return row;
  };

  // The same seed and steps give the same fire.
  const a = createFire();
  const b = createFire();
  run(a, 3);
  run(b, 3);
  assert.deepEqual(a.items(), b.items());
  assert.deepEqual(a.heat(), b.heat());
  const items = a.items();
  a.render();
  assert.deepEqual(a.items(), items, "rendering does not move anything");

  // Three logs lean together in a teepee and hold until they burn thin.
  const fire = createFire();
  assert.equal(logs(fire).length, 3);
  assert.ok(logs(fire).every(upright), "the teepee logs start upright");
  run(fire, 4);
  assert.ok(logs(fire).every(upright), "the teepee stands on its own");
  const paper = fire.items().filter((item) => item.kind === "paper");
  assert.ok(paper.length === 2 && paper.every((item) => item.burning), "the fire starts from lit paper");
  run(fire, 26);
  assert.ok(
    logs(fire).every((item) => item.burning),
    "flames spread from paper to kindling to logs"
  );
  // Light settles over a few frames.
  for (let i = 0; i < 4; i++) fire.render();
  const layers = fire.render();
  const apex = Math.min(...logs(fire).map(top));
  const crest = highestFlame(layers);
  assert.ok(crest < apex - 10, "flames rise clearly above the logs");
  assert.ok(crest > scene.archTopAt(HEARTH.center), "flames stay inside the firebox");
  assert.ok(new Set(layers.flames.filter((value) => typeof value === "string")).size >= 6, "flames use distinct color bands");
  assert.ok(layers.light.length === light.LIGHT_W * light.LIGHT_H);
  const floor = light.lightAt(layers.light, HEARTH.center, 280);
  const corner = light.lightAt(layers.light, 20, 300);
  assert.ok(floor > corner * 1.8, "the fire lights the floor in front of it");
  assert.ok(fire.stats().output > 0.2);

  // Fire creeps along a log from where it caught, rather than lighting all of it at once.
  const creeping = createFire();
  let partial = false;
  for (let i = 0; i < 30 && !partial; i++) {
    run(creeping, 0.5);
    partial = logs(creeping).some((item) => item.fire.some((value) => value > 0) && item.fire.some((value) => value === 0));
  }
  assert.ok(partial, "a log burns in places before it burns all over");
  // A lone log burns lazily; logs leaning on each other keep one another hot.
  const lone = createFire({ logs: 1 });
  run(lone, 120);
  run(fire, 90);
  const mean = (item) => item.fire.reduce((sum, value) => sum + value, 0) / item.fire.length;
  const loneFire = Math.max(...logs(lone).map(mean));
  assert.ok(loneFire < 0.5, "a lone log burns low");
  assert.ok(Math.min(...logs(fire).map(mean)) > loneFire, "a teepee burns stronger than a lone log");

  // Flames stay attached to the fire: any pocket that breaks away sits just above a tongue.
  const shape = createFire();
  run(shape, 20);
  for (let frame = 0; frame < 12; frame++) {
    run(shape, 0.25);
    const { flames, back, front, bed } = shape.render();
    const key = (x, y) => y * 240 + x;
    const flame = new Set();
    for (let n = 0; n < flames.length; n += 3) flame.add(key(flames[n], flames[n + 1]));
    const solid = new Set();
    for (const list of [back, front, bed]) for (let n = 0; n < list.length; n += 3) solid.add(key(list[n], list[n + 1]));
    const joined = new Set();
    const queue = [...flame].filter((cell) => [1, -1, 240, -240, 480].some((d) => solid.has(cell + d)));
    queue.forEach((cell) => joined.add(cell));
    while (queue.length) {
      const cell = queue.pop();
      for (const d of [1, -1, 240, -240]) {
        if (flame.has(cell + d) && !joined.has(cell + d)) {
          joined.add(cell + d);
          queue.push(cell + d);
        }
      }
    }
    for (const cell of flame) {
      if (joined.has(cell)) continue;
      const near = [...Array(8).keys()].some((d) => [-1, 0, 1].some((dx) => joined.has(cell + (d + 1) * 240 + dx)));
      assert.ok(near, "no flame floats free above the fire");
    }
  }

  // Quick burning: logs char, thin, and the teepee falls in, kicking up embers.
  const fast = createFire({ burnScale: 0.08 });
  const start = logs(fast);
  let sparks = 0;
  for (let i = 0; i < 60; i++) {
    run(fast, 1);
    sparks = Math.max(sparks, fast.stats().sparks);
  }
  const burnt = fast.items().filter((item) => item.inHearth && item.kind === "log");
  assert.ok(
    burnt.every((item) => item.char > 0.5 && item.mass < 1),
    "logs char and lose mass"
  );
  assert.ok(burnt.length < start.length || burnt.some((item) => !upright(item)), "the teepee collapses as the logs burn");
  assert.ok(sparks > 10, "burning and falling logs throw sparks");
  assert.ok(fast.stats().embers > 0.05, "burnt wood leaves embers");

  // Lighting and moving things by hand.
  const cold = createFire({ lit: 0 });
  run(cold, 5);
  assert.equal(cold.stats().burning, 0, "an unlit fire stays cold");
  const ball = cold.items().find((item) => item.kind === "paper");
  cold.strike(ball.a.x, screenY(ball.a.y, ball.a.z));
  assert.ok(cold.match());
  run(cold, 1);
  assert.ok(cold.items().find((item) => item.id === ball.id).burning, "a match lights paper");
  run(cold, 2);
  assert.equal(cold.match(), null, "a match burns out");

  const spare = cold.items().find((item) => item.kind === "log" && !item.inHearth);
  const grip = { x: (spare.a.x + spare.b.x) / 2, y: screenY((spare.a.y + spare.b.y) / 2, (spare.a.z + spare.b.z) / 2) };
  const pointed = cold.hover(grip.x, grip.y);
  assert.deepEqual({ ...pointed, id: 0 }, { type: "item", id: 0, kind: "log" });
  assert.ok(cold.render(pointed.id).outline.length > 0, "the item under the pointer is outlined");
  assert.equal(cold.render().outline.length, 0);
  cold.strike(grip.x, grip.y);
  run(cold, 2);
  assert.equal(cold.items().find((item) => item.id === spare.id).burning, false, "a match cannot light a log");
  assert.equal(cold.grab(grip.x, grip.y), true);
  assert.ok(cold.holding());
  for (const [x, y] of [
    [grip.x, 200],
    [180, 190],
    [230, 185],
  ]) {
    cold.drag(x, y);
    run(cold, 0.4);
  }
  cold.release();
  assert.equal(cold.holding(), false);
  run(cold, 3);
  const carried = cold.items().filter((item) => item.kind === "log" && item.inHearth && item.id > 3);
  assert.equal(carried.length, 1, "a log can be carried into the hearth");

  const outside = createFire({ lit: 0 });
  const box = SUPPLIES.paper;
  assert.deepEqual(outside.hover(box.x + 10, box.y + 8), { type: "supply", kind: "paper" });
  assert.equal(outside.hover(5, 5), null);
  assert.equal(outside.grab(box.x + 10, box.y + 8), true, "paper comes from the newspaper stack");
  outside.drag(400, 250);
  run(outside, 0.5);
  outside.release();
  run(outside, 2);
  const sheet = outside.items().find((item) => item.kind === "paper" && !item.inHearth);
  assert.ok(sheet, "paper dropped in the room stays in the room");
  outside.strike(sheet.a.x, screenY(sheet.a.y, sheet.a.z));
  run(outside, 1);
  assert.ok(outside.stats().outside, "a fire can be lit outside the hearth");
  assert.ok(outside.render().outer.length > 0);

  const count = outside.stats().items;
  assert.equal(outside.drop("log"), true);
  assert.equal(outside.drop("stick"), true);
  assert.equal(outside.stats().items, count + 2);

  assert.equal(fireOptions({ flameHeight: "99" }).flameHeight, 3);
  assert.equal(fireOptions({ wind: "-9" }).wind, -3);
  assert.equal(fireOptions({ burnScale: "abc" }).burnScale, pixelFire.DEFAULTS.burnScale);
  assert.equal(fireOptions({ logs: "1.6" }).logs, 2);
  assert.equal(logs(createFire({ logs: 0 })).length, 0);
  assert.equal(heatIndex(0), 0);
  assert.equal(heatIndex(5), FIRE_COLORS.length - 1);

  const { bayer, ign, luminance, paletteIndex } = shared;
  const thresholds = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      thresholds.push(bayer(x, y));
      assert.equal(bayer(x, y), bayer(x + 4, y + 8));
    }
  }
  assert.equal(new Set(thresholds).size, 16);
  assert.equal(thresholds.reduce((sum, value) => sum + value) / 16, 0.5);
  assert.equal(thresholds.filter((threshold) => paletteIndex(0.5, 2, threshold) === 1).length, 8);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const fract = (value) => value - Math.floor(value);
      assert.equal(ign(x, y), fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y)));
    }
  }
  assert.ok(Math.abs(luminance(255, 255, 255) - 1) < Number.EPSILON);
  assert.equal(luminance(0, 0, 0), 0);
  assert.equal(paletteIndex(-1, 15, 0.1), 0);
  assert.equal(paletteIndex(2, 15, 0.1), 14);

  function mount({ reduced = false, supported = true, search = "" } = {}) {
    class Element {
      constructor() {
        this.events = {};
        this.attributes = {};
        this.dataset = {};
        this.style = {};
        this.value = "bayer";
        this.hidden = true;
      }
      addEventListener(name, callback) {
        this.events[name] = callback;
      }
      setAttribute(name, value) {
        this.attributes[name] = value;
      }
      click() {
        this.events.click();
      }
    }
    let paints = 0;
    const context = new Proxy(
      {
        getImageData: () => ({ data: new Uint8ClampedArray(480 * 320 * 4) }),
        createImageData: () => ({ data: new Uint8ClampedArray(480 * 320 * 4) }),
      },
      { get: (target, name) => target[name] || (() => {}) }
    );
    const canvas = new Element();
    Object.assign(canvas, {
      width: 480,
      height: 320,
      getContext: () => (supported ? { putImageData: () => paints++ } : null),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
      setPointerCapture() {},
    });
    const elements = {
      fireplace: canvas,
      "hearth-status": new Element(),
    };
    const media = new Element();
    media.matches = reduced;
    const document = new Element();
    document.hidden = false;
    document.getElementById = (id) => elements[id];
    document.createElement = () => ({ getContext: () => (supported ? context : null) });
    const frames = new Map();
    let id = 0;
    const code = fs.readFileSync(path.join(root, "assets/js/fireplace/main.js"), "utf8").replace(/^import [^;]*;\n/gm, "");
    const sandbox = {
      ...shared,
      ...pixelFire,
      ...scene,
      ...light,
      document,
      URLSearchParams,
      window: { matchMedia: () => media, location: { search: search || "?burn=2&flame=abc" } },
      requestAnimationFrame: (callback) => {
        frames.set(++id, callback);
        return id;
      },
      cancelAnimationFrame: (key) => frames.delete(key),
    };
    let created;
    sandbox.createFire = (options) => (created = pixelFire.createFire(options));
    vm.runInNewContext(code, sandbox);
    return {
      elements,
      canvas,
      media,
      document,
      frames,
      fire: () => created,
      paints: () => paints,
      step: (time) => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(time));
      },
    };
  }

  const page = mount();
  assert.equal(page.fire().options.burnScale, 2, "URL parameters tune the fire");
  assert.equal(page.fire().options.flameHeight, pixelFire.DEFAULTS.flameHeight);
  assert.equal(page.paints(), 1, "draw an initial frame immediately");
  assert.equal(page.frames.size, 1);
  page.step(0);
  page.step(20);
  assert.equal(page.paints(), 1, "cap rendering at 24 fps");
  page.step(50);
  assert.equal(page.paints(), 2);
  const at = (x, y) => ({ button: 0, clientX: x * 2, clientY: y * 2, pointerId: 2, preventDefault() {} });
  page.canvas.events.pointermove(at(178, 75));
  assert.equal(page.canvas.style.cursor, "pointer", "the matchbox on the mantel answers the pointer");
  page.canvas.events.pointerdown(at(178, 75));
  assert.match(page.elements["hearth-status"].textContent, /match/);
  assert.equal(page.fire().match(), null);
  page.canvas.events.pointermove(at(400, 280));
  assert.equal(page.canvas.style.cursor, "none", "the match in hand replaces the cursor");
  page.canvas.events.pointerdown({ button: 0, clientX: 800, clientY: 560, pointerId: 1, preventDefault() {} });
  assert.ok(page.fire().match(), "with the match in hand, a click strikes it there");
  page.canvas.events.pointermove(at(5, 5));
  assert.equal(page.canvas.style.cursor, "");
  const log = page
    .fire()
    .items()
    .find((item) => item.kind === "log" && !item.inHearth);
  const handle = [(log.a.x + log.b.x) / 2, screenY((log.a.y + log.b.y) / 2, (log.a.z + log.b.z) / 2)];
  page.canvas.events.pointermove(at(...handle));
  assert.equal(page.canvas.style.cursor, "grab", "wood under the pointer can be grabbed");
  page.canvas.events.pointerdown(at(...handle));
  assert.ok(page.fire().holding(), "pressing on wood picks it up");
  page.canvas.events.pointermove(at(200, 200));
  assert.equal(page.canvas.style.cursor, "grabbing");
  page.canvas.events.pointerup(at(200, 200));
  assert.equal(page.fire().holding(), false);
  const space = { key: " ", preventDefault() {} };
  page.canvas.events.keydown(space);
  assert.equal(page.frames.size, 0, "Space pauses and cancels scheduled animation");
  assert.match(page.elements["hearth-status"].textContent, /Paused/);
  const before = page.paints();
  page.canvas.events.pointermove(at(178, 75));
  assert.equal(page.paints(), before + 1, "hover highlights still draw while paused");
  page.canvas.events.keydown({ key: "a", preventDefault() {} });
  assert.equal(page.frames.size, 0);
  page.canvas.events.keydown(space);
  assert.equal(page.frames.size, 1);
  page.document.hidden = true;
  page.document.events.visibilitychange();
  assert.equal(page.frames.size, 0, "hidden tabs stop drawing");
  page.document.hidden = false;
  page.document.events.visibilitychange();
  assert.equal(page.frames.size, 1, "visible tabs resume only if playing");
  page.media.events.change({ matches: true });
  assert.equal(page.frames.size, 0);
  const quiet = mount({ reduced: true });
  assert.equal(quiet.paints(), 1);
  assert.equal(quiet.frames.size, 0, "reduced motion starts with a still frame");
  quiet.document.events.visibilitychange();
  assert.equal(quiet.frames.size, 0);
  const unsupported = mount({ supported: false });
  assert.match(unsupported.elements["hearth-status"].textContent, /cannot draw/);
  console.log(
    "Fireplace: teepee physics, fire spread, flames and light, collapse and embers, matches, carrying wood, outdoor fires, hover highlights, the matchbox, pause, reduced motion, and canvas fallback passed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
