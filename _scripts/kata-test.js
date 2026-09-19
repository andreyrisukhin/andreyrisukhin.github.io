// node _scripts/kata-test.js [Jekyll destination]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.events = {};
    this.attributes = {};
    this.hidden = true;
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)),
    };
    this.style = { setProperty: (name, value) => (this.attributes[name] = value) };
  }
  addEventListener(name, callback) {
    this.events[name] = callback;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function mount({ hash = "", reducedMotion = false } = {}) {
  const recipes = ["morning-clear-form", "night-soften"].map((id, i) => {
    const element = new Element({ scene: i ? "night" : "morning" });
    element.id = id;
    return element;
  });
  const buttons = recipes.map((recipe) => new Element({ kataToggle: recipe.id }));
  const steps = [new Element(), new Element()];
  const nav = new Element();
  const motion = new Element();
  const practice = new Element();
  practice.querySelectorAll = (selector) => ({ "[data-kata-toggle]": buttons, "[data-kata-recipe]": recipes, ".kata-step": steps })[selector];
  practice.querySelector = (selector) => ({ "[data-kata-motion]": motion, ".kata-nav": nav })[selector];
  const reduced = new Element();
  reduced.matches = reducedMotion;
  vm.runInNewContext(read("assets/js/kata.js"), {
    document: { querySelector: () => practice },
    window: { location: { hash }, matchMedia: () => reduced },
  });
  return { practice, recipes, buttons, steps, motion, nav, reduced };
}

const app = mount();
assert.equal(app.recipes[0].hidden, false);
assert.equal(app.recipes[1].hidden, true);
assert.equal(app.buttons[0].attributes["aria-pressed"], "true");
assert.equal(app.nav.hidden, false);
assert.equal(app.motion.hidden, false);
assert.equal(app.practice.attributes["--scene-depth"], undefined, "Starts with unpainted paper");
app.buttons[1].events.click();
assert.equal(app.practice.dataset.scene, "night");
assert.equal(app.recipes[1].hidden, false);
assert.equal(app.recipes[0].hidden, true);
assert.equal(app.buttons[0].attributes["aria-pressed"], "false");
assert.equal(app.buttons[1].attributes["aria-pressed"], "true");
assert.equal(app.practice.attributes["--scene-depth"], "0.2");
app.steps[0].open = true;
app.steps[0].events.toggle();
assert.equal(app.practice.attributes["--scene-depth"], "0.4");
app.steps[0].open = false;
app.steps[0].events.toggle();
assert.equal(app.practice.attributes["--scene-depth"], "0.4", "Closing does not add paint");
for (let i = 0; i < 12; i++) app.buttons[0].events.click();
assert.equal(app.practice.attributes["--scene-depth"], "1.0", "Paint remains bounded");
app.motion.events.click();
assert.equal(app.motion.textContent, "Resume motion");
assert.ok(app.practice.classes.has("is-still"));
app.motion.events.click();
assert.ok(!app.practice.classes.has("is-still"));
app.reduced.matches = true;
app.reduced.events.change();
assert.ok(app.motion.disabled);
assert.ok(app.practice.classes.has("is-still"));
app.reduced.matches = false;
app.reduced.events.change();
assert.ok(!app.motion.disabled);
assert.ok(!app.practice.classes.has("is-still"));
assert.equal(mount({ hash: "#night-soften" }).practice.dataset.scene, "night");
assert.equal(mount({ hash: "#missing" }).practice.dataset.scene, "morning");
assert.ok(mount({ reducedMotion: true }).motion.disabled);
vm.runInNewContext(read("assets/js/kata.js"), { document: { querySelector: () => null } });

const content = new Element();
const paper = new Element();
paper.querySelector = () => content;
let now = 0;
vm.runInNewContext(read("assets/js/creative-paper.js"), {
  document: { querySelector: () => paper },
  performance: { now: () => now },
});
assert.equal(paper.attributes["--ink-wash"], undefined);
content.events.click();
assert.equal(paper.attributes["--ink-wash"], "0.08");
content.events.input();
assert.equal(paper.attributes["--ink-wash"], "0.08", "Input bursts are throttled");
now = 700;
content.events.focusin();
assert.equal(paper.attributes["--ink-wash"], "0.16", "Keyboard focus paints too");
now = 1400;
content.events.keydown({ repeat: true });
assert.equal(paper.attributes["--ink-wash"], "0.16", "Held keys do not flood the paper");
content.events.keydown({ repeat: false });
assert.equal(paper.attributes["--ink-wash"], "0.24");
for (let i = 0; i < 30; i++) {
  now += 700;
  content.events.click();
}
assert.equal(paper.attributes["--ink-wash"], "1.00");
vm.runInNewContext(read("assets/js/creative-paper.js"), { document: { querySelector: () => null } });

if (process.argv[2]) {
  const site = path.resolve(process.argv[2]);
  const routes = ["kata/", "ditherer/", "music/", "music/scales/", "music/sheet/cogwork-dancers/"];
  for (const route of [...routes, "", "blog/", "publications/", "terrarium/"]) {
    const html = fs.readFileSync(path.join(site, route, "index.html"), "utf8");
    const creative = routes.includes(route);
    assert.equal(/<body[^>]+creative-paper/.test(html), creative, route + " theme boundary");
    assert.equal(html.includes("/assets/css/creative.css"), creative, route + " CSS boundary");
    assert.equal(html.includes("/assets/js/creative-paper.js"), creative, route + " JS boundary");
  }
  const html = fs.readFileSync(path.join(site, "kata/index.html"), "utf8");
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((html.match(/<details class="kata-step"/g) || []).length, 11);
  assert.ok(!/<section[^>]*data-kata-recipe[^>]*\shidden/.test(html), "Both recipes available without JS");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "No duplicate IDs");
  for (const asset of [
    "assets/css/creative.css",
    "assets/js/creative-paper.js",
    "assets/js/kata.js",
    "assets/img/kata/shattered-plains-night.webp",
    "assets/img/kata/shattered-plains-dawn.webp",
  ]) {
    assert.ok(fs.existsSync(path.join(site, asset)), asset + " is built");
  }
  const precache = vm.runInNewContext(fs.readFileSync(path.join(site, "sw.js"), "utf8") + "\nPRECACHE_URLS;", {
    self: { addEventListener() {} },
  });
  assert.ok(precache.includes("/assets/css/creative.css"), "Music offline cache includes creative styles");
  assert.ok(precache.includes("/assets/js/creative-paper.js"), "Music offline cache includes creative interactions");
}
console.log("Kata selection, disclosures, motion, deep links, bounded ink, and creative route checks passed");
