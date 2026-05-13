/*
 * Public trail map reader.
 *
 * Initializes a Leaflet map inside the element passed via
 * data-trail-slug + data-trail-data, fetches the committed JSON
 * (Jekyll _data/zion-paths/<slug>.json embedded inline by the page
 * template), and renders pins + segments. No editing here -- the
 * dev editor (leaflet-editor.js) is loaded separately when ?dev=1.
 *
 * Exposed: window.TrailMap.init({ slug, data, mapId, statusId })
 *   slug:    URL-safe trail slug (used by the editor save endpoint)
 *   data:    parsed JSON object { pins, segments, center, zoom, ... }
 *   mapId:   id of the empty map container div
 *   statusId optional: id of the status text element
 */
window.TrailMap = (function () {
  'use strict';

  // Default fallback if data file has no center (initial bare seed).
  const ZION_CENTER = { lat: 37.2982, lng: -113.0263 };
  const ZION_ZOOM = 13;

  const PIN_COLORS = {
    parking: '#1f6feb',
    viewpoint: '#2da44e',
    decision: '#d29922',
    warning: '#cf222e',
    end: '#6e40c9',
    waypoint: '#4f4f4f',
  };

  const SEGMENT_COLORS = {
    walk: '#2da44e',
    scramble: '#d29922',
    wade: '#1f6feb',
    bushwhack: '#6e40c9',
    drive: '#57606a',
  };

  function init(opts) {
    const slug = opts.slug;
    const initialData = opts.data || {};
    const mapEl = document.getElementById(opts.mapId);
    const statusEl = opts.statusId ? document.getElementById(opts.statusId) : null;
    if (!mapEl) {
      console.warn('[trail-map] container not found:', opts.mapId);
      return null;
    }
    if (typeof L === 'undefined') {
      mapEl.classList.add('is-loading');
      mapEl.textContent = 'Map library failed to load.';
      if (statusEl) statusEl.textContent = '';
      return null;
    }

    const center = initialData.center || ZION_CENTER;
    const zoom = (typeof initialData.zoom === 'number') ? initialData.zoom : ZION_ZOOM;

    mapEl.classList.remove('is-loading');
    const map = L.map(mapEl, {
      center: [center.lat, center.lng],
      zoom,
      // Touch-friendly defaults.
      tap: true,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Layer groups so the editor can clear/redraw without touching tiles.
    const pinLayer = L.layerGroup().addTo(map);
    const segmentLayer = L.layerGroup().addTo(map);

    // Local mutable state. The editor mutates this and calls render()
    // to repaint; reader-mode never mutates after the initial render.
    const state = {
      slug,
      name: initialData.name || slug,
      center: { ...center },
      zoom,
      pins: Array.isArray(initialData.pins) ? initialData.pins.slice() : [],
      segments: Array.isArray(initialData.segments) ? initialData.segments.slice() : [],
    };

    // Detected once: on hover-capable pointers (desktop / trackpad),
    // popups should open on hover too. On touch devices, Leaflet's
    // default tap-to-open behaviour is what we want.
    const isHoverDevice = typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    // Editor flips this to true so its inline edit forms don't keep
    // re-opening when the cursor brushes a pin.
    const hoverCfg = { suppress: false };

    // Hover-popup close timing. Short enough that the popup feels
    // responsive when the cursor leaves; long enough that the user
    // has time to move from the pin into the popup itself to read
    // long notes or copy text.
    const HOVER_CLOSE_MS = 220;
    const FADE_OUT_MS = 180;
    let hoverCloseTimer = null;
    function clearHoverClose() {
      if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = null; }
    }
    function scheduleHoverClose(popup) {
      clearHoverClose();
      hoverCloseTimer = setTimeout(function () {
        hoverCloseTimer = null;
        const el = popup.getElement && popup.getElement();
        if (el) {
          el.classList.add('is-closing');
          setTimeout(function () { map.closePopup(popup); }, FADE_OUT_MS);
        } else {
          map.closePopup(popup);
        }
      }, HOVER_CLOSE_MS);
    }

    function attachHoverOpen(layer) {
      if (!isHoverDevice) return;
      layer.on('mouseover', function () {
        if (hoverCfg.suppress) return;
        clearHoverClose();
        if (!layer.isPopupOpen || !layer.isPopupOpen()) layer.openPopup();
      });
      layer.on('mouseout', function () {
        if (hoverCfg.suppress) return;
        const popup = layer.getPopup && layer.getPopup();
        if (popup && popup.isOpen && popup.isOpen()) scheduleHoverClose(popup);
      });
    }

    // Once a popup opens, watch the popup DOM itself: cursor moving
    // into it cancels the close timer, leaving it restarts the timer.
    // Also strip any stale "is-closing" class so a re-opened popup
    // isn't visibly fading.
    map.on('popupopen', function (e) {
      const el = e.popup.getElement && e.popup.getElement();
      if (!el) return;
      el.classList.remove('is-closing');
      if (!isHoverDevice || hoverCfg.suppress) return;
      el.addEventListener('mouseenter', clearHoverClose);
      el.addEventListener('mouseleave', function () { scheduleHoverClose(e.popup); });
    });

    function pinMarker(pin) {
      const color = PIN_COLORS[pin.kind] || PIN_COLORS.waypoint;
      // Leaflet's default marker is a sprite; for tiny custom-coloured
      // dots we use a divIcon with inline styling so we don't ship an
      // image asset for every kind.
      const icon = L.divIcon({
        className: 'trail-pin-icon trail-pin-icon--' + (pin.kind || 'waypoint'),
        html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.3);"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const m = L.marker([pin.lat, pin.lng], { icon, draggable: false });
      m.bindPopup(pinPopupHtml(pin));
      m._trailPin = pin;
      attachHoverOpen(m);
      return m;
    }

    function pinPopupHtml(pin) {
      const kind = (pin.kind || 'waypoint');
      const note = pin.note || '';
      return '<div class="trail-pin-popover">' +
        '<span class="trail-pin-popover__kind is-' + escapeAttr(kind) + '">' + escapeHtml(kind) + '</span>' +
        (note ? '<div class="trail-pin-popover__note">' + escapeHtml(note) + '</div>' : '') +
        '</div>';
    }

    function segmentLine(seg) {
      const color = SEGMENT_COLORS[seg.kind] || SEGMENT_COLORS.walk;
      const pts = (seg.waypoints || []).filter((w) => Array.isArray(w) && w.length === 2);
      if (pts.length < 2) return null;
      const line = L.polyline(pts, {
        color,
        weight: 4,
        opacity: 0.85,
        dashArray: seg.kind === 'scramble' ? '6 6' : null,
      });
      line.bindPopup(segmentPopupHtml(seg));
      line._trailSegment = seg;
      attachHoverOpen(line);
      return line;
    }

    function segmentPopupHtml(seg) {
      const kind = seg.kind || 'walk';
      const note = seg.note || '';
      return '<div class="trail-segment-popover">' +
        '<span class="trail-segment-popover__kind">' + escapeHtml(kind) + '</span>' +
        (note ? '<div>' + escapeHtml(note) + '</div>' : '') +
        '</div>';
    }

    function render() {
      pinLayer.clearLayers();
      segmentLayer.clearLayers();
      for (const pin of state.pins) {
        if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') continue;
        pinMarker(pin).addTo(pinLayer);
      }
      for (const seg of state.segments) {
        const line = segmentLine(seg);
        if (line) line.addTo(segmentLayer);
      }
      if (statusEl) {
        const updated = initialData.updatedAt ? new Date(initialData.updatedAt) : null;
        statusEl.textContent = state.pins.length + ' pin(s), ' + state.segments.length + ' segment(s)' +
          (updated ? ' · updated ' + updated.toLocaleDateString() : '');
      }
    }

    render();

    return {
      map,
      state,
      render,
      pinLayer,
      segmentLayer,
      PIN_COLORS,
      SEGMENT_COLORS,
      hoverCfg,
    };
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  return { init };
})();
