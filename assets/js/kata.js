(() => {
  const practice = document.querySelector("[data-kata-practice]");
  if (!practice) return;
  const buttons = [...practice.querySelectorAll("[data-kata-toggle]")];
  const recipes = [...practice.querySelectorAll("[data-kata-recipe]")];
  const views = [...practice.querySelectorAll("[data-kata-view]")];
  const immersive = document.querySelector("[data-kata-immersive]");
  const home = practice.parentNode;
  const next = practice.nextSibling;
  const motion = practice.querySelector("[data-kata-motion]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  let depth = 0;
  let boundedScrollY = 0;

  const progress = recipes.map((recipe) => ({
    recipe,
    steps: [...recipe.querySelectorAll(".kata-step")],
    back: recipe.querySelector("[data-kata-back]"),
    forward: recipe.querySelector("[data-kata-next]"),
    index: 0,
  }));

  function reveal() {
    depth = Math.min(1, depth + 0.2);
    practice.style.setProperty("--scene-depth", depth.toFixed(1));
  }

  function showStep(state) {
    state.steps.forEach((step, index) => (step.hidden = index !== state.index));
    // Keep boundary controls focusable so advancing never drops keyboard focus.
    state.back.setAttribute("aria-disabled", String(state.index === 0));
    state.forward.setAttribute("aria-disabled", String(state.index === state.steps.length - 1));
  }

  function advance(state, direction) {
    const index = state.index + direction;
    if (index < 0 || index >= state.steps.length) return;
    state.index = index;
    showStep(state);
    reveal();
  }

  function select(id, paint = true) {
    const selected = recipes.find((recipe) => recipe.id === id);
    if (!selected) return;
    recipes.forEach((recipe) => (recipe.hidden = recipe !== selected));
    buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kataToggle === id)));
    practice.dataset.scene = selected.dataset.scene;
    if (paint) reveal();
  }

  function updateMotion() {
    practice.classList.toggle("is-still", paused || reduced.matches);
    motion.setAttribute("aria-pressed", String(paused || reduced.matches));
    motion.textContent = reduced.matches ? "Reduced motion" : paused ? "Resume motion" : "Pause motion";
    motion.disabled = reduced.matches;
  }

  function setView(view) {
    if (view === practice.dataset.view) return;
    if (view === "immersive") boundedScrollY = window.scrollY;
    practice.dataset.view = view;
    views.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kataView === view)));
    if (view === "immersive") {
      immersive.append(practice);
      immersive.showModal();
      immersive.scrollTop = 0;
    } else {
      home.insertBefore(practice, next);
      immersive.close();
    }
    views.find((button) => button.dataset.kataView === view).focus({ preventScroll: true });
    if (view === "bounded") window.scrollTo({ top: boundedScrollY, behavior: "instant" });
  }

  views.forEach((button) => button.addEventListener("click", () => setView(button.dataset.kataView)));
  immersive.addEventListener("cancel", (event) => {
    event.preventDefault();
    setView("bounded");
  });
  buttons.forEach((button) => button.addEventListener("click", () => select(button.dataset.kataToggle)));
  progress.forEach((state) => {
    showStep(state);
    const list = state.recipe.querySelector(".kata-steps");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("aria-atomic", "true");
    state.back.addEventListener("click", () => advance(state, -1));
    state.forward.addEventListener("click", () => advance(state, 1));
    state.recipe.querySelector(".kata-step-nav").hidden = false;
  });
  motion.addEventListener("click", () => {
    paused = !paused;
    updateMotion();
  });
  reduced.addEventListener("change", updateMotion);
  const initial = recipes.find((recipe) => `#${recipe.id}` === window.location.hash) || recipes[0];
  select(initial.id, false);
  updateMotion();
  practice.classList.add("is-ready");
  practice.querySelector(".kata-nav").hidden = false;
  practice.querySelector(".kata-view").hidden = false;
  motion.hidden = false;
})();
