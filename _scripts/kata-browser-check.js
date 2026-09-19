// Evaluate in a fresh /kata/ browser page, at desktop and mobile widths.
(async () => {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const practice = document.querySelector("[data-kata-practice]");
  const button = (id) => document.querySelector(`[data-kata-toggle="${id}"]`);
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const steps = (id) => [...document.querySelectorAll(`#${id} .kata-step`)];
  assert(practice.classList.contains("is-ready"), "Kata initializes");
  assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal page overflow");
  button("night-soften").click();
  assert(practice.dataset.scene === "night", "Sleep Form selects the nighttime painting");
  assert(document.querySelector("#morning-clear-form").hidden, "Inactive form is hidden");
  assert(button("night-soften").getAttribute("aria-pressed") === "true", "Selected form is announced");
  const first = steps("night-soften")[0];
  first.querySelector("summary").focus();
  first.querySelector("summary").click();
  await frame();
  assert(first.open, "A step opens through its native disclosure");
  assert(
    getComputedStyle(first.parentElement).animationPlayState === "paused" || getComputedStyle(first.parentElement).animationName === "none",
    "Focused step stops drifting"
  );
  assert(getComputedStyle(first.querySelector("summary")).outlineStyle !== "none", "Keyboard focus is visible");
  const text = getComputedStyle(first.querySelector("p")).color;
  assert(text === "rgb(240, 236, 227)", "Nighttime instructions keep the light ink color");
  const depth = Number(practice.style.getPropertyValue("--scene-depth"));
  assert(depth >= 0.4, "Opening steps develops the painting");
  for (const step of steps("night-soften")) step.open = true;
  await frame();
  assert(document.documentElement.scrollWidth <= innerWidth, "Expanded instructions fit the viewport");
  const boxes = steps("night-soften").map((step) => step.getBoundingClientRect());
  assert(
    boxes.every((box, i) => i === 0 || box.top > boxes[i - 1].bottom),
    "Expanded steps do not overlap"
  );
  assert(
    steps("night-soften").every((step) => getComputedStyle(step).opacity === "1"),
    "Instruction text never fades out"
  );
  const motion = document.querySelector("[data-kata-motion]");
  if (!motion.disabled) {
    motion.click();
    assert(practice.classList.contains("is-still"), "Motion control pauses the scene");
    assert(getComputedStyle(document.querySelector(".kata-fog")).animationPlayState === "paused", "Fog pauses");
    motion.click();
    assert(!practice.classList.contains("is-still"), "Motion resumes");
  } else {
    assert(practice.classList.contains("is-still"), "Reduced motion stays still");
    assert(getComputedStyle(first.parentElement).animationName === "none", "Reduced motion disables floating steps");
    assert(getComputedStyle(document.querySelector(".kata-fog")).animationName === "none", "Reduced motion disables drifting fog");
  }
  button("morning-clear-form").click();
  assert(!document.querySelector("#morning-clear-form").hidden, "Morning Form remains accessible");
  assert(document.querySelector("#night-soften").hidden, "Sleep Form leaves the focus order");
  button("night-soften").click();
  assert(first.open, "Switching forms preserves open instructions");
  return checks;
})();
