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

        return {
          pitches,
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
