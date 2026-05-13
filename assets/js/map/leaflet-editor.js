/*
 * Trail map dev editor.
 *
 * Loaded only when ?dev=1 (or sheet-dev-mode is on in localStorage).
 * Mounts a small floating panel over the Leaflet map with three modes:
 *
 *   pin      - click on the map drops a pin at the click; opens an
 *              inline form to choose kind + note. Existing pins are
 *              draggable for fine-positioning.
 *   segment  - clicks add waypoints to the current segment; finish
 *              with the "End segment" button or Esc.
 *   none     - clicks do nothing extra (default; lets you pan/zoom
 *              and tap existing pins to edit them).
 *
 * Saves via the existing dev-annotator-server.mjs sidecar, which
 * commits the JSON to _data/zion-paths/<slug>.json so the public
 * read view picks it up on next deploy.
 *
 * Depends on window.TrailMap.init having returned a controller.
 */

(function () {
  'use strict';

  const DEV_MODE_KEY = 'sheet-dev-mode';
  const SIDECAR = 'http://127.0.0.1:4001';

  function readDevMode() {
    const params = new URLSearchParams(location.search);
    if (params.get('dev') === '1') {
      try { localStorage.setItem(DEV_MODE_KEY, '1'); } catch (_) {}
      return true;
    }
    if (params.get('dev') === '0') {
      try { localStorage.removeItem(DEV_MODE_KEY); } catch (_) {}
      return false;
    }
    try { return localStorage.getItem(DEV_MODE_KEY) === '1'; } catch (_) { return false; }
  }

  function nextId(prefix, list) {
    let n = list.length + 1;
    const have = new Set(list.map((x) => x.id));
    while (have.has(prefix + n)) n++;
    return prefix + n;
  }

  function attach(controller, mapWrap) {
    if (!controller) return;
    const map = controller.map;
    const state = controller.state;

    let mode = 'none';
    let dirty = false;
    let activeSegment = null; // when in segment mode

    // ── Editor panel ─────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'trail-editor';
    panel.innerHTML = `
      <div class="trail-editor__row">
        <button type="button" class="trail-editor__btn" data-mode="pin">Drop pin</button>
        <button type="button" class="trail-editor__btn" data-mode="segment">New segment</button>
      </div>
      <div class="trail-editor__row">
        <button type="button" class="trail-editor__btn" data-mode="none">Pan</button>
        <button type="button" class="trail-editor__btn is-save" data-action="save">Save</button>
      </div>
      <div class="trail-editor__status" data-status>ready</div>
      <details class="trail-editor__items" data-items>
        <summary>Items <span data-items-count></span></summary>
        <div class="trail-editor__items-body" data-items-body></div>
      </details>
    `;
    mapWrap.appendChild(panel);

    const statusEl = panel.querySelector('[data-status]');
    function setStatus(text) { if (statusEl) statusEl.textContent = text; }
    function setDirty(d) {
      dirty = d;
      const saveBtn = panel.querySelector('[data-action="save"]');
      if (saveBtn) saveBtn.classList.toggle('is-dirty', d);
    }
    function setMode(next) {
      mode = next;
      for (const b of panel.querySelectorAll('[data-mode]')) {
        b.classList.toggle('is-active', b.getAttribute('data-mode') === next);
      }
      if (next !== 'segment' && activeSegment) {
        // Finish the current segment when leaving segment mode.
        finishSegment();
      }
      if (next === 'segment') {
        activeSegment = {
          id: nextId('s', state.segments),
          kind: 'walk',
          note: '',
          waypoints: [],
        };
        state.segments.push(activeSegment);
        setDirty(true);
        setStatus('click waypoints; "End segment" or Esc to finish');
      } else if (next === 'pin') {
        setStatus('click on map to drop pin');
      } else {
        setStatus('pan / tap existing pins');
      }
    }
    function finishSegment() {
      if (activeSegment && activeSegment.waypoints.length < 2) {
        // Discard segments with fewer than 2 points.
        state.segments = state.segments.filter((s) => s.id !== activeSegment.id);
      }
      activeSegment = null;
      controller.render();
    }

    panel.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const m = t.getAttribute('data-mode');
      if (m) {
        setMode(m);
        return;
      }
      if (t.getAttribute('data-action') === 'save') {
        save();
      }
      const itemAct = t.getAttribute('data-item-act');
      if (itemAct) {
        const id = t.getAttribute('data-item-id');
        const kind = t.getAttribute('data-item-kind');
        if (itemAct === 'del' && id && kind) {
          if (kind === 'pin') state.pins = state.pins.filter((p) => p.id !== id);
          if (kind === 'segment') state.segments = state.segments.filter((s) => s.id !== id);
          setDirty(true);
          controller.render();
        } else if (itemAct === 'focus' && id && kind) {
          focusItem(kind, id);
        }
      }
    });

    function focusItem(kind, id) {
      if (kind === 'pin') {
        const p = state.pins.find((x) => x.id === id);
        if (p) { map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16)); openPinPopup(id); }
      } else if (kind === 'segment') {
        const s = state.segments.find((x) => x.id === id);
        if (s && s.waypoints && s.waypoints.length) {
          const bounds = L.latLngBounds(s.waypoints);
          map.fitBounds(bounds.pad(0.4));
          openSegmentPopup(id);
        }
      }
    }
    function openPinPopup(id) {
      controller.pinLayer.eachLayer((layer) => {
        if (layer._trailPin && layer._trailPin.id === id) layer.openPopup();
      });
    }
    function openSegmentPopup(id) {
      controller.segmentLayer.eachLayer((layer) => {
        if (layer._trailSegment && layer._trailSegment.id === id) layer.openPopup();
      });
    }

    function renderItemsList() {
      const body = panel.querySelector('[data-items-body]');
      const count = panel.querySelector('[data-items-count]');
      if (!body) return;
      const total = state.pins.length + state.segments.length;
      if (count) count.textContent = '(' + total + ')';
      const rows = [];
      for (const p of state.pins) {
        rows.push(itemRowHtml('pin', p.id, p.kind || 'waypoint', p.note));
      }
      for (const s of state.segments) {
        const len = (s.waypoints || []).length;
        const label = (s.kind || 'walk') + ' · ' + len + 'pt';
        rows.push(itemRowHtml('segment', s.id, label, s.note));
      }
      body.innerHTML = rows.join('') || '<div class="trail-editor__items-empty">no items yet</div>';
    }
    function itemRowHtml(kind, id, label, note) {
      const snippet = note ? ' — ' + escapeHtml(note.slice(0, 40)) + (note.length > 40 ? '…' : '') : '';
      return '<div class="trail-editor__item">' +
        '<button type="button" class="trail-editor__item-focus" data-item-act="focus" data-item-id="' + escapeAttr(id) + '" data-item-kind="' + kind + '" title="Zoom to & open">' +
          '<span class="trail-editor__item-kind">' + escapeHtml(label) + '</span>' +
          '<span class="trail-editor__item-id">' + escapeHtml(id) + '</span>' +
          snippet +
        '</button>' +
        '<button type="button" class="trail-editor__item-del" data-item-act="del" data-item-id="' + escapeAttr(id) + '" data-item-kind="' + kind + '" title="Delete">×</button>' +
      '</div>';
    }
    function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mode === 'segment') {
        setMode('none');
      }
    });

    // ── Map click handler ────────────────────────────────────────
    map.on('click', (e) => {
      if (mode === 'pin') {
        addPin(e.latlng.lat, e.latlng.lng);
      } else if (mode === 'segment' && activeSegment) {
        activeSegment.waypoints.push([e.latlng.lat, e.latlng.lng]);
        setDirty(true);
        controller.render();
        // Re-attach segment-end action since render replaced it.
        if (activeSegment.waypoints.length >= 2) {
          setStatus(activeSegment.waypoints.length + ' waypoints; click "End segment" / Esc');
        }
      }
    });

    // Hook into existing rendered layers so editor-mode interactions
    // work on the same markers the reader renders.
    const baseRender = controller.render;
    controller.render = function () {
      baseRender();
      // Re-bind editor behaviours on freshly created layers.
      controller.pinLayer.eachLayer((layer) => {
        const pin = layer._trailPin;
        if (!pin) return;
        layer.dragging && layer.dragging.enable && layer.dragging.enable();
        layer.options.draggable = true;
        layer.on('dragend', (ev) => {
          const ll = ev.target.getLatLng();
          pin.lat = ll.lat;
          pin.lng = ll.lng;
          setDirty(true);
        });
        // Stop pin clicks from also bubbling to map-click (otherwise a
        // pin-mode click on an existing pin would drop a NEW pin on top).
        layer.on('click', (ev) => { L.DomEvent.stopPropagation(ev); });
        layer.unbindPopup();
        layer.bindPopup(buildPinForm(pin));
      });
      controller.segmentLayer.eachLayer((layer) => {
        const seg = layer._trailSegment;
        if (!seg) return;
        // Same: clicking a segment in pin/segment mode shouldn't also
        // drop a pin or extend the active segment.
        layer.on('click', (ev) => { L.DomEvent.stopPropagation(ev); });
        layer.unbindPopup();
        layer.bindPopup(buildSegmentForm(seg));
      });
      renderItemsList();
    };
    // Initial editor-flavoured render so dragging + edit forms attach.
    controller.render();

    function addPin(lat, lng) {
      const pin = {
        id: nextId('p', state.pins),
        kind: 'waypoint',
        lat, lng,
        note: '',
      };
      state.pins.push(pin);
      setDirty(true);
      controller.render();
      // Open the editor for the new pin immediately.
      controller.pinLayer.eachLayer((layer) => {
        if (layer._trailPin && layer._trailPin.id === pin.id) layer.openPopup();
      });
    }

    function buildPinForm(pin) {
      const div = document.createElement('div');
      div.className = 'trail-edit-form';
      div.innerHTML = `
        <label>Kind:
          <select data-field="kind">
            <option value="waypoint">waypoint</option>
            <option value="parking">parking</option>
            <option value="viewpoint">viewpoint</option>
            <option value="decision">decision</option>
            <option value="warning">warning</option>
            <option value="end">end</option>
          </select>
        </label>
        <label>Note:
          <textarea data-field="note" placeholder="park here, walk down the wash..."></textarea>
        </label>
        <div class="trail-edit-form__actions">
          <button type="button" class="trail-edit-form__btn-delete" data-act="del">Delete</button>
          <button type="button" class="trail-edit-form__btn-save" data-act="save">Save</button>
        </div>
      `;
      const sel = div.querySelector('[data-field="kind"]');
      const ta = div.querySelector('[data-field="note"]');
      sel.value = pin.kind || 'waypoint';
      ta.value = pin.note || '';
      div.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.getAttribute('data-act') === 'save') {
          pin.kind = sel.value;
          pin.note = ta.value;
          setDirty(true);
          controller.render();
          map.closePopup();
        } else if (t.getAttribute('data-act') === 'del') {
          state.pins = state.pins.filter((p) => p.id !== pin.id);
          setDirty(true);
          controller.render();
          map.closePopup();
        }
      });
      return div;
    }

    function buildSegmentForm(seg) {
      const div = document.createElement('div');
      div.className = 'trail-edit-form';
      div.innerHTML = `
        <label>Kind:
          <select data-field="kind">
            <option value="walk">walk</option>
            <option value="scramble">scramble</option>
            <option value="wade">wade</option>
            <option value="bushwhack">bushwhack</option>
            <option value="drive">drive</option>
          </select>
        </label>
        <label>Note:
          <textarea data-field="note"></textarea>
        </label>
        <div class="trail-edit-form__actions">
          <button type="button" class="trail-edit-form__btn-delete" data-act="del">Delete</button>
          <button type="button" class="trail-edit-form__btn-save" data-act="save">Save</button>
        </div>
      `;
      const sel = div.querySelector('[data-field="kind"]');
      const ta = div.querySelector('[data-field="note"]');
      sel.value = seg.kind || 'walk';
      ta.value = seg.note || '';
      div.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.getAttribute('data-act') === 'save') {
          seg.kind = sel.value;
          seg.note = ta.value;
          setDirty(true);
          controller.render();
          map.closePopup();
        } else if (t.getAttribute('data-act') === 'del') {
          state.segments = state.segments.filter((s) => s.id !== seg.id);
          setDirty(true);
          controller.render();
          map.closePopup();
        }
      });
      return div;
    }

    async function save() {
      // Snapshot current viewport so the saved file remembers where
      // the path "starts" visually.
      const c = map.getCenter();
      state.center = { lat: c.lat, lng: c.lng };
      state.zoom = map.getZoom();
      setStatus('saving...');
      try {
        const r = await fetch(SIDECAR + '/save-trail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: state.slug,
            name: state.name,
            center: state.center,
            zoom: state.zoom,
            pins: state.pins,
            segments: state.segments,
          }),
        });
        const body = await r.json();
        if (!r.ok || !body.ok) throw new Error(body.error || ('HTTP ' + r.status));
        setDirty(false);
        setStatus('saved -> ' + body.path);
      } catch (err) {
        console.error('[trail-editor] save failed', err);
        setStatus('save FAILED: ' + err.message);
      }
    }

    setMode('none');
  }

  // Bootstrap: wait for TrailMap to expose its controller via
  // window.__trailMap (set by the page after init), then attach.
  function boot() {
    if (!readDevMode()) return;
    const controller = window.__trailMap;
    const mapWrap = document.querySelector('.trail-map-wrap');
    if (!controller || !mapWrap) {
      // Try again next frame; the page wires controller right after init.
      requestAnimationFrame(boot);
      return;
    }
    attach(controller, mapWrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
