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
  append(element) {
    element.parentNode = this;
  }
  insertBefore(element, next) {
    element.parentNode = this;
    element.nextSibling = next;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  focus() {
    this.focused = true;
  }
}

function mount({ hash = "", reducedMotion = false } = {}) {
  const stepSets = [6, 5].map((count) => Array.from({ length: count }, () => new Element()));
  const lists = [new Element(), new Element()];
  const backs = [new Element(), new Element()];
  const forwards = [new Element(), new Element()];
  const stepNavs = [new Element(), new Element()];
  const recipes = ["morning-clear-form", "night-soften"].map((id, i) => {
    const element = new Element({ scene: i ? "night" : "morning" });
    element.id = id;
    element.querySelectorAll = (selector) => ({ ".kata-step": stepSets[i] })[selector];
    element.querySelector = (selector) =>
      ({ ".kata-steps": lists[i], "[data-kata-back]": backs[i], "[data-kata-next]": forwards[i], ".kata-step-nav": stepNavs[i] })[selector];
    return element;
  });
  const buttons = recipes.map((recipe) => new Element({ kataToggle: recipe.id }));
  const nav = new Element();
  const viewGroup = new Element();
  const views = ["bounded", "immersive"].map((kataView) => new Element({ kataView }));
  const immersive = new Element();
  const home = new Element();
  const motion = new Element();
  const practice = new Element({ view: "bounded" });
  practice.parentNode = home;
  practice.nextSibling = immersive;
  practice.querySelectorAll = (selector) => ({ "[data-kata-toggle]": buttons, "[data-kata-recipe]": recipes, "[data-kata-view]": views })[selector];
  practice.querySelector = (selector) => ({ "[data-kata-motion]": motion, ".kata-nav": nav, ".kata-view": viewGroup })[selector];
  const reduced = new Element();
  reduced.matches = reducedMotion;
  const window = {
    location: { hash },
    matchMedia: () => reduced,
    scrollY: 400,
    scrollTo: ({ top }) => (window.scrollY = top),
  };
  vm.runInNewContext(read("assets/js/kata.js"), {
    document: { querySelector: (selector) => ({ "[data-kata-practice]": practice, "[data-kata-immersive]": immersive })[selector] },
    window,
  });
  return { practice, recipes, buttons, stepSets, lists, backs, forwards, stepNavs, motion, nav, reduced, views, viewGroup, immersive, home, window };
}

const app = mount();
assert.equal(app.recipes[0].hidden, false);
assert.equal(app.recipes[1].hidden, true);
assert.equal(app.buttons[0].attributes["aria-pressed"], "true");
assert.equal(app.nav.hidden, false);
assert.equal(app.motion.hidden, false);
assert.equal(app.viewGroup.hidden, false);
assert.equal(app.practice.attributes["--scene-depth"], undefined, "Initial render does not develop the painting");
for (let i = 0; i < 2; i++) {
  assert.deepEqual(
    app.stepSets[i].map((step) => step.hidden),
    app.stepSets[i].map((_, index) => index !== 0),
    "Starts on one prompt per form"
  );
  assert.equal(app.backs[i].attributes["aria-disabled"], "true");
  assert.equal(app.forwards[i].attributes["aria-disabled"], "false");
  assert.equal(app.stepNavs[i].hidden, false);
  assert.equal(app.lists[i].attributes["aria-live"], "polite");
  assert.equal(app.lists[i].attributes["aria-atomic"], "true");
}
app.backs[0].events.click();
assert.equal(app.practice.attributes["--scene-depth"], undefined, "Back on the first step is a no-op");
app.buttons[1].events.click();
assert.equal(app.practice.dataset.scene, "night");
assert.equal(app.recipes[1].hidden, false);
assert.equal(app.recipes[0].hidden, true);
assert.equal(app.buttons[0].attributes["aria-pressed"], "false");
assert.equal(app.buttons[1].attributes["aria-pressed"], "true");
assert.equal(app.practice.attributes["--scene-depth"], "0.2");
app.forwards[1].events.click();
assert.equal(app.practice.attributes["--scene-depth"], "0.4");
assert.equal(app.stepSets[1][0].hidden, true);
assert.equal(app.stepSets[1][1].hidden, false);
app.backs[1].events.click();
assert.equal(app.stepSets[1][0].hidden, false, "Back restores the previous prompt");
for (let i = 0; i < 10; i++) app.forwards[1].events.click();
assert.equal(app.stepSets[1].filter((step) => !step.hidden).length, 1, "Only one prompt remains visible");
assert.equal(app.stepSets[1][4].hidden, false, "Next stops at the last prompt");
assert.equal(app.forwards[1].attributes["aria-disabled"], "true");
app.buttons[0].events.click();
assert.equal(app.stepSets[0][0].hidden, false, "Forms have independent progress");
app.forwards[0].events.click();
app.buttons[1].events.click();
assert.equal(app.stepSets[1][4].hidden, false, "Switching forms preserves the current prompt");
app.buttons[0].events.click();
assert.equal(app.stepSets[0][1].hidden, false, "Returning to morning preserves its prompt");
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
app.buttons[1].events.click();
app.motion.events.click();
app.views[1].events.click();
assert.equal(app.practice.dataset.view, "immersive");
assert.equal(app.practice.parentNode, app.immersive);
assert.equal(app.immersive.open, true);
assert.equal(app.views[1].attributes["aria-pressed"], "true");
assert.equal(app.views[0].attributes["aria-pressed"], "false");
assert.ok(app.views[1].focused);
assert.ok(!app.stepSets[1][4].hidden && app.practice.classes.has("is-still"), "Immersive preserves the current prompt and motion setting");
app.window.scrollY = 0;
app.views[0].events.click();
assert.equal(app.practice.parentNode, app.home);
assert.equal(app.practice.nextSibling, app.immersive);
assert.equal(app.immersive.open, false);
assert.equal(app.practice.dataset.view, "bounded");
assert.ok(app.views[0].focused);
assert.equal(app.window.scrollY, 400, "Returning from immersive restores the page position");
app.views[1].events.click();
let cancelled = false;
app.immersive.events.cancel({ preventDefault: () => (cancelled = true) });
assert.ok(cancelled);
assert.equal(app.immersive.open, false);
assert.equal(app.practice.parentNode, app.home, "Escape restores the bounded practice");
assert.equal(app.practice.dataset.scene, "night", "Changing view keeps the selected form");
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
  assert.equal((html.match(/<li class="kata-step"/g) || []).length, 11);
  assert.equal((html.match(/data-kata-back/g) || []).length, 2);
  assert.equal((html.match(/data-kata-next/g) || []).length, 2);
  assert.ok(!/<li[^>]*class="kata-step"[^>]*\shidden/.test(html), "Every prompt is available without JS");
  assert.ok(!html.includes("<details"), "Prompts do not need expanding");
  assert.ok(!html.includes("kata-fog"), "No fog overlays are built");
  const css = fs.readFileSync(path.join(site, "assets/css/creative.css"), "utf8");
  assert.ok(!/kata-fog|kata-mist|--scene-haze/.test(css), "Fog styles and animations are removed");
  assert.ok(html.includes('data-kata-view="immersive"'), "Immersive comparison control is built");
  assert.ok(html.includes('aria-label="Immersive kata practice"'), "Immersive view has an accessible dialog");
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
console.log("Kata selection, prompt navigation, motion, deep links, bounded ink, and creative route checks passed");
