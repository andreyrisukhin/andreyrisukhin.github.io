/*
 * Chord inspector popover for sheet-music pages.
 *
 * Click a note (without Shift) and a popover shows the chord name,
 * note list, intervals/semitones, and a Stradella bass recipe if
 * the chord matches one of the standard voicings.
 *
 * Dependencies loaded by the host page:
 *   - window.__sheetMusic (osmd-bridge.js)
 *   - window.Tonal        (assets/js/vendor/tonal.min.js)
 *   - window.StradellaButtons (from Liquid-rendered site.data)
 */

(function () {
  const NOTE_SEMITONES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const INTERVAL_NAMES = {
    0: 'P1', 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4',
    6: 'TT', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7',
    12: 'P8',
  };

  const pop = buildPopover();
  document.body.appendChild(pop.root);

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') pop.hide();
  });
  window.addEventListener('scroll', pop.hide, { passive: true });
  window.addEventListener('resize', pop.hide);

  function onClick(e) {
    if (e.shiftKey) return;
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('[data-sheet-annotator]')) return;
    if (e.target.closest('[data-chord-inspector]')) return;
    const container = document.getElementById('osmd-container');
    if (!container || !container.contains(e.target)) return;

    const bridge = window.__sheetMusic;
    if (!bridge || !bridge.ready) return;
    const hit = bridge.resolveNoteAt(e.pageX, e.pageY);
    if (!hit || !hit.pitches || !hit.pitches.length) {
      pop.hide();
      return;
    }
    pop.showAt(e.pageX, e.pageY, analyze(hit));
  }

  function analyze(hit) {
    const pitches = hit.pitches.slice().sort((a, b) => toMidi(a) - toMidi(b));
    const uniquePcs = Array.from(new Set(pitches.map(pitchClass))).filter(Boolean);
    const lowestMidi = toMidi(pitches[0]);
    const intervals = pitches
      .map(toMidi)
      .map((m, i, arr) => (i === 0 ? 0 : m - arr[i - 1]))
      .slice(1);

    const rootPc = uniquePcs[0] || pitchClass(pitches[0]);
    const semitonesFromRoot = pitches
      .map((p) => ((toMidi(p) - lowestMidi) % 12 + 12) % 12);

    const chordName = detectChord(uniquePcs) || (pitches.length === 1 ? pitches[0] : '—');
    const stradella = suggestStradella(rootPc, semitonesFromRoot);
    return {
      measureLabel: hit.measureNumber != null ? 'measure ' + hit.measureNumber : null,
      staffLabel: hit.staffIndex != null ? 'staff ' + (hit.staffIndex + 1) : null,
      pitches,
      uniquePcs,
      intervals,
      semitonesFromRoot,
      chordName,
      stradella,
    };
  }

  function detectChord(pcs) {
    if (!window.Tonal || !window.Tonal.Chord || typeof window.Tonal.Chord.detect !== 'function') {
      return null;
    }
    try {
      const detected = window.Tonal.Chord.detect(pcs);
      if (detected && detected.length) return detected[0];
    } catch (_) { /* ignore */ }
    return null;
  }

  function suggestStradella(rootPc, semitonesFromRoot) {
    const table = window.StradellaButtons;
    if (!table) return null;
    const want = Array.from(new Set(semitonesFromRoot)).sort((a, b) => a - b);
    for (const id of Object.keys(table)) {
      const offsets = Array.from(new Set(table[id])).sort((a, b) => a - b);
      if (offsets.length === want.length && offsets.every((o, i) => o === want[i])) {
        return { id, offsets, recipe: rootPc + ' bass + ' + buttonLabel(id) };
      }
    }
    return null;
  }

  function buttonLabel(id) {
    const labels = { M: 'Major', m: 'Minor', '7': 'Dom 7th', d7: 'Dim 7th' };
    return labels[id] || id + ' button';
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
    if (acc === '#') semi += 1;
    else if (acc === 'b') semi -= 1;
    else if (acc === '##') semi += 2;
    else if (acc === 'bb') semi -= 2;
    return (octave + 1) * 12 + semi;
  }

  function buildPopover() {
    const root = document.createElement('div');
    root.className = 'chord-inspector';
    root.setAttribute('data-chord-inspector', '');
    root.setAttribute('role', 'tooltip');
    root.hidden = true;

    function showAt(pageX, pageY, data) {
      root.innerHTML = render(data);
      root.hidden = false;
      root.style.left = Math.min(pageX + 12, document.documentElement.clientWidth + window.scrollX - 320) + 'px';
      root.style.top = (pageY + 12) + 'px';
    }
    function hide() { root.hidden = true; }

    root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t && t.getAttribute('data-chord-action') === 'close') hide();
    });

    return { root, showAt, hide };
  }

  function render(d) {
    const pitches = d.pitches.map((p) => `<code>${escapeHtml(p)}</code>`).join(' ');
    const semis = d.semitonesFromRoot.map((s) => `${s}`).join(', ');
    const intervals = d.intervals.length
      ? d.intervals.map((s) => INTERVAL_NAMES[s] || (s + 'st')).join(' + ')
      : '—';
    const metaParts = [d.measureLabel, d.staffLabel].filter(Boolean).join(' · ');
    return `
      <div class="chord-inspector__head">
        <span class="chord-inspector__title">${escapeHtml(d.chordName)}</span>
        <button type="button" class="chord-inspector__close" data-chord-action="close" aria-label="Close">×</button>
      </div>
      ${metaParts ? `<div class="chord-inspector__meta">${escapeHtml(metaParts)}</div>` : ''}
      <div class="chord-inspector__row"><span>Notes</span><span>${pitches}</span></div>
      <div class="chord-inspector__row"><span>Semitones from bass</span><span>${escapeHtml(semis)}</span></div>
      <div class="chord-inspector__row"><span>Intervals</span><span>${escapeHtml(intervals)}</span></div>
      ${d.stradella
        ? `<div class="chord-inspector__row chord-inspector__row--hi"><span>Stradella</span><span>${escapeHtml(d.stradella.recipe)}</span></div>`
        : ''}
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
