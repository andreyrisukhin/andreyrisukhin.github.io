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
     */
    resolveNoteAt(pageX, pageY, maxPxDistance = 36) {
      if (!api.ready || !api.osmd) return null;
      const gs = api.osmd.GraphicSheet || api.osmd.graphic;
      if (!gs || typeof gs.domToSvg !== 'function') return null;
      try {
        const svgPoint = gs.domToSvg({ x: pageX, y: pageY });
        const osmdPoint = gs.svgToOsmd(svgPoint);
        const maxClick = { x: maxPxDistance / 10, y: maxPxDistance / 10 };
        const gn = gs.GetNearestNote(osmdPoint, maxClick);
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

        return {
          pitches,
          clickedPitch: pitchName(gn),
          measureNumber,
          staffIndex,
          svgPoint,
          osmdPoint,
          graphicalNote: gn,
          voiceEntry,
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
     * Returns a data: URL, or null on failure. Safe to call infrequently.
     */
    async snapshotAround(pageX, pageY, w = 220, h = 140) {
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
        clone.setAttribute('viewBox', `${cx - cropW / 2} ${cy - cropH / 2} ${cropW} ${cropH}`);
        clone.setAttribute('width', String(w));
        clone.setAttribute('height', String(h));

        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
          const dataUrl = await rasterize(url, w, h);
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

  function pitchName(gn) {
    if (!gn) return null;
    const sn = gn.sourceNote || gn.SourceNote;
    if (!sn) return null;
    const p = sn.Pitch || sn.pitch;
    if (!p) return null;
    if (typeof p.ToString === 'function') {
      try {
        return p.ToString();
      } catch (_) { /* fall through */ }
    }
    const nameIdx = p.FundamentalNote;
    const octave = p.Octave != null ? p.Octave + 3 : 4;
    const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const acc = p.AccidentalHalfTones;
    let suffix = '';
    if (acc === 1) suffix = '#';
    else if (acc === -1) suffix = 'b';
    else if (acc === 2) suffix = '##';
    else if (acc === -2) suffix = 'bb';
    const letter = (typeof nameIdx === 'number' && NAMES[nameIdx]) ? NAMES[nameIdx] : '?';
    return letter + suffix + octave;
  }

  function rasterize(svgUrl, w, h) {
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
          resolve(canvas.toDataURL('image/png'));
        } catch (err) { reject(err); }
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  }
})();
