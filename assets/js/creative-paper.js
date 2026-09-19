(() => {
  const paper = document.querySelector(".creative-paper");
  const content = paper?.querySelector('[role="main"]');
  if (!content) return;

  let ink = 0;
  let lastMark = -Infinity;
  const mark = () => {
    const now = performance.now();
    if (now - lastMark < 600 || ink >= 1) return;
    lastMark = now;
    ink = Math.min(1, ink + 0.08);
    paper.style.setProperty("--ink-wash", ink.toFixed(2));
  };

  // One wash per deliberate interaction, not a cursor trail or a render loop.
  content.addEventListener("click", mark);
  content.addEventListener("input", mark);
  content.addEventListener("focusin", mark);
  content.addEventListener("keydown", (event) => {
    if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) mark();
  });
})();
