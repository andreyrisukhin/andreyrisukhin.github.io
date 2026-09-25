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
  const activeStep = (id) => steps(id).find((step) => !step.hidden);
  const navigate = (id, direction) => document.querySelector(`#${id} [data-kata-${direction}]`);
  const painting = document.querySelector(".kata-painting");
  const size = () => {
    const box = painting.getBoundingClientRect();
    return [box.width, box.height];
  };
  const sameSize = (before) => before.every((value, index) => Math.abs(value - size()[index]) < 1);
  assert(practice.classList.contains("is-ready"), "Kata initializes");
  assert(Number(getComputedStyle(document.querySelector(".kata-scene")).opacity) >= 0.85, "Fresh bounded dawn is visible before any interaction");
  assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal page overflow");
  const morning = "morning-clear-form";
  const night = "night-soften";
  const boundedSize = size();
  assert(activeStep(morning) === steps(morning)[0], "Morning starts with its first prompt");
  assert(
    activeStep(morning).querySelector("p:not(.kata-step-number)").getClientRects().length > 0,
    "The full instruction is visible without expanding"
  );
  assert(navigate(morning, "back").getAttribute("aria-disabled") === "true", "Back is unavailable on the first prompt");
  navigate(morning, "back").click();
  assert(activeStep(morning) === steps(morning)[0], "Back cannot wrap to the last prompt");
  navigate(morning, "next").focus();
  navigate(morning, "next").click();
  await frame();
  assert(activeStep(morning) === steps(morning)[1], "Next advances one prompt");
  assert(document.activeElement === navigate(morning, "next"), "Next keeps keyboard focus on the control");
  assert(document.querySelector(`#${morning} .kata-steps`).getAttribute("aria-live") === "polite", "New prompts are announced politely");
  assert(Number(practice.style.getPropertyValue("--scene-depth")) >= 0.2, "Changing prompts develops the painting");
  button("night-soften").click();
  assert(practice.dataset.scene === "night", "Sleep Form selects the nighttime painting");
  assert(document.querySelector("#morning-clear-form").hidden, "Inactive form is hidden");
  assert(button("night-soften").getAttribute("aria-pressed") === "true", "Selected form is announced");
  const first = steps(night)[0];
  assert(activeStep(night) === first, "Sleep Form starts independently at its first prompt");
  navigate(night, "next").focus();
  navigate(night, "next").click();
  await frame();
  assert(activeStep(night) === steps(night)[1], "Sleep Form advances one prompt");
  assert(sameSize(boundedSize), "Changing bounded prompts does not resize the painting");
  const text = getComputedStyle(activeStep(night).querySelector("h3")).color;
  assert(text === "rgb(240, 236, 227)", "Nighttime instructions keep the light ink color");
  const motion = document.querySelector("[data-kata-motion]");
  assert(
    getComputedStyle(activeStep(night)).animationPlayState === "paused" || getComputedStyle(activeStep(night)).animationName === "none",
    "Keyboard navigation pauses the floating prompt"
  );
  if (!motion.disabled) {
    motion.focus();
    motion.click();
    assert(practice.classList.contains("is-still"), "Motion control pauses the scene");
    assert(
      steps(night).every((step) => getComputedStyle(step).animationPlayState === "paused"),
      "Motion control pauses floating prompts"
    );
    motion.click();
    assert(!practice.classList.contains("is-still"), "Motion resumes");
    assert(getComputedStyle(activeStep(night)).animationPlayState === "running", "Prompts resume drifting");
  } else {
    assert(practice.classList.contains("is-still"), "Reduced motion stays still");
    assert(getComputedStyle(first).animationName === "none", "Reduced motion disables floating prompts");
    assert(getComputedStyle(document.querySelector(".kata-scene")).transitionDuration === "0s", "Reduced motion disables scene fades");
  }
  button("morning-clear-form").click();
  assert(!document.querySelector("#morning-clear-form").hidden, "Morning Form remains accessible");
  assert(document.querySelector("#night-soften").hidden, "Sleep Form leaves the focus order");
  assert(activeStep(morning) === steps(morning)[1], "Morning remembers its prompt");
  button("night-soften").click();
  assert(activeStep(night) === steps(night)[1], "Sleep Form remembers its prompt");

  const dialog = document.querySelector("[data-kata-immersive]");
  const view = (name) => practice.querySelector(`[data-kata-view="${name}"]`);
  const ink = practice.style.getPropertyValue("--scene-depth");
  const boundedScrollY = window.scrollY;
  view("immersive").click();
  await frame();
  assert(dialog.matches(":modal") && dialog.contains(practice), "Immersive opens the existing practice in a modal dialog");
  assert(view("immersive").getAttribute("aria-pressed") === "true", "Immersive selection is announced");
  assert(document.activeElement === view("immersive"), "Focus moves into the immersive view");
  assert(activeStep(night) === steps(night)[1], "Immersive preserves the current prompt");
  const bounds = painting.getBoundingClientRect();
  assert(bounds.x === 0 && bounds.y === 0 && bounds.width >= innerWidth - 20 && bounds.height === innerHeight, "Painting fills the viewport");
  dialog.scrollTop = 180;
  await frame();
  assert(painting.getBoundingClientRect().top === 0, "Immersive painting stays fixed while steps scroll");
  assert(practice.querySelector(".kata-toolbar").getBoundingClientRect().top === 0, "View controls remain available while scrolling");
  assert(dialog.scrollWidth <= innerWidth, "Immersive view has no horizontal overflow");
  assert(document.documentElement.scrollWidth <= innerWidth, "Immersive view does not overflow the page");
  assert(practice.style.getPropertyValue("--scene-depth") === ink, "Comparing views preserves painting depth");
  view("bounded").click();
  await frame();
  assert(Math.abs(window.scrollY - boundedScrollY) < 1, "Returning from immersive preserves page position");

  // Avoid waiting for decorative crossfades while checking the final artwork.
  const wasPaused = motion.getAttribute("aria-pressed") === "true";
  if (!wasPaused) motion.click();
  const theme = document.documentElement.dataset.theme;
  const checkNavigation = async (viewName, id) => {
    button(id).click();
    const all = steps(id);
    const next = navigate(id, "next");
    const back = navigate(id, "back");
    for (let i = 0; i < all.length; i++) back.click();
    assert(activeStep(id) === all[0], `${viewName}: ${id} Back stops at the first prompt`);
    const before = size();
    next.focus();
    for (let i = 0; i < all.length; i++) {
      await frame();
      const current = activeStep(id);
      assert(current === all[i], `${viewName}: ${id} shows prompt ${i + 1} in order`);
      assert(document.querySelectorAll(".kata-step:not([hidden])").length === 2, `${viewName}: each form retains only one active prompt`);
      assert(
        [...document.querySelectorAll(".kata-step")].filter((step) => step.getClientRects().length).length === 1,
        `${viewName}: only one prompt is rendered`
      );
      assert(
        current.querySelector(".kata-step-number").textContent.trim() === `Step ${i + 1} of ${all.length}`,
        `${viewName}: step count is accurate`
      );
      assert(getComputedStyle(current).opacity === "1", `${viewName}: prompt text never fades`);
      assert(sameSize(before), `${viewName}: prompt ${i + 1} does not zoom the painting`);
      const box = current.getBoundingClientRect();
      const controls = next.parentElement.getBoundingClientRect();
      assert(box.left >= 0 && box.right <= innerWidth && controls.top >= box.bottom - 1, `${viewName}: prompt and controls fit without overlap`);
      assert(
        next.getBoundingClientRect().height >= 44 && back.getBoundingClientRect().height >= 44,
        `${viewName}: navigation has touch-sized targets`
      );
      assert(getComputedStyle(next).animationName === "none", `${viewName}: navigation stays stationary`);
      const cue = document.querySelector(`#${id} .kata-tips`);
      assert(Boolean(cue.getClientRects().length) === (i === all.length - 1), `${viewName}: closing cue appears only at the end`);
      next.click();
      assert(document.activeElement === next, `${viewName}: navigation preserves keyboard focus`);
    }
    assert(activeStep(id) === all.at(-1) && next.getAttribute("aria-disabled") === "true", `${viewName}: Next stops at the final prompt`);
    back.click();
    assert(activeStep(id) === all.at(-2), `${viewName}: Back revisits the previous prompt`);
    next.click();
    if (innerWidth >= 1000) {
      const sceneBox = painting.getBoundingClientRect();
      const controls = next.parentElement.getBoundingClientRect();
      assert(sceneBox.bottom - controls.bottom > sceneBox.height * 0.25, `${viewName}: the lower landscape remains uncovered`);
    }
  };
  const checkSceneVisibility = (viewName, scheme, scene) => {
    const strongerDawn = viewName === "bounded" && scene === "morning";
    const currentDepth = practice.style.getPropertyValue("--scene-depth");
    for (const reveal of [0, 0.6, 1]) {
      practice.style.setProperty("--scene-depth", reveal);
      const expected = strongerDawn ? 0.85 + reveal * 0.15 : 0.1 + reveal * 0.65;
      assert(
        Math.abs(Number(getComputedStyle(document.querySelector(".kata-scene")).opacity) - expected) < 0.001,
        `${viewName}: ${scheme} ${scene} keeps its intended visibility at depth ${reveal}`
      );
    }
    practice.style.setProperty("--scene-depth", currentDepth);
    assert(document.querySelectorAll(".kata-fog").length === 0, `${viewName}: ${scheme} ${scene} has no fog overlay`);
    assert(
      getComputedStyle(document.querySelector(".kata-painting--dawn")).filter === (strongerDawn ? "brightness(0.85) contrast(1.6)" : "none"),
      `${viewName}: ${scheme} ${scene} strengthens the pale source only for bounded dawn`
    );
    assert(
      getComputedStyle(document.querySelector(".kata-painting--night")).filter === "none",
      `${viewName}: ${scheme} ${scene} leaves the night painting unchanged`
    );
    const backdrop = getComputedStyle(activeStep(scene === "morning" ? morning : night), "::before");
    assert(backdrop.content !== "none" && backdrop.opacity === "0.95", `${viewName}: ${scheme} ${scene} protects only the current prompt`);
  };
  for (const viewName of ["immersive", "bounded"]) {
    view(viewName).click();
    await checkNavigation(viewName, morning);
    await checkNavigation(viewName, night);
    for (const scheme of ["dark", "light"]) {
      document.documentElement.dataset.theme = scheme;
      button("morning-clear-form").click();
      assert(getComputedStyle(document.querySelector(".kata-painting--night")).opacity === "0", `${viewName}: ${scheme} mode does not replace dawn`);
      assert(getComputedStyle(document.querySelector(".kata-painting--dawn")).opacity === "1", `${viewName}: ${scheme} Morning Form shows dawn`);
      assert(getComputedStyle(activeStep(morning).querySelector("h3")).color === "rgb(53, 58, 56)", `${viewName}: morning ink stays readable`);
      checkSceneVisibility(viewName, scheme, "morning");
      button("night-soften").click();
      assert(getComputedStyle(document.querySelector(".kata-painting--night")).opacity === "1", `${viewName}: ${scheme} Sleep Form shows night`);
      checkSceneVisibility(viewName, scheme, "night");
    }
  }
  document.documentElement.dataset.theme = theme;
  if (!wasPaused) motion.click();
  view("immersive").click();
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  assert(!dialog.open && practice.dataset.view === "bounded", "Escape returns to bounded view");
  assert(document.activeElement === view("bounded"), "Returning to bounded view restores keyboard focus");
  assert(activeStep(night) === steps(night).at(-1), "Changing views preserves the current prompt");
  assert(document.querySelectorAll("[data-kata-practice]").length === 1, "Changing views does not duplicate the practice");
  return checks;
})();
