/*
 * Stradella recipe overlay for the sheet-music page.
 *
 * Optional reader feature. When enabled, walks every chord stack in
 * the rendered score and paints a small label below each one with
 * the canonical Stradella voicing (e.g. "B♭d7 / E♭" for an E♭7).
 * Consecutive identical chords (typical of accordion vamp patterns
 * where the same chord repeats on every weak beat) are deduplicated
 * so the recipe shows once per chord-change point.
 *
 * Persists its on/off state in localStorage so the choice survives
 * reloads. A button in `.sheet-music-controls` (id
 * `osmd-stradella-toggle`) flips the flag.
 *
 * Dependencies:
 *   - window.__sheetMusic   (osmd-bridge.js, exposes resolveNoteAt
 *     with chordName + pitches resolution)
 *   - window.StradellaRecipe (stradella-recipe.js)
 *
 * Future work (left out of this iteration):
 *   - Per-chord choice between full-accuracy and simple-to-play
 *     voicings (the data has both via id 'X' and id 'Xpartial';
 *     findBySuffix needs a richer query to surface both).
 *   - Accordion-config switch for "no d7 row" so the fallback
 *     voicings become primary.
 */

(function () {
  const STORAGE_KEY = 'sheet-stradella-overlay';
  const OVERLAY_ATTR = 'data-stradella-overlay';
  const TOGGLE_ID = 'osmd-stradella-toggle';

  function isEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (_) {}
    syncToggleButton();
    redraw();
  }

  function syncToggleButton() {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;
    const on = isEnabled();
    btn.setAttribute('data-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-pressed', on);
    btn.textContent = on ? 'Hide Stradella' : 'Show Stradella';
  }

  function clearOverlays() {
    document.querySelectorAll('[' + OVERLAY_ATTR + ']').forEach((el) => el.remove());
  }

  function extractFirstVoicing(html) {
    if (!html) return null;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const v = tmp.querySelector('.stradella-recipe__voicing');
    return v ? v.textContent : null;
  }

  // Single source of truth: window.ChordName.looksValid (in
  // assets/js/music/chord-name.js). The overlay used to carry its
  // own ACCEPT_RE that disagreed with the page's hideStaticChordText
  // regex on edge cases like capital M (Tonal's short form for
  // major); five different copies of nearly-the-same regex hid the
  // GM-not-overlaid bug. Add new chord shapes there, never here.

  function redraw() {
    clearOverlays();
    if (!isEnabled()) return;
    const bridge = window.__sheetMusic;
    if (!bridge || !bridge.ready) return;
    if (!window.StradellaRecipe) return;
    const container = document.getElementById('osmd-container');
    const svg = container && container.querySelector('svg');
    if (!svg) return;
    // Overlays are position:absolute; ensure they anchor to the
    // score container (not the viewport / body) regardless of the
    // theme's default positioning.
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    const containerRect = container.getBoundingClientRect();
    const containerLeft = containerRect.left + window.scrollX;
    const containerTop = containerRect.top + window.scrollY;

    // Per-staff dedupe state. Tracks the last chord painted on
    // each staff and the y position it was painted at, so a
    // jump to a new system line (large y delta) resets the
    // tracker and the first chord on the new line gets labeled
    // even if it's the same as the previous line's last chord.
    const lastByStaff = new Map(); // staffIndex -> {chord, top}
    const ROW_BREAK_PX = 50;

    for (const sn of svg.querySelectorAll('.vf-stavenote')) {
      const heads = sn.querySelectorAll('.vf-notehead');
      // Single notes (e.g. the bass note between vamp chords) are
      // skipped without resetting lastChordKey, so a 'bass-chord-
      // bass-chord' pattern still dedupes the chord side.
      if (heads.length < 2) continue;
      const r = sn.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const cx = r.left + r.width / 2 + window.scrollX;
      const cy = r.top + r.height / 2 + window.scrollY;
      const hit = bridge.resolveNoteAt(cx, cy, 80, sn);
      if (!hit || !hit.chordName) continue;
      if (!window.ChordName || !window.ChordName.looksValid(hit.chordName)) continue;
      if (!hit.pitches || hit.pitches.length < 2) continue;

      const staffKey = hit.staffIndex ?? '?';
      const prev = lastByStaff.get(staffKey);
      const sameRow = prev && Math.abs(prev.top - r.top) < ROW_BREAK_PX;
      if (sameRow && prev.chord === hit.chordName) continue;
      lastByStaff.set(staffKey, { chord: hit.chordName, top: r.top });

      const recipe = extractFirstVoicing(window.StradellaRecipe.render(hit.chordName));
      if (!recipe) continue;

      const overlay = document.createElement('div');
      overlay.className = 'stradella-overlay';
      overlay.setAttribute(OVERLAY_ATTR, '');
      overlay.textContent = recipe;
      overlay.title = hit.chordName + ': ' + recipe;
      // Position below the stavenote's bounding box, anchored within
      // the score container so we move with autoscroll/zoom redraws.
      overlay.style.left = (r.left + r.width / 2 + window.scrollX - containerLeft) + 'px';
      overlay.style.top = (r.top + r.height + window.scrollY - containerTop + 6) + 'px';
      container.appendChild(overlay);
    }
  }

  function attachToggle() {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;
    btn.addEventListener('click', () => setEnabled(!isEnabled()));
    syncToggleButton();
  }

  // Re-draw whenever OSMD swaps the SVG (zoom, autoresize, initial
  // load), debounced so a flurry of mutations only triggers one
  // redraw frame.
  let pending = null;
  function scheduleRedraw() {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      redraw();
    });
  }

  function bootstrap() {
    attachToggle();
    const container = document.getElementById('osmd-container');
    if (!container) return;
    new MutationObserver(scheduleRedraw).observe(container, {
      childList: true,
      subtree: true,
    });
    // First paint after the bridge announces ready.
    if (window.__sheetMusic && window.__sheetMusic.ready) {
      scheduleRedraw();
    } else {
      const id = setInterval(() => {
        if (window.__sheetMusic && window.__sheetMusic.ready) {
          clearInterval(id);
          scheduleRedraw();
        }
      }, 80);
    }
    window.addEventListener('resize', scheduleRedraw, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.StradellaOverlay = { isEnabled, setEnabled, redraw };
})();
