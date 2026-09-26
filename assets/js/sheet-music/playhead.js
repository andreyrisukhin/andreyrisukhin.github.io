/*
 * Smooth playhead for OSMD scores.
 *
 * OSMD's own cursor can only jump between note onsets, and walking it to a
 * position means reset() + next() from the start. Doing that every frame is
 * what made playback stall and then leap. Instead, walk the cursor once per
 * render, record where every onset is drawn, and move a lightweight marker
 * between those points from the audio clock.
 *
 * Exposes window.SheetPlayhead = { collectSteps, retime, locate, Playhead }.
 */
(function (root) {
  const LINE_TOLERANCE_PX = 2;

  function realValue(fraction) {
    if (!fraction) return NaN;
    if (typeof fraction.RealValue === "number") return fraction.RealValue;
    if (typeof fraction.realValue === "number") return fraction.realValue;
    return NaN;
  }

  function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
  }

  function measureEndX(osmd, measureIndex, unit) {
    const list = osmd.GraphicSheet && osmd.GraphicSheet.MeasureList;
    const staves = list && list[measureIndex];
    const measure = staves && staves.find((m) => m && m.PositionAndShape);
    if (!measure) return null;
    const box = measure.PositionAndShape;
    const x = box.AbsolutePosition && box.AbsolutePosition.x;
    const width = box.Size && box.Size.width;
    if (!Number.isFinite(x) || !Number.isFinite(width)) return null;
    return (x + width) * unit;
  }

  // Walk OSMD's cursor once and record where each onset is drawn, as a
  // fraction of its measure so the same steps work for any measure timing.
  function collectSteps(osmd) {
    const cursor = osmd && osmd.cursor;
    if (!cursor) return [];
    cursor.show();
    cursor.reset();
    const el = cursor.cursorElement;
    const unit = 10 * (osmd.zoom || osmd.Zoom || 1);
    const seen = new Set();
    const steps = [];
    for (let guard = 0; guard < 50000; guard++) {
      const it = cursor.iterator;
      if (!it || it.EndReached || it.endReached) break;
      const measure = it.CurrentMeasure;
      const index = it.CurrentMeasureIndex;
      const start = realValue(measure && measure.AbsoluteTimestamp);
      const length = realValue(measure && measure.Duration);
      const now = realValue(it.currentTimeStamp || it.CurrentSourceTimestamp);
      const frac = length > 0 && Number.isFinite(now - start) ? clamp((now - start) / length, 0, 1) : 0;
      // Repeats revisit measures; one entry per drawn onset is enough.
      const key = index + ":" + frac.toFixed(6);
      if (el && !seen.has(key)) {
        seen.add(key);
        steps.push({
          measure: index,
          frac,
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
          w: el.width || parseFloat(el.style.width) || 0,
          h: el.height || parseFloat(el.style.height) || 0,
          endX: measureEndX(osmd, index, unit),
        });
      }
      cursor.next();
    }
    cursor.reset();
    cursor.hide();
    steps.sort((a, b) => a.measure - b.measure || a.frac - b.frac);
    return steps;
  }

  // Attach absolute times to steps using the active measure start times.
  function retime(steps, measureStarts, totalSec) {
    const count = measureStarts.length;
    for (const step of steps) {
      const start = measureStarts[step.measure] || 0;
      const end = step.measure + 1 < count ? measureStarts[step.measure + 1] : totalSec;
      step.sec = start + step.frac * Math.max(0, end - start);
    }
    for (let i = 0; i < steps.length; i++) {
      steps[i].untilSec = i + 1 < steps.length ? steps[i + 1].sec : totalSec;
    }
    return steps;
  }

  // Where the playhead belongs at `sec`. With `smooth`, it glides toward the
  // next onset on the same line, or toward the barline before a line break.
  function locate(steps, sec, smooth) {
    if (!steps.length) return null;
    let lo = 0;
    let hi = steps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (steps[mid].sec <= sec) lo = mid;
      else hi = mid - 1;
    }
    const step = steps[lo];
    const next = steps[lo + 1];
    const x0 = step.x + step.w / 2;
    let x = x0;
    if (smooth && sec > step.sec && step.untilSec > step.sec) {
      const t = clamp((sec - step.sec) / (step.untilSec - step.sec), 0, 1);
      let target = null;
      if (next && Math.abs(next.y - step.y) <= LINE_TOLERANCE_PX) target = next.x + next.w / 2;
      else if (step.endX != null && step.endX > x0) target = step.endX;
      if (target != null && target >= x0) x = x0 + (target - x0) * t;
    }
    return { index: lo, x, y: step.y, h: step.h };
  }

  function Playhead(osmd) {
    this.osmd = osmd;
    this.steps = [];
    this.el = null;
    this.lastY = null;
    this.lastH = null;
    this.reduceMotion = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  Playhead.prototype.rebuild = function (measureStarts, totalSec) {
    this.steps = collectSteps(this.osmd);
    retime(this.steps, measureStarts, totalSec);
    const anchor = this.osmd.cursor && this.osmd.cursor.cursorElement;
    const parent = anchor && anchor.parentElement;
    if (!parent) return;
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "sheet-playhead";
      this.el.setAttribute("aria-hidden", "true");
      this.el.hidden = true;
    }
    if (this.el.parentElement !== parent) parent.appendChild(this.el);
    this.lastY = null;
    this.lastH = null;
  };

  Playhead.prototype.retime = function (measureStarts, totalSec) {
    retime(this.steps, measureStarts, totalSec);
  };

  Playhead.prototype.render = function (sec, opts) {
    if (!this.el) return null;
    const follow = !!(opts && opts.follow);
    const spot = locate(this.steps, sec, !this.reduceMotion);
    if (!spot) return null;
    this.el.hidden = false;
    this.el.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0)`;
    if (spot.h !== this.lastH) {
      this.el.style.height = spot.h + "px";
      this.lastH = spot.h;
    }
    const newLine = spot.y !== this.lastY;
    this.lastY = spot.y;
    if (follow && newLine) this.keepInView();
    return spot;
  };

  Playhead.prototype.hide = function () {
    if (this.el) this.el.hidden = true;
    this.lastY = null;
  };

  Playhead.prototype.keepInView = function () {
    const rect = this.el.getBoundingClientRect();
    const transport = document.querySelector("[data-sheet-playback]");
    const top = transport ? Math.max(0, transport.getBoundingClientRect().bottom) + 12 : 72;
    const bottom = root.innerHeight - (transport && getComputedStyle(transport).position === "fixed" ? transport.offsetHeight + 24 : 24);
    if (rect.top >= top && rect.bottom <= bottom) return;
    this.el.scrollIntoView({ block: "center", inline: "nearest", behavior: this.reduceMotion ? "auto" : "smooth" });
  };

  const api = { collectSteps, retime, locate, Playhead };
  root.SheetPlayhead = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
