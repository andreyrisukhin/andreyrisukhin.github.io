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
    // Always-on speech-bubble labels for each pin + the thin leader
    // line back to the pin. Separate layers so render() can wipe and
    // redraw them in isolation.
    const labelLayer = L.layerGroup().addTo(map);
    const leaderLayer = L.layerGroup().addTo(map);

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

    // Editor sets this to a function (pin) => mark dirty. Reader
    // leaves it null, so viewer drags don't try to persist.
    const onLabelDrag = { fn: null };

    // Re-anchor every leader line to its label's center after a zoom:
    // the label width stays constant in container px but its geo
    // center moves, so the leader endpoint drifts unless we recompute.
    map.on('zoomend', function () {
      labelLayer.eachLayer(function (l) {
        if (l._syncLeader) l._syncLeader();
      });
      applyZoomScale();
    });

    // Reference zoom for label scaling: whatever the data file says
    // is the "base" view. One step out shrinks labels, two or more
    // hides them entirely so the pin dots can carry the regional
    // context without visual clutter.
    const BASE_ZOOM = (typeof initialData.zoom === 'number') ? initialData.zoom : ZION_ZOOM;
    function applyZoomScale() {
      const delta = BASE_ZOOM - map.getZoom();
      const c = map.getContainer();
      c.classList.toggle('trail-zoom-shrink', delta === 1);
      c.classList.toggle('trail-zoom-hide-labels', delta >= 2);
    }

    // Drop the label this many pixels above-and-right of the pin
    // when the data has no saved labelLatLng yet. Geographic so it's
    // zoom-stable once it lands.
    // Spoke out at varying angles so a cluster of nearby pins doesn't
    // pile every default label on top of each other. Once the user
    // drags a label its position is persisted on the pin record and
    // this default is no longer used.
    const DEFAULT_LABEL_ANGLES = [-45, -135, 45, 135, -90, 90, 0, 180];
    const DEFAULT_LABEL_DIST = 60; // px from pin center
    function defaultLabelLatLng(pinLatLng, idx) {
      const deg = DEFAULT_LABEL_ANGLES[idx % DEFAULT_LABEL_ANGLES.length];
      const rad = (deg * Math.PI) / 180;
      const dx = Math.cos(rad) * DEFAULT_LABEL_DIST;
      const dy = Math.sin(rad) * DEFAULT_LABEL_DIST; // y grows downward in container px
      const px = map.latLngToContainerPoint(pinLatLng);
      return map.containerPointToLatLng([px.x + dx, px.y + dy]);
    }

    function pinLabel(pin, idx) {
      if (!pin.labelLatLng) {
        const ll = defaultLabelLatLng([pin.lat, pin.lng], idx);
        pin.labelLatLng = { lat: ll.lat, lng: ll.lng };
        pin._labelAuto = true;
      } else if (typeof pin._labelAuto !== 'boolean') {
        pin._labelAuto = false;
      }
      const labelLL = L.latLng(pin.labelLatLng.lat, pin.labelLatLng.lng);

      const kind = pin.kind || 'waypoint';
      const note = pin.note || '';
      const html = '<div class="trail-label is-' + escapeAttr(kind) + '" title="drag to move">' +
        '<span class="trail-label__kind is-' + escapeAttr(kind) + '">' + escapeHtml(kind) + '</span>' +
        (note ? '<span class="trail-label__note">' + escapeHtml(note) + '</span>' : '') +
        '</div>';

      // iconSize [0,0] + the !important auto-size CSS below lets the
      // wrapper hug the actual content. Otherwise Leaflet hands us a
      // fixed box whose transparent area would either swallow map
      // clicks or leave the drag handle larger than the visible label.
      const icon = L.divIcon({
        className: 'trail-label-wrap',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const m = L.marker(labelLL, { icon, draggable: true, autoPan: false });
      m._trailPinLabel = pin;
      const pinLL = L.latLng(pin.lat, pin.lng);

      const leader = L.polyline([labelLL, pinLL], {
        color: 'rgba(13, 17, 23, 0.55)',
        weight: 1.5,
        dashArray: '3 4',
        interactive: false,
        className: 'trail-leader',
      });
      leader.addTo(leaderLayer);
      m._leader = leader;

      // The marker's lat/lng anchors at the top-left of the visible
      // label (iconAnchor [0,0]). For the leader to come out of the
      // bubble's center we need to translate top-left -> center using
      // the rendered element's actual width/height. Re-measured each
      // time the label could have moved or resized.
      function syncLeader() {
        const el = m.getElement();
        const inner = el && el.querySelector('.trail-label');
        if (!inner) {
          leader.setLatLngs([m.getLatLng(), pinLL]);
          return;
        }
        const r = inner.getBoundingClientRect();
        const tl = map.latLngToContainerPoint(m.getLatLng());
        const center = L.point(tl.x + r.width / 2, tl.y + r.height / 2);
        leader.setLatLngs([map.containerPointToLatLng(center), pinLL]);
      }
      m._syncLeader = syncLeader;
      // Wait for the label DOM to actually exist before measuring.
      m.once('add', function () { requestAnimationFrame(syncLeader); });

      m.on('drag', syncLeader);
      m.on('dragend', function () {
        const ll = m.getLatLng();
        pin.labelLatLng = { lat: ll.lat, lng: ll.lng };
        pin._labelAuto = false;
        syncLeader();
        if (typeof onLabelDrag.fn === 'function') onLabelDrag.fn(pin);
      });

      return m;
    }

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
      m._trailPin = pin;
      return m;
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
      // Reader never tooltips segments. The line's colour already
      // conveys the kind. Editor wires its own edit popup via
      // leaflet-editor.js.
      line._trailSegment = seg;
      return line;
    }

    function render() {
      pinLayer.clearLayers();
      segmentLayer.clearLayers();
      labelLayer.clearLayers();
      leaderLayer.clearLayers();
      let pinIdx = 0;
      for (const pin of state.pins) {
        if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') continue;
        pinMarker(pin).addTo(pinLayer);
        pinLabel(pin, pinIdx).addTo(labelLayer);
        pinIdx++;
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
    applyZoomScale();

    return {
      map,
      state,
      render,
      pinLayer,
      segmentLayer,
      labelLayer,
      leaderLayer,
      onLabelDrag,
      PIN_COLORS,
      SEGMENT_COLORS,
    };
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  return { init };
})();
