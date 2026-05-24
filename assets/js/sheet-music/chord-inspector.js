/*
 * Reader interactions for sheet music pages.
 *
 * Three-stage progressive disclosure on plain (non-shift) pointer events:
 *
 *   1. Hover a chord/note for ~250 ms  -> small floating "chord tag" at
 *      cursor. Fades out when the cursor leaves the stavenote.
 *   2. Click a chord/note               -> the same tag becomes sticky
 *      at the click position (won't fade on mouse-out).
 *   3. Click the same chord again       -> the sticky tag expands into
 *      the full chord inspector popover (Tonal-detected name, notes,
 *      intervals, every Stradella voicing matched by suffix).
 *
 * Click outside the score, click a different chord (resets the cycle to
 * stage 2 for the new chord), or press Escape -> everything hides.
 *
 * Shift modifiers are reserved for the dev annotator and are ignored
 * here.
 *
 * Dependencies loaded by the host page:
 *   - window.__sheetMusic   (osmd-bridge.js)
 *   - window.Tonal          (assets/js/vendor/tonal.min.js)
 *   - window.StradellaRecipe (assets/js/music/stradella-recipe.js)
 */

(function () {
  const HOVER_DELAY_MS = 250;
  const INTERVAL_NAMES = {
    0: "P1",
    1: "m2",
    2: "M2",
    3: "m3",
    4: "M3",
    5: "P4",
    6: "TT",
    7: "P5",
    8: "m6",
    9: "M6",
    10: "m7",
    11: "M7",
    12: "P8",
  };

  // ── State ──────────────────────────────────────────────────────────
  // currentChordKey is whichever chord is currently being shown (hover
  // tag, sticky tag, or full inspector). isSticky tracks whether the
  // user has committed via click 1; isInspectorOpen tracks click 2.
  // pinnedData/pinnedAnchor preserve the click-1 hit so click 2 can
  // escalate with the same chord identity even if its anchor is over
  // the floating tag (which doesn't resolve to a stavenote).
  let currentChordKey = null;
  let isSticky = false;
  let isInspectorOpen = false;
  let pinnedData = null;
  let pinnedAnchor = null;

  // Latest hover position; used at timer fire so we resolve the note
  // under the cursor's *current* coordinates instead of stale ones.
  let lastHoverEvent = null;
  let hoverTimer = null;
  let hoverStavenote = null;
  let hoverNotehead = null;

  // ── DOM ────────────────────────────────────────────────────────────
  const tag = buildTag();
  const pop = buildPopover();
  document.body.appendChild(tag.root);
  document.body.appendChild(pop.root);

  // ── Listeners ─────────────────────────────────────────────────────
  document.addEventListener("mousemove", onMove);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAll();
  });
  // Mobile Safari fires scroll/resize on every URL-bar collapse and
  // rubber-band, dismissing the popover before the user can tap
  // again. Track baselines when something opens; only hide on
  // genuinely large scroll movement or real width changes.
  let openScrollY = 0;
  let openWidth = window.innerWidth;
  const setOpenBaselines = () => {
    openScrollY = window.scrollY;
    openWidth = window.innerWidth;
  };
  const SCROLL_DISMISS_PX = 160;
  window.addEventListener(
    "scroll",
    () => {
      if (!isSticky && !isInspectorOpen) return;
      if (Math.abs(window.scrollY - openScrollY) > SCROLL_DISMISS_PX) hideAll();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (!isSticky && !isInspectorOpen) return;
    if (Math.abs(window.innerWidth - openWidth) > 20) hideAll();
  });

  // ── Hover (stage 0) ───────────────────────────────────────────────
  function onMove(e) {
    if (e.shiftKey) return; // dev preview owns shift+hover
    if (!(e.target instanceof Element)) return;
    const sn = e.target.closest(".vf-stavenote");
    const nh = e.target.closest(".vf-notehead");

    if (sn === hoverStavenote) {
      // Same stavenote: keep latest position for the pending fire,
      // and if the cursor crossed into a different notehead within
      // the same chord stack, refresh the visible tag immediately so
      // the displayed pitch follows the cursor (chord name stays the
      // same; clicked-pitch flips between e.g. Eb3 / G3 / Bb3 / Db4).
      if (sn) lastHoverEvent = e;
      if (nh !== hoverNotehead) {
        hoverNotehead = nh;
        if (nh && tag.isVisible() && !isSticky && !isInspectorOpen) {
          fireHoverTag();
        }
      }
      return;
    }
    // Stavenote changed (or cursor left the score).
    hoverStavenote = sn;
    hoverNotehead = nh;
    clearTimeout(hoverTimer);
    if (!isSticky) tag.hide();
    if (!sn) return;
    if (isSticky || isInspectorOpen) return;
    lastHoverEvent = e;
    hoverTimer = setTimeout(fireHoverTag, HOVER_DELAY_MS);
  }

  function fireHoverTag() {
    if (!lastHoverEvent) return;
    if (isSticky || isInspectorOpen) return;
    const ev = lastHoverEvent;
    const bridge = window.__sheetMusic;
    if (!bridge || !bridge.ready) return;
    const hit = bridge.resolveNoteAt(ev.pageX, ev.pageY, 80, ev.target);
    if (!hit || !hit.pitches || !hit.pitches.length) return;
    const data = analyze(hit);
    currentChordKey = chordKey(hit, data);
    tag.showAt(ev.pageX, ev.pageY, data, false);
  }

  // ── Click (stages 1 & 2) ──────────────────────────────────────────
  function onClick(e) {
    if (e.shiftKey) return; // shift+click = dev annotator
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("[data-sheet-annotator]")) return;
    if (e.target.closest("[data-sheet-dev-toggle]")) return;
    if (e.target.closest("[data-chord-inspector]")) return; // popover handles its own clicks
    if (e.target.closest("[data-chord-tag]")) {
      // Click on the sticky tag itself -> escalate to inspector if
      // we're at stage 1, collapse if we're at stage 2.
      if (isInspectorOpen) {
        hideAll();
      } else if (isSticky && pinnedData) {
        const a = pinnedAnchor || { x: e.pageX, y: e.pageY };
        openInspector(pinnedData, a.x, a.y);
      }
      return;
    }

    const container = document.getElementById("osmd-container");
    if (!container || !container.contains(e.target)) {
      hideAll();
      return;
    }

    // Forgiving anchor lookup: prefer the actual .vf-stavenote under the
    // tap; otherwise fall back to the nearest one within a tolerance
    // that scales with input precision (touch is coarser than mouse).
    let anchorEl = e.target.closest(".vf-stavenote");
    let anchorPx = 80;
    if (!anchorEl) {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const tolerancePx = coarse ? 60 : 24;
      anchorEl = nearestStavenote(container, e.pageX, e.pageY, tolerancePx);
      if (!anchorEl) {
        hideAll();
        return;
      }
      anchorPx = Math.max(anchorPx, tolerancePx * 2);
    }

    const bridge = window.__sheetMusic;
    if (!bridge || !bridge.ready) return;
    const hit = bridge.resolveNoteAt(e.pageX, e.pageY, anchorPx, anchorEl);
    if (!hit || !hit.pitches || !hit.pitches.length) {
      hideAll();
      return;
    }
    const data = analyze(hit);
    const key = chordKey(hit, data);

    if (key === currentChordKey && isSticky) {
      // Stage 2 OR stage 3 on same chord.
      if (isInspectorOpen) {
        hideAll();
      } else {
        openInspector(pinnedData || data, pinnedAnchor?.x ?? e.pageX, pinnedAnchor?.y ?? e.pageY);
      }
      return;
    }
    // Stage 1: pin the tag for this chord at the click point.
    clearTimeout(hoverTimer);
    pop.hide();
    isInspectorOpen = false;
    currentChordKey = key;
    isSticky = true;
    pinnedData = data;
    pinnedAnchor = { x: e.pageX, y: e.pageY };
    setOpenBaselines();
    tag.showAt(e.pageX, e.pageY, data, true);
  }

  function openInspector(data, x, y) {
    pop.showAt(x, y, data);
    isInspectorOpen = true;
    isSticky = true;
    setOpenBaselines();
    tag.hide(); // popover takes over
  }

  function hideAll() {
    clearTimeout(hoverTimer);
    tag.hide();
    pop.hide();
    isSticky = false;
    isInspectorOpen = false;
    currentChordKey = null;
    hoverStavenote = null;
    pinnedData = null;
    pinnedAnchor = null;
  }

  // ── Analysis ──────────────────────────────────────────────────────
  function analyze(hit) {
    const pitches = hit.pitches.slice().sort((a, b) => toMidi(a) - toMidi(b));
    const uniquePcs = Array.from(new Set(pitches.map(pitchClass))).filter(Boolean);
    const lowestMidi = toMidi(pitches[0]);
    const intervals = pitches
      .map(toMidi)
      .map((m, i, arr) => (i === 0 ? 0 : m - arr[i - 1]))
      .slice(1);
    const semitonesFromRoot = pitches.map((p) => (((toMidi(p) - lowestMidi) % 12) + 12) % 12);
    // Two readings (see osmd-bridge.js for the split):
    //   chordName -- pure stack reading ("GM" for a G-B-D stack).
    //                Used for the tag and as the inspector's "Notes
    //                spell" header.
    //   harmony   -- measure-aware reading that promotes a lower
    //                chord-tone to the bass ("GM/B" for an oom-pah
    //                in m2). Drives the Stradella recipe section so
    //                the player presses the bass that's actually
    //                written. null when it agrees with chordName.
    const chordName = hit.chordName || detectChord(uniquePcs) || (pitches.length === 1 ? pitches[0] : "—");
    const harmony = hit.harmony || null;
    const recipeFor = harmony || chordName;
    const stradellaHtml = window.StradellaRecipe && recipeFor ? window.StradellaRecipe.render(recipeFor) : "";
    return {
      measureLabel: hit.measureNumber != null ? "measure " + hit.measureNumber : null,
      staffLabel: hit.staffIndex != null ? "staff " + (hit.staffIndex + 1) : null,
      pitches,
      uniquePcs,
      intervals,
      semitonesFromRoot,
      chordName,
      harmony,
      clickedPitch: hit.clickedPitch || pitches[0],
      stradellaHtml,
    };
  }

  function chordKey(hit, data) {
    return [
      hit.measureNumber == null ? "?" : hit.measureNumber,
      hit.staffIndex == null ? "?" : hit.staffIndex,
      data.chordName || data.clickedPitch || "?",
    ].join("/");
  }

  // Nearest stavenote whose bounding rect lies within `maxPx` of the
  // page-coord tap point. Distance is measured to the rect edge, so a
  // tap inside the rect scores 0 and beats any external candidate.
  // Used as a tap-forgiveness fallback when the user taps the white
  // space next to a chord stack instead of dead-on the noteheads.
  function nearestStavenote(container, pageX, pageY, maxPx) {
    const nodes = container.querySelectorAll(".vf-stavenote");
    let best = null;
    let bestD = Infinity;
    for (const sn of nodes) {
      const r = sn.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const left = r.left + window.scrollX;
      const top = r.top + window.scrollY;
      const right = left + r.width;
      const bottom = top + r.height;
      const dx = pageX < left ? left - pageX : pageX > right ? pageX - right : 0;
      const dy = pageY < top ? top - pageY : pageY > bottom ? pageY - bottom : 0;
      const d = Math.hypot(dx, dy);
      if (d < bestD && d <= maxPx) {
        bestD = d;
        best = sn;
      }
    }
    return best;
  }

  function detectChord(pcs) {
    if (!window.Tonal || !window.Tonal.Chord) return null;
    try {
      const detected = window.Tonal.Chord.detect(pcs);
      if (detected && detected.length) return detected[0];
    } catch (_) {}
    return null;
  }

  function pitchClass(pitch) {
    if (!pitch) return null;
    const m = String(pitch).match(/^([A-Ga-g][#b]?)/);
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : null;
  }

  function toMidi(pitch) {
    const m = String(pitch).match(/^([A-Ga-g])([#b]{0,2})(-?\d+)$/);
    if (!m) return 0;
    const letter = m[1].toUpperCase();
    const acc = m[2];
    const octave = parseInt(m[3], 10);
    let semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
    if (acc === "#") semi += 1;
    else if (acc === "b") semi -= 1;
    else if (acc === "##") semi += 2;
    else if (acc === "bb") semi -= 2;
    return (octave + 1) * 12 + semi;
  }

  // ── Tag (stage 0/1) ───────────────────────────────────────────────
  function buildTag() {
    const root = document.createElement("div");
    root.className = "chord-tag";
    root.setAttribute("data-chord-tag", "");
    root.setAttribute("role", "tooltip");

    function showAt(pageX, pageY, data, sticky) {
      const chord = data.chordName && data.chordName !== "—" ? data.chordName : "";
      const pitch = data.clickedPitch ? data.clickedPitch : "";
      let html = "";
      if (chord) html += `<span class="chord-tag__chord">${escapeHtml(chord)}</span>`;
      if (pitch) html += `<span class="chord-tag__pitch">${escapeHtml(pitch)}</span>`;
      if (!html) html = '<span class="chord-tag__pitch">—</span>';
      if (sticky && data.stradellaHtml) {
        html += '<span class="chord-tag__hint">click again for details</span>';
      }
      root.innerHTML = html;
      root.style.left = Math.min(pageX + 14, document.documentElement.clientWidth + window.scrollX - 200) + "px";
      root.style.top = pageY + 14 + "px";
      root.classList.toggle("is-sticky", !!sticky);
      root.classList.remove("is-visible");
      void root.offsetWidth;
      root.classList.add("is-visible");
    }
    function hide() {
      root.classList.remove("is-visible");
    }
    function isVisible() {
      return root.classList.contains("is-visible");
    }

    return { root, showAt, hide, isVisible };
  }

  // ── Popover (stage 2) ─────────────────────────────────────────────
  function buildPopover() {
    const root = document.createElement("div");
    root.className = "chord-inspector";
    root.setAttribute("data-chord-inspector", "");
    root.setAttribute("role", "tooltip");

    function showAt(pageX, pageY, data) {
      root.innerHTML = render(data);
      root.style.left = Math.min(pageX + 12, document.documentElement.clientWidth + window.scrollX - 320) + "px";
      root.style.top = pageY + 12 + "px";
      root.classList.remove("is-visible");
      void root.offsetWidth;
      root.classList.add("is-visible");
    }
    function hide() {
      root.classList.remove("is-visible");
    }
    function isVisible() {
      return root.classList.contains("is-visible");
    }

    root.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t && t.getAttribute("data-chord-action") === "close") hideAll();
    });

    return { root, showAt, hide, isVisible };
  }

  function render(d) {
    const pitches = d.pitches.map((p) => `<code>${escapeHtml(p)}</code>`).join(" ");
    const semis = d.semitonesFromRoot.map((s) => `${s}`).join(", ");
    const intervals = d.intervals.length ? d.intervals.map((s) => INTERVAL_NAMES[s] || s + "st").join(" + ") : "—";
    const metaParts = [d.measureLabel, d.staffLabel].filter(Boolean).join(" · ");
    // "Notes spell" section -- pure stack analysis, no recipe.
    const stackSection = `
      <div class="chord-inspector__section">
        <div class="chord-inspector__section-label">Notes spell</div>
        <div class="chord-inspector__section-name">${escapeHtml(d.chordName)}</div>
        <div class="chord-inspector__row"><span>Notes</span><span>${pitches}</span></div>
        <div class="chord-inspector__row"><span>Semitones from bass</span><span>${escapeHtml(semis)}</span></div>
        <div class="chord-inspector__row"><span>Intervals</span><span>${escapeHtml(intervals)}</span></div>
      </div>
    `;
    // "Sounds as" section -- measure-aware harmony + Stradella recipe.
    // Only rendered when we have something to add (a different bass
    // reading and/or a recipe).
    const harmonyName = d.harmony || d.chordName;
    const showHarmonySection = !!d.stradellaHtml || (d.harmony && d.harmony !== d.chordName);
    const harmonySection = showHarmonySection
      ? `
      <div class="chord-inspector__section">
        <div class="chord-inspector__section-label">Sounds as</div>
        <div class="chord-inspector__section-name">${escapeHtml(harmonyName)}</div>
        ${
          d.harmony && d.harmony !== d.chordName
            ? `<div class="chord-inspector__row chord-inspector__row--note"><span></span><span>bass promoted from measure context</span></div>`
            : ""
        }
        ${d.stradellaHtml ? `<div class="chord-inspector__stradella">${d.stradellaHtml}</div>` : ""}
      </div>
    `
      : "";
    return `
      <div class="chord-inspector__head">
        <span class="chord-inspector__title">${escapeHtml(d.chordName)}</span>
        <button type="button" class="chord-inspector__close" data-chord-action="close" aria-label="Close">×</button>
      </div>
      ${metaParts ? `<div class="chord-inspector__meta">${escapeHtml(metaParts)}</div>` : ""}
      ${stackSection}
      ${harmonySection}
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
