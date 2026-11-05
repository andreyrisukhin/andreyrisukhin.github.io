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
  const achievementsModule = await load("fireplace/achievements.mjs");
  const soundModule = await load("fireplace/sound.mjs");
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

  // Bark is slow to catch, and burns off to show the inner wood.
  const barked = createFire();
  run(barked, 5);
  assert.ok(
    barked.items().some((item) => item.kind === "stick" && item.burning),
    "kindling catches first"
  );
  assert.ok(!logs(barked).some((item) => item.burning), "bark keeps the logs from catching right away");
  run(barked, 55);
  const meanBark = (item) => item.bark.reduce((sum, value) => sum + value, 0) / item.bark.length;
  const teepee = logs(barked).filter((item) => item.inHearth);
  assert.ok(
    teepee.every((item) => meanBark(item) < 0.5),
    "burning logs lose their bark"
  );
  assert.ok(
    barked
      .items()
      .filter((item) => item.kind === "log" && !item.inHearth)
      .every((item) => meanBark(item) === 1),
    "spare logs keep theirs"
  );

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
    // A tongue may lick a cell away from the side of its log.
    const queue = [...flame].filter((cell) => [1, -1, 2, -2, 240, -240, 480].some((d) => solid.has(cell + d)));
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
  const fell = new Map();
  for (let i = 0; i < 60; i++) {
    run(fast, 1);
    sparks = Math.max(sparks, fast.stats().sparks);
    for (const item of logs(fast)) if (start.some((log) => log.id === item.id) && !upright(item) && !fell.has(item.id)) fell.set(item.id, i);
  }
  assert.equal(fell.size, start.length, "every teepee log falls");
  assert.ok(Math.max(...fell.values()) - Math.min(...fell.values()) <= 1, "the teepee falls in together, not one log at a time");
  const burnt = fast.items().filter((item) => item.inHearth && item.kind === "log");
  assert.ok(
    burnt.every((item) => item.char > 0.5 && item.mass < 1),
    "logs char and lose mass"
  );
  assert.ok(burnt.length < start.length || burnt.some((item) => !upright(item)), "the teepee collapses as the logs burn");
  assert.ok(sparks > 10, "burning and falling logs throw sparks");
  assert.ok(fast.stats().embers > 0.05, "burnt wood leaves embers");

  // Charred wood whose flame dies keeps glowing as coal, and gives off heat, rather than going dark at once.
  const coals = createFire({ burnScale: 0.1 });
  const glowing = () => {
    for (const item of logs(coals)) {
      for (let k = 0; k < item.coal.length; k++) if (item.coal[k] > 0.3 && !item.fire[k]) return { id: item.id, k };
    }
    return null;
  };
  let coal = null;
  for (let t = 0; t < 240 && !coal; t++) {
    run(coals, 1);
    coal = glowing();
  }
  assert.ok(coal, "a charred section left without flame glows as coal");
  const section = () => coals.items().find((item) => item.id === coal.id);
  assert.ok(section().heat[coal.k] > 0.3, "a coal stays hot");
  run(coals, 3);
  assert.ok(section() && (section().coal[coal.k] > 0.1 || section().fire[coal.k] > 0), "a coal glows on for a while, or flares back up");
  assert.ok(coals.stats().coals > 0 || coals.stats().burning > 0);

  // Frames between steps are drawn part way along, so motion does not jump a whole step at a time.
  const smooth = createFire();
  run(smooth, 10);
  smooth.step(STEP / 2);
  assert.ok(smooth.blend() > 0 && smooth.blend() < 1, "the fire knows where a frame falls between steps");
  const flameCells = (layers) => layers.flames.filter((value) => typeof value !== "string").join();
  const resting = smooth.items();
  assert.notEqual(flameCells(smooth.render(0, 0)), flameCells(smooth.render(0, 1)), "flames move between steps");
  assert.deepEqual(smooth.items(), resting, "blending does not move anything");

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

  // Books on the mantel cannot be picked up or lit with a match; fire has to reach them.
  const middle = (item) => ({ x: (item.a.x + item.b.x) / 2, y: screenY((item.a.y + item.b.y) / 2, (item.a.z + item.b.z) / 2) });
  const shelf = createFire({ lit: 0 });
  assert.equal(shelf.books().length, 4);
  assert.equal(shelf.hover(315, 68), null, "books cannot be picked up");
  assert.equal(shelf.grab(315, 68), false);
  shelf.strike(315, 68);
  run(shelf, 4);
  assert.ok(
    shelf.books().every((book) => !book.burning),
    "a match only scorches a book"
  );
  assert.ok(shelf.grab(SUPPLIES.paper.x + 20, SUPPLIES.paper.y + 8));
  shelf.drag(250, 60);
  run(shelf, 1);
  shelf.release();
  run(shelf, 2);
  const rested = shelf.items().find((item) => item.kind === "paper" && !item.inHearth);
  assert.ok(Math.abs(middle(rested).y + rested.r - scene.SHELF.y) < 2, "things set on the mantel rest on it");
  assert.ok(shelf.grab(SUPPLIES.paper.x + 20, SUPPLIES.paper.y + 8));
  shelf.drag(light.CANDLE.x, light.CANDLE.y + 2);
  run(shelf, 2);
  assert.ok(shelf.stats().heldBurning, "paper held in the candle flame catches");
  assert.ok(shelf.events().some((event) => event.type === "ignite" && event.source === "candle"));

  // A burning stick held against the books lights them, and fire climbs the stack.
  const study = createFire();
  run(study, 20);
  assert.ok(study.grab(SUPPLIES.stick.x + 22, SUPPLIES.stick.y + 17));
  for (const [x, y] of [
    [150, 200],
    [220, 215],
    [240, 225],
  ]) {
    study.drag(x, y);
    run(study, 0.5);
  }
  for (let t = 0; t < 20 && !study.stats().heldBurning; t++) run(study, 0.5);
  assert.ok(study.stats().heldBurning, "a stick held in the fire catches");
  // Let it get going before carrying it out.
  run(study, 3);
  for (const [x, y] of [
    [260, 150],
    [300, 90],
    [316, 70],
  ]) {
    study.drag(x, y);
    run(study, 0.4);
  }
  for (let t = 0; t < 40 && !study.books().some((book) => book.burning); t++) run(study, 0.5);
  assert.ok(
    study.books().some((book) => book.burning),
    "a torch lights a book"
  );
  assert.ok(study.events().some((event) => event.type === "ignite" && event.kind === "book"));
  study.release();
  run(study, 30);
  assert.ok(study.books().filter((book) => book.burning).length >= 3, "fire spreads up the stack of books");

  // Two burning logs on the floorboards light them. The floor fire spreads a few boards, then dies, leaving char.
  const room = createFire();
  run(room, 50);
  for (const [n, chosen] of logs(room)
    .filter((item) => item.burning)
    .slice(0, 2)
    .entries()) {
    const from = middle(room.items().find((item) => item.id === chosen.id));
    assert.ok(room.grab(from.x, from.y));
    for (const [x, y] of [
      [from.x, 200],
      [200, 250],
      [140, 290],
      [110, 296 + n * 6],
    ]) {
      room.drag(x, y);
      run(room, 0.4);
    }
    room.release();
    run(room, 1);
  }
  let lit = null;
  for (let t = 0; t < 30 && lit === null; t++) {
    run(room, 1);
    if (room.stats().floor) lit = t;
  }
  assert.ok(lit !== null && lit > 2, "the floor takes a while to catch under burning logs");
  assert.ok(room.events().some((event) => event.type === "floor"));
  let peak = 0;
  for (let t = 0; t < 150 && (t < 10 || room.stats().floor); t++) {
    run(room, 1);
    peak = Math.max(peak, room.stats().floor);
  }
  const charred = room.boards().char.filter((value) => value > 0.5).length;
  assert.equal(room.stats().floor, 0, "a floor fire burns itself out");
  assert.ok(peak > 4 && charred > 4, "fire spreads across a few boards");
  assert.ok(charred < 150, "but not across the whole room");
  assert.ok(room.render().floor.length > 0, "burnt boards stay charred");

  // Embers popping out of the grate singe the rug in front without setting it alight.
  const hearthRug = createFire();
  run(hearthRug, 60);
  const rugIndex = [...hearthRug.boards().rug.keys()].filter((i) => hearthRug.boards().rug[i]);
  assert.ok(rugIndex.length > 50, "a rug lies in front of the hearth");
  assert.ok(
    rugIndex.some((i) => hearthRug.boards().char[i] > 0.04),
    "popping embers singe the rug"
  );
  assert.equal(hearthRug.stats().floor, 0, "a few embers do not set the rug alight");

  // One burning log is not enough for bare boards, but the rug catches quickly and burns out to char.
  const rugLog = middle(logs(hearthRug).find((item) => item.burning));
  assert.ok(hearthRug.grab(rugLog.x, rugLog.y));
  for (const [x, y] of [
    [rugLog.x, 200],
    [240, 250],
    [240, 284],
  ]) {
    hearthRug.drag(x, y);
    run(hearthRug, 0.4);
  }
  hearthRug.release();
  let rugLit = null;
  const rugEvents = [];
  for (let t = 0; t < 20 && rugLit === null; t++) {
    run(hearthRug, 1);
    rugEvents.push(...hearthRug.events());
    if (hearthRug.stats().floor) rugLit = t;
  }
  assert.ok(rugLit !== null, "a burning log sets the rug alight");
  assert.ok(rugEvents.some((event) => event.type === "floor" && event.rug));
  for (let t = 0; t < 200 && hearthRug.stats().floor; t++) run(hearthRug, 1);
  assert.equal(hearthRug.stats().floor, 0, "the rug fire burns itself out");
  assert.ok(rugIndex.filter((i) => hearthRug.boards().char[i] > 0.5).length > 20, "the rug is left charred");
  // A mug of water puts out a fire and sends up steam.
  const wet = createFire();
  run(wet, 30);
  const flame = () => wet.items().reduce((sum, item) => sum + item.fire.reduce((a, b) => a + b, 0), 0);
  const flameBefore = flame();
  assert.ok(flameBefore > 10);
  for (let i = 0; i < 60; i++) {
    wet.pour(240 + Math.sin(i / 4) * 45, 190, 1 / 60);
    run(wet, STEP);
  }
  assert.ok(wet.water() > 0, "poured water falls and steams");
  run(wet, 2);
  assert.ok(flame() < flameBefore * 0.15, "a mug of water puts out most of a fire");
  assert.ok(wet.events().some((event) => event.type === "douse"));
  run(wet, 3);
  assert.ok(flame() < flameBefore * 0.2, "soaked wood does not catch again right away");

  // Throwing something on fire is noticed.
  const toss = createFire();
  run(toss, 3);
  const thrown = toss.items().find((item) => item.kind === "paper" && item.burning);
  const hand = middle(thrown);
  assert.ok(toss.grab(hand.x, hand.y));
  toss.drag(hand.x + 120, hand.y - 60);
  run(toss, STEP);
  toss.release();
  assert.ok(toss.events().some((event) => event.type === "fling"));

  // Secrets unlock once and are remembered.
  const { ACHIEVEMENTS, STORAGE_KEY, createAchievements } = achievementsModule;
  assert.equal(ACHIEVEMENTS.length, 11);
  assert.equal(new Set(ACHIEVEMENTS.map((entry) => entry.id)).size, 11);
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const calm = { burning: 3, floor: 0, embers: 0.3, heldBurning: false };
  const secrets = createAchievements(storage);
  assert.deepEqual(secrets.observe([], calm, 0.1), []);
  const first = secrets.observe([{ type: "ignite", kind: "book", source: "spread", inHearth: false }, { type: "douse" }], calm, 0.1);
  assert.deepEqual(
    first.map((entry) => entry.id),
    ["books", "hiss"]
  );
  assert.deepEqual(secrets.observe([{ type: "douse" }], calm, 0.1), [], "a secret is found only once");
  for (let i = 0; i < 3; i++) secrets.observe([], { ...calm, heldBurning: true }, 1);
  assert.deepEqual(
    secrets.observe([], { ...calm, heldBurning: true }, 1).map((entry) => entry.id),
    ["torch"]
  );
  secrets.watered();
  assert.deepEqual(secrets.observe([], { ...calm, burning: 0, embers: 0 }, 1), [], "a doused fire did not burn out on its own");
  secrets.observe([{ type: "ignite", kind: "paper", source: "match", inHearth: true }], calm, 1);
  assert.deepEqual(
    secrets.observe([], { ...calm, burning: 0, embers: 0.01 }, 1).map((entry) => entry.id),
    ["ashes"]
  );
  assert.deepEqual(JSON.parse(saved.get(STORAGE_KEY)), ["books", "hiss", "torch", "kindled", "ashes"]);
  assert.equal(createAchievements(storage).found().length, 5, "found secrets are remembered");
  assert.equal(createAchievements({ getItem: () => "not json", setItem() {} }).found().length, 0);
  const blocked = createAchievements({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  });
  assert.equal(blocked.observe([{ type: "split" }], calm, 1)[0].id, "timber", "secrets still work without storage");
  assert.equal(blocked.observe([{ type: "boil" }], calm, 1)[0].id, "tea");
  function mount({ reduced = false, supported = true, search = "", saved = null, sound = null } = {}) {
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
      "hearth-toast": new Element(),
      "hearth-found": new Element(),
      "hearth-found-count": new Element(),
      "hearth-found-list": new Element(),
    };
    const store = new Map(saved ? [[achievementsModule.STORAGE_KEY, JSON.stringify(saved)]] : []);
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
      ...achievementsModule,
      ...soundModule,
      document,
      setTimeout: () => 1,
      clearTimeout: () => {},
      URLSearchParams,
      window: {
        matchMedia: () => media,
        location: { search: search || "?burn=2&flame=abc" },
        localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
      },
      requestAnimationFrame: (callback) => {
        frames.set(++id, callback);
        return id;
      },
      cancelAnimationFrame: (key) => frames.delete(key),
    };
    let created;
    if (sound) sandbox.createHearthSound = () => sound;
    sandbox.createFire = (options) => (created = pixelFire.createFire(options));
    vm.runInNewContext(code, sandbox);
    return {
      elements,
      store,
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

  let wakes = 0,
    pauses = 0;
  const audioPage = mount({ sound: { wake: () => wakes++, pause: () => pauses++ } });
  assert.equal(wakes, 1, "attempt autoplay without a gesture");
  audioPage.document.events.pointerup();
  assert.equal(wakes, 2, "a touch release anywhere retries blocked autoplay");
  audioPage.document.hidden = true;
  audioPage.document.events.visibilitychange();
  audioPage.document.events.keydown();
  assert.equal(pauses, 1);
  assert.equal(wakes, 2, "do not wake hidden audio");
  audioPage.document.hidden = false;
  audioPage.document.events.visibilitychange();
  assert.equal(wakes, 3, "resume on return without another click");
  const page = mount();
  assert.equal(page.elements["hearth-found"].hidden, true, "no hint of secrets before one is found");
  assert.equal(page.elements["hearth-toast"].hidden, true);
  assert.equal(page.fire().options.burnScale, 2, "URL parameters tune the fire");
  assert.equal(page.fire().options.flameHeight, pixelFire.DEFAULTS.flameHeight);
  assert.equal(page.paints(), 1, "draw an initial frame immediately");
  assert.equal(page.frames.size, 1);
  page.step(0);
  page.step(8);
  assert.equal(page.paints(), 1, "cap rendering at about 60 fps");
  page.step(20);
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
  // The mug: pick it up, hold to pour, set it back down to refill.
  page.canvas.events.pointermove(at(385, 255));
  assert.equal(page.canvas.style.cursor, "pointer", "the mug answers the pointer");
  page.canvas.events.pointerdown(at(385, 255));
  assert.match(page.elements["hearth-status"].textContent, /mug/);
  page.canvas.events.pointermove(at(240, 190));
  assert.equal(page.canvas.style.cursor, "none");
  page.canvas.events.pointerdown(at(240, 190));
  for (let n = 1; n <= 6; n++) page.step(1000 + n * 50);
  assert.ok(page.fire().water() > 0, "holding the button pours water");
  page.canvas.events.pointerup(at(240, 190));
  page.canvas.events.keydown({ key: "Escape", preventDefault() {} });
  assert.match(page.elements["hearth-status"].textContent, /full again/, "Escape sets the mug back down");
  page.canvas.events.pointermove(at(240, 190));
  assert.notEqual(page.canvas.style.cursor, "none");
  // A secret found while the fire runs shows a notice and joins the list.
  page.fire().events();
  for (let n = 1; n <= 60 && page.elements["hearth-toast"].hidden; n++) {
    page.fire().pour(236 + (n % 5) * 3, 222, 0.05);
    page.step(2000 + n * 50);
  }
  assert.equal(page.elements["hearth-toast"].hidden, false, "finding a secret shows a notice");
  assert.match(page.elements["hearth-toast"].textContent, /Secret found: Hiss/);
  assert.equal(page.elements["hearth-found"].hidden, false);
  assert.equal(page.elements["hearth-found-count"].textContent, "1 of 11 found");
  assert.match(page.elements["hearth-found-list"].innerHTML, /Hiss/);
  assert.deepEqual(JSON.parse(page.store.get(achievementsModule.STORAGE_KEY)), ["hiss"]);
  const returning = mount({ saved: ["books", "floor"] });
  assert.equal(returning.elements["hearth-found-count"].textContent, "2 of 11 found", "found secrets are listed on return");
  assert.equal(returning.elements["hearth-found"].hidden, false);
  // Held over the fire, the mug of water boils: a secret.
  const brew = mount();
  for (let n = 0; n < 30 / STEP; n++) brew.fire().step(STEP);
  brew.fire().events();
  brew.canvas.events.pointerdown(at(385, 255));
  brew.canvas.events.pointermove(at(236, 186));
  for (let n = 1; n <= 300 && brew.elements["hearth-toast"].hidden; n++) brew.step(n * 50);
  assert.match(brew.elements["hearth-toast"].textContent, /Secret found: Tea time/, "a mug held over the fire boils");
  assert.match(brew.elements["hearth-status"].textContent, /boiling/);
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
    "Fireplace: teepee physics, fire spread, flames and light, collapse and embers, matches, carrying wood, bark, outdoor fires, hover highlights, the matchbox, books, shelf, candle, floorboards, the rug, water, tea, secrets, pause, reduced motion, and canvas fallback passed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
