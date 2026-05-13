/*
 * Small bridge around an OpenSheetMusicDisplay instance.
 *
 * Exposes window.__sheetMusic with helpers to resolve a pageX/pageY
 * click into OSMD's semantic model (measure, staff, voice, pitches).
 * Both the dev annotator and the chord inspector read from this.
 */

(function () {
  const api = {
    osmd: null,
    container: null,
    ready: false,
    readyPromise: null,
    _readyResolve: null,

    register(osmd, container) {
      api.osmd = osmd;
      api.container = container;
      api.ready = true;
      if (api._readyResolve) api._readyResolve(api);
    },

    svg() {
      return api.container ? api.container.querySelector('svg') : null;
    },

    /**
     * Resolve a page coordinate to a {note, chord, measure, staff, pitches,
     * svgPoint, osmdPoint} bundle, or null when the click is far from any note.
     * When `element` (the clicked DOM node) is supplied, prefer a DOM-anchored
     * lookup over OSMD's coordinate-based GetNearestNote, which otherwise
     * snaps to the nearest visible glyph — often a rest in an adjacent voice.
     */
    resolveNoteAt(pageX, pageY, maxPxDistance = 36, element = null) {
      if (!api.ready || !api.osmd) return null;
      const gs = api.osmd.GraphicSheet || api.osmd.graphic;
      if (!gs || typeof gs.domToSvg !== 'function') return null;
      try {
        const svgPoint = gs.domToSvg({ x: pageX, y: pageY });
        const osmdPoint = gs.svgToOsmd(svgPoint);

        let gn = null;
        if (element instanceof Element) {
          gn = graphicalNoteFromElement(api.osmd, element, pageY);
        }
        if (!gn) {
          const maxClick = { x: maxPxDistance / 10, y: maxPxDistance / 10 };
          gn = gs.GetNearestNote(osmdPoint, maxClick);
        }
        if (!gn) return null;

        const voiceEntry = gn.parentVoiceEntry || gn.ParentVoiceEntry || null;
        const staffEntry = voiceEntry ? voiceEntry.parentStaffEntry : null;
        const measure = staffEntry ? staffEntry.parentMeasure : null;
        const measureNumber =
          (measure && (measure.MeasureNumber || measure.measureNumber)) || null;
        const staffIndex =
          (measure && typeof measure.ParentStaff !== 'undefined' &&
            measure.ParentStaff && typeof measure.ParentStaff.idInMusicSheet !== 'undefined')
            ? measure.ParentStaff.idInMusicSheet
            : null;

        const notes = voiceEntry && Array.isArray(voiceEntry.notes)
          ? voiceEntry.notes
          : [gn];
        const pitches = notes
          .map((n) => pitchName(n))
          .filter(Boolean);

        const sn = gn.sourceNote || gn.SourceNote;
        const isRest = !!(sn && (
          sn.isRestFlag === true ||
          (typeof sn.isRest === 'function' && sn.isRest())
        ));
        const isTied = !!(sn && (sn.NoteTie || sn.noteTie || sn.Tie || sn.tie));
        // Two distinct readings:
        //   chordName -- pure stack analysis: what the noteheads
        //                themselves spell. "GM" for a G-B-D stack,
        //                regardless of what else is happening in the
        //                measure. Drives the small floating tag.
        //   harmony   -- measure-aware reading that promotes a lower
        //                chord-tone in the same measure to the bass
        //                (the typical Stradella oom-pah pattern: a
        //                B2 eighth followed by a G-B-D chord stack
        //                reads as "GM/B" even though the stack is
        //                root-position by itself). Drives the
        //                Stradella overlay and the inspector's
        //                "Sounds as" line.
        const chordName = (pitches.length >= 2) ? detectChordName(pitches) : null;
        let harmony = null;
        if (chordName) {
          const measurePitches = staffEntry ? gatherMeasurePitches(staffEntry, gn) : [];
          const promoted = analyzeHarmony(chordName, pitches, measurePitches);
          if (promoted && promoted !== chordName) harmony = promoted;
        }

        return {
          pitches,
          chordName,
          harmony,
          clickedPitch: pitchName(gn),
          isRest,
          isTied,
          measureNumber,
          staffIndex,
          svgPoint,
          osmdPoint,
          graphicalNote: gn,
          voiceEntry,
          noteRect: rectFor(gn),
        };
      } catch (err) {
        console.warn('[osmd-bridge] resolveNoteAt failed', err);
        return null;
      }
    },

    /**
     * Convert an SVG point (OSMD) to client pixel coords for overlay placement.
     */
    svgToPage(svgPoint) {
      const svg = api.svg();
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = svgPoint.x;
      pt.y = svgPoint.y;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const screen = pt.matrixTransform(ctm);
      return {
        x: screen.x + window.scrollX,
        y: screen.y + window.scrollY,
      };
    },

    /**
     * Crop a PNG thumbnail around a page coordinate from the rendered SVG.
     * When `overlay` is provided, draws a red bbox (bboxPage: {x,y,w,h} in
     * page coords) and a crosshair at clickPoint on top of the crop so the
     * user can visually confirm what was identified as clicked.
     * Returns a data: URL, or null on failure.
     */
    async snapshotAround(pageX, pageY, w = 220, h = 140, overlay = null) {
      const svg = api.svg();
      if (!svg) return null;
      try {
        const svgRect = svg.getBoundingClientRect();
        const absLeft = svgRect.left + window.scrollX;
        const absTop = svgRect.top + window.scrollY;
        const clone = svg.cloneNode(true);

        const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        let vbX = 0, vbY = 0, vbW = svg.clientWidth, vbH = svg.clientHeight;
        if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
          [vbX, vbY, vbW, vbH] = viewBox;
        }
        const scaleX = vbW / Math.max(svgRect.width, 1);
        const scaleY = vbH / Math.max(svgRect.height, 1);
        const cx = (pageX - absLeft) * scaleX + vbX;
        const cy = (pageY - absTop) * scaleY + vbY;
        const cropW = w * scaleX;
        const cropH = h * scaleY;
        const vbLeft = cx - cropW / 2;
        const vbTop = cy - cropH / 2;
        clone.setAttribute('viewBox', `${vbLeft} ${vbTop} ${cropW} ${cropH}`);
        clone.setAttribute('width', String(w));
        clone.setAttribute('height', String(h));

        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
          const toCanvasX = (pagePx) => ((pagePx - absLeft) * scaleX + vbX - vbLeft) * (w / cropW);
          const toCanvasY = (pagePx) => ((pagePx - absTop) * scaleY + vbY - vbTop) * (h / cropH);
          const dataUrl = await rasterize(url, w, h, (ctx) => {
            if (!overlay) return;
            if (overlay.bboxPage) {
              const bx = toCanvasX(overlay.bboxPage.x);
              const by = toCanvasY(overlay.bboxPage.y);
              const bw = overlay.bboxPage.w * scaleX * (w / cropW);
              const bh = overlay.bboxPage.h * scaleY * (h / cropH);
              ctx.strokeStyle = 'rgba(255, 45, 60, 0.95)';
              ctx.lineWidth = 2;
              ctx.strokeRect(bx, by, bw, bh);
            }
            if (overlay.clickPage) {
              const x = toCanvasX(overlay.clickPage.x);
              const y = toCanvasY(overlay.clickPage.y);
              ctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
              ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
              ctx.stroke();
            }
          });
          return dataUrl;
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.warn('[osmd-bridge] snapshot failed', err);
        return null;
      }
    },
  };

  api.readyPromise = new Promise((resolve) => { api._readyResolve = resolve; });
  window.__sheetMusic = api;

  function graphicalNoteFromElement(osmd, element, pageY) {
    const stavenoteEl = element.closest && element.closest('.vf-stavenote');
    if (!stavenoteEl) return null;
    const stavenoteId = stavenoteEl.id;
    if (!stavenoteId) return null;
    const vfId = stavenoteId.replace(/^vf-/, '');

    const graphic = osmd.GraphicSheet || osmd.graphic;
    const candidates = [];
    for (const page of (graphic && graphic.MusicPages) || []) {
      for (const system of (page.MusicSystems || [])) {
        for (const line of (system.StaffLines || [])) {
          for (const measure of (line.Measures || [])) {
            for (const sentry of (measure.staffEntries || [])) {
              for (const gve of (sentry.graphicalVoiceEntries || [])) {
                for (const gn of (gve.notes || [])) {
                  const vf = Array.isArray(gn.vfnote) ? gn.vfnote[0] : gn.vfnote;
                  const id = vf && vf.attrs && vf.attrs.id;
                  if (id === vfId || id === stavenoteId) candidates.push(gn);
                }
              }
            }
          }
        }
      }
    }
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const noteheadEl = element.closest && element.closest('.vf-notehead');
    if (noteheadEl && noteheadEl.parentElement) {
      const siblings = [...noteheadEl.parentElement.querySelectorAll(':scope > .vf-notehead')];
      const idx = siblings.indexOf(noteheadEl);
      if (idx >= 0) {
        const byIndex = candidates.find((c) => c.vfnoteIndex === idx);
        if (byIndex) return byIndex;
      }
    }

    if (typeof pageY === 'number') {
      const heads = [...stavenoteEl.querySelectorAll('.vf-notehead')];
      if (heads.length === candidates.length) {
        let bestIdx = 0, bestDist = Infinity;
        heads.forEach((h, i) => {
          const r = h.getBoundingClientRect();
          const cy = r.top + r.height / 2 + window.scrollY;
          const d = Math.abs(cy - pageY);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        const byY = candidates.find((c) => c.vfnoteIndex === bestIdx);
        if (byY) return byY;
      }
    }
    return candidates[0];
  }

  function rectFor(gn) {
    if (!gn) return null;
    const vf = gn.vfnote || (Array.isArray(gn.vfnote) ? gn.vfnote[0] : null);
    try {
      const candidates = [
        vf && typeof vf.getSVGElement === 'function' && vf.getSVGElement(),
        vf && vf.attrs && vf.attrs.el,
        gn.getSVGGElement && gn.getSVGGElement(),
      ].filter(Boolean);
      for (const el of candidates) {
        if (el && typeof el.getBoundingClientRect === 'function') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return {
              x: r.left + window.scrollX,
              y: r.top + window.scrollY,
              w: r.width,
              h: r.height,
            };
          }
        }
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  const NOTE_ENUM_TO_LETTER = {
    0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B',
  };

  function pitchToMidi(pitch) {
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

  // Collect every pitch in the source measure that is NOT one of the
  // notes belonging to the clicked chord stack. Returned MIDI-sorted
  // ascending. Used by detectChordName to promote a lower bass when
  // the score uses an oom-pah pattern (separate bass note + chord
  // stack) so the recipe reflects the bass press, not just the
  // chord stack's own lowest note.
  function gatherMeasurePitches(staffEntry, ownGn) {
    const out = [];
    try {
      const psm = staffEntry.parentMeasure && staffEntry.parentMeasure.parentSourceMeasure;
      if (!psm) return out;
      const containers = psm.verticalSourceStaffEntryContainers || [];
      for (const c of containers) {
        for (const sse of c.staffEntries || []) {
          if (!sse) continue;
          for (const sve of sse.voiceEntries || []) {
            for (const note of sve.notes || []) {
              if (!note || note.isRestFlag === true) continue;
              if (note === (ownGn && (ownGn.sourceNote || ownGn.SourceNote))) continue;
              const p = note.pitch;
              if (!p) continue;
              const ht = (typeof p.getHalfTone === 'function') ? p.getHalfTone() : null;
              if (ht == null) continue;
              const pc = halfToneToPC(ht, p);
              if (!pc) continue;
              out.push({ midi: ht, pc });
            }
          }
        }
      }
    } catch (_) {}
    out.sort((a, b) => a.midi - b.midi);
    return out;
  }

  function halfToneToPC(halfTone, pitch) {
    // Prefer the spelling OSMD reports so flats stay flats (Bb not A#).
    if (pitch && typeof pitch.fundamentalNoteAsString === 'string') {
      const acc = pitch.AccidentalHalfTones;
      let s = pitch.fundamentalNoteAsString.toUpperCase();
      if (acc === -1) s += 'b';
      else if (acc === 1) s += '#';
      else if (acc === -2) s += 'bb';
      else if (acc === 2) s += '##';
      return s;
    }
    const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return SHARP[((halfTone % 12) + 12) % 12];
  }

  // Pure stack analysis. Looks ONLY at the noteheads in the clicked
  // chord stack and asks Tonal what that pitch set spells. Output is
  // a literal label like "GM" / "Cm" / "B-D-G is also GM"; if the
  // stack itself happens to be voiced in inversion (e.g. B2-D3-G3
  // with B in the bass) we surface "GM/B" because that's what the
  // notes themselves say. Does NOT look at other measure pitches --
  // that lives in analyzeHarmony.
  function detectChordName(pitches) {
    if (!window.Tonal || !window.Tonal.Chord || typeof window.Tonal.Chord.detect !== 'function') return null;
    const sortedPitches = pitches.slice().sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    const pcs = sortedPitches.map((p) => String(p).replace(/-?\d+$/, ''));
    let detected;
    try { detected = window.Tonal.Chord.detect(pcs) || []; } catch (_) { detected = []; }
    if (!detected.length) return null;
    const sansSlash = detected.map((d) => d.split('/')[0]);
    const primary = sansSlash.slice().sort((a, b) => a.length - b.length)[0];
    if (!window.Tonal.Chord.get) return primary;
    let chord;
    try { chord = window.Tonal.Chord.get(primary); } catch (_) { chord = null; }
    if (!chord || !chord.tonic) return primary;
    if (!window.ChordName) return primary;
    const lowestPC = pcs[0];
    if (window.ChordName.samePitchClass(lowestPC, chord.tonic)) return primary;
    return primary + '/' + lowestPC;
  }

  // Measure-aware reading. Given the stack chord (already detected)
  // plus every other pitch in the same source measure, promote the
  // lowest CHORD-TONE that sits below the stack to the bass. This is
  // the Stradella-oriented "what is actually being played in this
  // measure" reading: an oom-pah pattern of B2 eighth + G-B-D chord
  // becomes "GM/B" because B IS the bass press for that beat, even
  // though the chord stack alone reads as root-position GM.
  // Returns the (possibly enriched) chord name; returns the input
  // unchanged when the measure context doesn't suggest a different
  // bass than the stack's lowest note.
  function analyzeHarmony(stackChord, stackPitches, measurePitches) {
    if (!stackChord || !window.Tonal || !window.Tonal.Chord || !window.Tonal.Chord.get) return stackChord;
    if (!window.ChordName) return stackChord;
    if (!Array.isArray(measurePitches) || measurePitches.length === 0) return stackChord;
    const CN = window.ChordName;
    const baseName = stackChord.split('/')[0];
    let chord;
    try { chord = window.Tonal.Chord.get(baseName); } catch (_) { chord = null; }
    if (!chord || !chord.tonic || !Array.isArray(chord.notes)) return stackChord;

    const sortedStack = stackPitches.slice().sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    const stackLowestMidi = pitchToMidi(sortedStack[0]);

    let promotedBassPC = null;
    for (const cp of measurePitches) {
      if (cp.midi >= stackLowestMidi) break;
      const isChordTone = chord.notes.some((n) => CN.samePitchClass(cp.pc, n));
      if (isChordTone) { promotedBassPC = cp.pc; break; }
    }
    if (!promotedBassPC) return stackChord;
    if (CN.samePitchClass(promotedBassPC, chord.tonic)) return baseName;
    return baseName + '/' + promotedBassPC;
  }

  function pitchName(gn) {
    if (!gn) return null;
    const sn = gn.sourceNote || gn.SourceNote;
    if (!sn) return null;
    const p = sn.Pitch || sn.pitch;
    if (!p) return null;
    const fund = p.FundamentalNote;
    const letter = NOTE_ENUM_TO_LETTER[fund];
    if (!letter) return null;
    const acc = p.AccidentalHalfTones;
    let suffix = '';
    if (acc === 1) suffix = '#';
    else if (acc === -1) suffix = 'b';
    else if (acc === 2) suffix = '##';
    else if (acc === -2) suffix = 'bb';
    const octave = (typeof p.Octave === 'number') ? p.Octave + 3 : '';
    return `${letter}${suffix}${octave}`;
  }

  function rasterize(svgUrl, w, h, drawOverlay) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          if (typeof drawOverlay === 'function') {
            ctx.save();
            try { drawOverlay(ctx); } finally { ctx.restore(); }
          }
          resolve(canvas.toDataURL('image/png'));
        } catch (err) { reject(err); }
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  }
})();
