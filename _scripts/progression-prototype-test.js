#!/usr/bin/env node
// Controller contracts use the real chord, session, and voicing models.
// Browser checks cover rendering and audio; these pin edit/selection ownership.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const json = (value) => JSON.parse(JSON.stringify(value));

function setup() {
  const elements = new Map();
  let steps = [];
  const document = {
    activeElement: { disabled: false },
    getElementById: (id) => element(id),
    querySelectorAll: () => steps,
    addEventListener(type, callback) {
      this[type] = callback;
    },
    createElement: () => ({
      set textContent(value) {
        this.innerHTML = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      },
    }),
  };
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const attrs = {};
    const classes = new Set();
    const el = {
      id,
      value: "",
      textContent: "",
      _disabled: false,
      get disabled() {
        return this._disabled;
      },
      set disabled(value) {
        this._disabled = value;
        // Browsers blur a focused control as soon as it becomes disabled.
        if (value && document.activeElement === this) document.activeElement = { disabled: false };
      },
      hidden: ["progression-editor", "input-error", "audio-status"].includes(id),
      dataset: {},
      listeners: {},
      addEventListener(type, callback) {
        this.listeners[type] = callback;
      },
      setAttribute: (key, value) => (attrs[key] = value),
      getAttribute: (key) => attrs[key],
      removeAttribute: (key) => delete attrs[key],
      classList: {
        remove: (key) => classes.delete(key),
        toggle: (key, on) => (on ? classes.add(key) : classes.delete(key)),
        contains: (key) => classes.has(key),
      },
      focus() {
        document.activeElement = this;
      },
      select() {},
      click() {
        if (!this.disabled) fire(this, "click");
      },
      contains: (target) => target.id === "chord-input",
      closest() {
        return this.dataset.step === undefined ? null : this;
      },
      querySelector: () => element(id + "-function"),
      set innerHTML(html) {
        if (id !== "sequence-steps") return;
        steps = [...html.matchAll(/data-step="(\d+)"/g)].map((match) => {
          const step = element("step-" + match[1]);
          step.dataset.step = match[1];
          return step;
        });
      },
    };
    elements.set(id, el);
    return el;
  }
  function fire(target, type, props = {}) {
    if (typeof target === "string") target = element(target);
    target.listeners[type]?.({ target, preventDefault() {}, ...props });
  }
  const context = { document };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  [
    "assets/js/vendor/tonal.min.js",
    "assets/js/music/common.js",
    "assets/js/music/chord-name.js",
    "assets/js/music/stradella-data.js",
    "assets/js/workbench/model.js",
    "assets/js/workbench/session.js",
    "_prototypes/two-hands/stradella.js",
    "_prototypes/two-hands/voicings.js",
    "_prototypes/two-hands/inspector.js",
  ].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context));
  let rendered, changeVoicing, audition, stopped;
  const Hands = context.PrototypeHandInspector;
  Hands.render = (chord, range, choice) => {
    rendered = json({ chord, range, choice: choice || {} });
    element("change-status").textContent = chord.name;
  };
  Hands.bind = (hear, callback) => {
    audition = hear;
    changeVoicing = callback;
  };
  Hands.clearInspection = () => {};
  Hands.markSounding = () => {};
  const player = {
    stops: 0,
    running: false,
    onStop: (callback) => (stopped = callback),
    stop() {
      this.stops++;
      this.running = false;
      stopped?.();
    },
    play(pitches, options) {
      this.stop();
      this.running = true;
      this.last = { pitches: json(pitches), options };
      options.onStep(0);
      return Promise.resolve(true);
    },
  };
  context.WorkbenchPlayer = player;
  vm.runInContext(fs.readFileSync(path.join(root, "_prototypes/progression-study/progression.js"), "utf8"), context);
  return {
    $: element,
    fire,
    player,
    document,
    steps: () => steps,
    rendered: () => rendered,
    choose: (choice) => changeVoicing(choice),
    audition: (sound) => audition(sound),
    select: (index) => fire("sequence-steps", "click", { target: steps[index] }),
    insert(name, replace = false) {
      element("chord-input").value = name;
      fire(replace ? "replace-chord" : "chord-form", replace ? "click" : "submit");
    },
  };
}

let count = 0;
function test(name, fn) {
  fn(setup());
  count++;
  console.log("PASS " + name);
}
test("the initial inspector and collapsed editor preserve the approved example", (app) => {
  assert.equal(app.rendered().chord.name, "Am7");
  assert.deepEqual(app.rendered().range, { right: { low: 60, high: 80 }, left: [11, 4, 9, 2, 7, 0] });
  assert.equal(app.$("progression-editor").hidden, true);
  assert.equal(app.steps().length, 3);
  assert.equal(app.$("sequence-name").textContent, "ii–V–I");
});
test("opening and closing editing stops audio and exposes the selected chord", (app) => {
  app.$("play-sequence").click();
  app.$("edit-toggle").click();
  assert.equal(app.player.running, false);
  assert.equal(app.$("progression-editor").hidden, false);
  assert.equal(app.$("chord-input").value, "Am7");
  assert.equal(app.document.activeElement.id, "chord-input");
  app.document.keydown({ key: "Escape" });
  assert.equal(app.$("progression-editor").hidden, true);
  assert.equal(app.document.activeElement.id, "edit-toggle");
});
test("invalid input changes neither the selected chord nor its voicing", (app) => {
  app.choose({ voicing: "stacked", bass: 0 });
  app.insert("<img src=x>", true);
  assert.equal(app.$("chord-input").getAttribute("aria-invalid"), "true");
  assert.equal(app.$("input-error").hidden, false);
  assert.equal(app.rendered().chord.name, "Am7");
  assert.equal(app.rendered().choice.voicing, "stacked");
  assert.equal(app.steps().length, 3);
  app.fire("chord-input", "input");
  assert.equal(app.$("input-error").hidden, true);
});
test("typing interrupts playback before a later step can overwrite the draft", (app) => {
  app.$("edit-toggle").click();
  app.$("play-sequence").click();
  app.$("chord-input").value = "Cmaj7";
  app.fire("chord-input", "input");
  assert.equal(app.player.running, false);
  assert.equal(app.$("chord-input").value, "Cmaj7");
});
test("adding selects the normalized chord and updates step counts and functions", (app) => {
  app.insert(" em7 ");
  assert.equal(app.rendered().chord.name, "Em7");
  assert.equal(app.$("step-position").textContent, "4 of 4");
  assert.equal(app.steps()[3].getAttribute("aria-current"), "step");
  assert.match(app.steps()[3].getAttribute("aria-label"), /Em7, vi7, step 4 of 4/);
  assert.equal(app.$("sequence-name").textContent, "Progression");
  assert.equal(app.$("transition-route").textContent, "Gmaj7 → Em7");
});
test("replacement resets only the replaced step's choices", (app) => {
  app.choose({ voicing: "stacked", bass: 0 });
  app.select(1);
  app.choose({ voicing: "catalog-7", bass: 6 });
  app.insert("Em7", true);
  assert.equal(app.steps().length, 3);
  assert.equal(app.rendered().chord.name, "Em7");
  assert.deepEqual(app.rendered().choice, {});
  app.select(0);
  assert.deepEqual(app.rendered().choice, { voicing: "stacked", bass: 0 });
});
test("duplicate chord steps keep independent choices when moved", (app) => {
  app.choose({ voicing: "stacked", bass: 0 });
  app.insert("Am7");
  app.choose({ voicing: "catalog-m7", bass: 4 });
  app.$("move-earlier").click();
  assert.equal(app.$("step-position").textContent, "3 of 4");
  assert.deepEqual(app.rendered().choice, { voicing: "catalog-m7", bass: 4 });
  app.select(0);
  assert.deepEqual(app.rendered().choice, { voicing: "stacked", bass: 0 });
});
test("removing a preceding step preserves the surviving chord's choices", (app) => {
  app.select(1);
  app.choose({ voicing: "catalog-7", bass: 6 });
  app.select(0);
  app.$("remove-chord").click();
  assert.equal(app.rendered().chord.name, "D7");
  assert.deepEqual(app.rendered().choice, { voicing: "catalog-7", bass: 6 });
  assert.equal(app.$("step-position").textContent, "1 of 2");
});
test("last-step removal has a usable empty state and can start again", (app) => {
  for (let i = 0; i < 3; i++) app.$("remove-chord").click();
  assert.equal(app.steps().length, 0);
  assert.equal(app.$("chord-inspector").hidden, true);
  assert.equal(app.$("empty-sequence").hidden, false);
  ["play-sequence", "previous", "next", "replace-chord", "remove-chord", "move-earlier", "move-later"].forEach((id) => {
    assert.equal(app.$(id).disabled, true, id);
  });
  app.insert("C");
  assert.equal(app.rendered().chord.name, "C");
  assert.equal(app.$("chord-inspector").hidden, false);
  assert.equal(app.$("play-sequence").disabled, false);
  assert.equal(app.$("transition-facts").hidden, true);
  assert.equal(app.$("transition-heading").textContent, "One chord");
});
test("edited transitions do not keep the example's tonic claims", (app) => {
  app.select(2);
  app.insert("Em7", true);
  assert.equal(app.$("transition-route").textContent, "D7 → Em7");
  assert.equal(app.$("common-tones").textContent, "D");
  assert.equal(app.$("transition-note").textContent, "V7 → vi7 in G major. Common tones compare pitch classes, not octaves.");
});
test("common tones retain the source chord's accidental spelling", (app) => {
  app.insert("C#7", true);
  app.select(1);
  app.insert("F#7", true);
  app.select(0);
  assert.equal(app.$("common-tones").textContent, "C♯");
});
test("a wider chord changes the shared window only when the document changes", (app) => {
  app.insert("Bmaj7");
  const range = app.rendered().range;
  assert.ok(range.right.high > 80);
  for (let i = 0; i < 4; i++) {
    app.select(i);
    assert.deepEqual(app.rendered().range, range);
  }
});
test("unavailable left-hand chords remain inspectable but are never silently skipped", (app) => {
  app.insert("Bb7");
  assert.equal(app.rendered().chord.name, "Bb7");
  assert.equal(app.$("play-sequence").disabled, true);
  assert.equal(app.$("sequence-warning").hidden, false);
  assert.match(app.$("sequence-warning").textContent, /step 4 \(Bb7\)/);
  app.$("remove-chord").click();
  assert.equal(app.$("play-sequence").disabled, false);
  assert.equal(app.$("sequence-warning").hidden, true);
});
test("a right-hand audition still has a working Stop button without a left-hand recipe", (app) => {
  app.insert("Bb7");
  app.audition({ midis: [70], leftIds: [], rightMidis: [70] });
  assert.equal(app.$("play").disabled, false);
  assert.equal(app.$("play-label").textContent, "Stop");
  app.$("play").click();
  assert.equal(app.player.running, false);
  assert.equal(app.$("play").disabled, true);
  assert.equal(app.$("play-label").textContent, "Hear both hands");
});
test("arrow and endpoint navigation work on newly inserted steps", (app) => {
  app.insert("Em7");
  app.select(0);
  app.fire("sequence-steps", "keydown", { target: app.steps()[0], key: "End" });
  assert.equal(app.rendered().chord.name, "Em7");
  assert.equal(app.document.activeElement, app.steps()[3]);
  app.fire("sequence-steps", "keydown", { target: app.steps()[3], key: "ArrowLeft" });
  assert.equal(app.rendered().chord.name, "Gmaj7");
  app.fire("sequence-steps", "keydown", { target: app.steps()[2], key: "Home" });
  assert.equal(app.rendered().chord.name, "Am7");
});
test("reordered playback uses each step's exact chosen notes and current order", (app) => {
  app.select(1);
  app.choose({ voicing: "catalog-7", bass: 6 });
  app.$("move-earlier").click();
  app.$("play-sequence").click();
  assert.deepEqual(app.player.last.pitches[0], [42, 48, 54, 57, 62, 66, 69, 72]);
  assert.equal(app.rendered().chord.name, "D7");
  app.player.last.options.onStep(1);
  assert.equal(app.rendered().chord.name, "Am7");
  assert.equal(app.steps()[1].classList.contains("is-playing"), true);
  app.$("remove-chord").click();
  assert.equal(app.player.running, false);
  assert.ok(app.steps().every((step) => !step.classList.contains("is-playing")));
  assert.equal(app.$("sequence-play-label").textContent, "Play all");
});
test("moving to an endpoint does not strand focus on a disabled control", (app) => {
  app.select(1);
  app.$("move-earlier").focus();
  app.$("move-earlier").click();
  assert.equal(app.$("move-earlier").disabled, true);
  assert.equal(app.document.activeElement.id, "chord-input");
});
console.log(count + " progression prototype tests passed");
