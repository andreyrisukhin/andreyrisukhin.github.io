(() => {
  const practice = document.querySelector("[data-kata-practice]");
  if (!practice) return;
  const buttons = [...practice.querySelectorAll("[data-kata-toggle]")];
  const recipes = [...practice.querySelectorAll("[data-kata-recipe]")];
  const motion = practice.querySelector("[data-kata-motion]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  let depth = 0;

  function reveal() {
    depth = Math.min(1, depth + 0.2);
    practice.style.setProperty("--scene-depth", depth.toFixed(1));
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

  buttons.forEach((button) => button.addEventListener("click", () => select(button.dataset.kataToggle)));
  practice.querySelectorAll(".kata-step").forEach((step) => {
    step.addEventListener("toggle", () => {
      if (step.open) reveal();
    });
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
  motion.hidden = false;
})();
