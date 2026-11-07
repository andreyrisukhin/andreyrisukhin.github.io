// Run with agent-browser eval --stdin on a freshly loaded /ditherer/ page, at desktop and mobile widths.
(async () => {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const status = document.getElementById("ditherer-status");
  const output = document.getElementById("ditherer-output");
  const panel = document.querySelector(".ditherer-panel");
  const samples = [...document.querySelectorAll(".ditherer-sample")];
  const waitFor = async (test, label) => {
    for (let i = 0; i < 100 && !test(); i++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert(test(), label);
  };

  // A ring drawn with outline or a positive offset paints outside the element,
  // where the panel's scroll box clips it.
  const paintedBox = (el) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const spill = style.outlineStyle === "none" ? 0 : Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
    return { left: box.left - spill, right: box.right + spill, top: box.top - spill, bottom: box.bottom + spill };
  };
  const clipBox = (el) => {
    const box = el.getBoundingClientRect();
    const left = box.left + el.clientLeft;
    const top = box.top + el.clientTop;
    return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
  };
  const fitsInside = (inner, outer) =>
    inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

  await waitFor(() => status.textContent.startsWith("Output:"), "A sample is dithered on first load");
  assert(samples[0].classList.contains("is-selected") && samples[0].getAttribute("aria-pressed") === "true", "The first sample starts selected");
  assert(output.width > 300 && output.height > 300, "The dithered image renders at full size");
  assert(output.getBoundingClientRect().width >= Math.min(innerWidth * 0.8, 360), "The dithered image is the largest element on the page");
  assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal page overflow");

  if (innerWidth > 900) {
    const caption = document.querySelector(".ditherer-caption").getBoundingClientRect();
    assert(caption.bottom <= innerHeight, "Source, status, and download fit on the first screen");
  }

  for (const [index, sample] of samples.entries()) {
    const before = status.textContent;
    sample.click();
    await waitFor(() => sample.classList.contains("is-selected"), `Sample ${index + 1} becomes selected`);
    await frame();
    assert(
      samples.filter((other) => other.getAttribute("aria-pressed") === "true").length === 1,
      `Sample ${index + 1}: exactly one sample is announced as pressed`
    );
    const ring = getComputedStyle(sample, "::after");
    assert(parseFloat(ring.borderTopWidth) >= 2, `Sample ${index + 1}: the selection ring is drawn`);
    assert(fitsInside(paintedBox(sample), clipBox(panel)), `Sample ${index + 1}: the selection ring is not clipped by the panel`);
    if (index > 0) await waitFor(() => status.textContent !== before || status.textContent.startsWith("Output:"), `Sample ${index + 1} renders`);
  }

  const pixel = document.getElementById("ditherer-pixel");
  const previous = status.textContent;
  pixel.value = String(Number(pixel.value) + 4);
  pixel.dispatchEvent(new Event("input", { bubbles: true }));
  await waitFor(() => status.textContent !== previous, "Changing the pixel size re-renders");
  assert(document.getElementById("ditherer-pixel-value").textContent === pixel.value, "The pixel size label follows the slider");

  const more = document.querySelector(".ditherer-panel details");
  assert(!more.open, "Advanced controls start collapsed");
  assert(!document.querySelector(".tool-footnote").open, "The backstory starts collapsed");

  const square = [...document.querySelectorAll(".ditherer button, .ditherer select, .ditherer input[type='text']")].every(
    (el) => getComputedStyle(el).borderTopLeftRadius === "0px"
  );
  assert(square, "Tool controls are square");
  const range = getComputedStyle(pixel).accentColor;
  assert(range !== "auto", "Sliders use the paper accent, not the browser default");
  return checks;
})();
