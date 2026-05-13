/*
 * Dev-mode annotation overlay for sheet music pages.
 *
 * Activates only on localhost or when ?dev is in the URL. Shift-click
 * drops a pin with semantic OSMD identity (measure, staff, pitches),
 * a thumbnail crop of the score around the click, and a persistent
 * note. Pins sync to a Node sidecar (bin/dev-annotator-server.mjs) at
 * http://localhost:4001 and fall back to localStorage when it is down.
 *
 * Inspiration: kunchenguid/lavish-axi.
 */

(function () {
  const isDev =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    new URLSearchParams(location.search).has('dev');
  if (!isDev) return;

  const STORAGE_KEY = 'sheet-annotator:' + location.pathname;
  const SIDECAR = 'http://127.0.0.1:4001';
  const PIN_MODIFIER = 'shiftKey';

  const state = {
    pins: loadLocalPins(),
    nextId: 1,
    sidecarStatus: 'unknown',
  };
  state.nextId = state.pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;

  const sidebar = buildSidebar();
  document.body.appendChild(sidebar.root);

  probeSidecar().then(() => hydrateFromSidecar());

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', hidePreview);
  window.addEventListener('resize', rerender);

  rerender();

  const preview = buildPreview();
  let shiftHeld = false;
  let lastMouse = { x: 0, y: 0, target: null };

  if (new URLSearchParams(location.search).has('highlight')) {
    const ready = window.__sheetMusic && window.__sheetMusic.readyPromise;
    (ready || Promise.resolve()).then(() => setTimeout(paintAllTargets, 100));
    window.addEventListener('resize', () => {
      clearAllTargets();
      setTimeout(paintAllTargets, 200);
    });
  }

  function paintAllTargets() {
    clearAllTargets();
    const svg = document.querySelector('#osmd-container svg');
    if (!svg) return;
    let noteCount = 0, chordCount = 0;

    for (const g of svg.querySelectorAll('.vf-stavenote')) {
      const glyph = g.querySelector('.vf-note') || g;
      const r = glyph.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      document.body.appendChild(makeMark('notehead', padRect(rectToPage(r), 3)));
      noteCount++;
    }
    for (const text of svg.querySelectorAll('.vf-text text')) {
      const content = (text.textContent || '').trim();
      if (!/^[A-G][#b]?(maj|min|m|M|dim|aug|sus|add)?\d*(\/[A-G][#b]?)?$/.test(content)) continue;
      const r = text.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      document.body.appendChild(makeMark('chord-symbol', padRect(rectToPage(r), 2)));
      chordCount++;
    }
    console.log('[annotator] highlighted', noteCount, 'noteheads and', chordCount, 'chord symbols');
  }

  function clearAllTargets() {
    for (const el of document.querySelectorAll('[data-sheet-highlight]')) el.remove();
  }

  function makeMark(kind, rect) {
    const el = document.createElement('div');
    el.className = 'sheet-annotator-preview';
    el.setAttribute('data-kind', kind);
    el.setAttribute('data-sheet-highlight', '1');
    el.setAttribute('data-sheet-annotator', 'highlight');
    el.style.left = rect.x + 'px';
    el.style.top = rect.y + 'px';
    el.style.width = rect.w + 'px';
    el.style.height = rect.h + 'px';
    el.style.pointerEvents = 'none';
    return el;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') sidebar.close();
    if (e.key === 'Shift' && !shiftHeld) {
      shiftHeld = true;
      updatePreview();
    }
  }
  function onKeyUp(e) {
    if (e.key === 'Shift') {
      shiftHeld = false;
      hidePreview();
    }
  }
  function onMouseMove(e) {
    lastMouse = { x: e.pageX, y: e.pageY, target: e.target };
    if (shiftHeld) updatePreview();
  }

  function updatePreview() {
    if (!lastMouse.target) { hidePreview(); return; }
    if (lastMouse.target.closest && lastMouse.target.closest('[data-sheet-annotator]')) {
      hidePreview();
      return;
    }
    const hit = classifyTarget(lastMouse.target, lastMouse.x, lastMouse.y);
    if (!hit || !hit.rect) { hidePreview(); return; }
    preview.root.style.display = 'block';
    preview.root.setAttribute('data-kind', hit.kind);
    preview.root.style.left = hit.rect.x + 'px';
    preview.root.style.top = hit.rect.y + 'px';
    preview.root.style.width = hit.rect.w + 'px';
    preview.root.style.height = hit.rect.h + 'px';
    preview.label.textContent = hit.label;
  }
  function hidePreview() {
    preview.root.style.display = 'none';
  }

  function classifyTarget(target, pageX, pageY) {
    if (!(target instanceof Element)) return null;
    const chordText = detectChordSymbol(target);
    if (chordText) {
      const r = target.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return {
        kind: 'chord-symbol',
        label: 'chord: ' + chordText,
        rect: rectToPage(r),
      };
    }
    const staveNote = target.closest && target.closest('.vf-stavenote');
    if (staveNote) {
      const glyph = target.closest('.vf-notehead, .vf-note')
        || staveNote.querySelector('.vf-note') || staveNote;
      const gr = glyph.getBoundingClientRect();
      if (gr.width > 0 && gr.height > 0) {
        const bridge = window.__sheetMusic;
        const resolved = (bridge && bridge.ready) ? bridge.resolveNoteAt(pageX, pageY, 80) : null;
        const isRest = !!(resolved && resolved.isRest);
        const isTied = !!(resolved && resolved.isTied);
        const clicked = resolved && resolved.clickedPitch;
        const pitch = isRest ? 'rest' : (clicked || (resolved && resolved.pitches && resolved.pitches[0]) || 'note');
        const measure = resolved && resolved.measureNumber;
        const lead = (isTied && !isRest) ? '\u2040 ' : '';
        const label = lead + pitch + (measure != null ? ' · m' + measure : '');
        return {
          kind: 'notehead',
          label,
          rect: padRect(rectToPage(gr), 4),
        };
      }
    }
    const r = target.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      kind: 'region',
      label: 'region · ' + (target.tagName || '').toLowerCase(),
      rect: rectToPage(r),
    };
  }

  function rectToPage(r) {
    return {
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      w: r.width, h: r.height,
    };
  }

  function padRect(r, pad) {
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  }

  function buildPreview() {
    const root = document.createElement('div');
    root.className = 'sheet-annotator-preview';
    root.setAttribute('data-sheet-annotator', 'preview');
    root.style.display = 'none';
    const label = document.createElement('span');
    label.className = 'sheet-annotator-preview__label';
    root.appendChild(label);
    document.body.appendChild(root);
    return { root, label };
  }

  async function onClick(e) {
    if (e.target instanceof Element && e.target.closest('[data-sheet-annotator]')) return;
    if (!e[PIN_MODIFIER]) return;
    e.preventDefault();
    e.stopPropagation();
    hidePreview();

    const identity = await captureIdentity(e);
    const pin = {
      id: state.nextId++,
      x: e.pageX,
      y: e.pageY,
      context: identity.context,
      identity,
      note: '',
      createdAt: new Date().toISOString(),
    };
    state.pins.push(pin);
    await persist();
    rerender();
    sidebar.open();
    sidebar.focusPin(pin.id);
    flashPin(pin.id);
  }

  async function captureIdentity(ev) {
    const out = {
      kind: 'region',
      context: 'page',
      measureNumber: null,
      staffIndex: null,
      pitches: [],
      clickedPitch: null,
      chordSymbol: null,
      isRest: false,
      isTied: false,
      selector: cssPath(ev.target),
      thumbnail: null,
    };
    const bridge = window.__sheetMusic;
    let resolvedRect = null;

    const chordText = detectChordSymbol(ev.target);
    if (chordText) {
      out.kind = 'chord-symbol';
      out.chordSymbol = chordText;
      const r = ev.target.getBoundingClientRect();
      resolvedRect = {
        x: r.left + window.scrollX,
        y: r.top + window.scrollY,
        w: r.width, h: r.height,
      };
      if (bridge && bridge.ready) {
        const hit = bridge.resolveNoteAt(ev.pageX, ev.pageY, 72);
        if (hit) {
          out.measureNumber = hit.measureNumber;
          out.staffIndex = hit.staffIndex;
        }
      }
      const where = out.measureNumber != null ? ' · m' + out.measureNumber : '';
      out.context = 'chord: ' + chordText + where;
    } else {
      const staveNote = ev.target instanceof Element ? ev.target.closest('.vf-stavenote') : null;
      if (staveNote) {
        const glyph = ev.target.closest('.vf-notehead, .vf-note')
          || staveNote.querySelector('.vf-note') || staveNote;
        const gr = glyph.getBoundingClientRect();
        resolvedRect = {
          x: gr.left + window.scrollX,
          y: gr.top + window.scrollY,
          w: gr.width, h: gr.height,
        };
        out.kind = 'notehead';
        if (bridge && bridge.ready) {
          const hit = bridge.resolveNoteAt(ev.pageX, ev.pageY, 80);
          if (hit) {
            out.measureNumber = hit.measureNumber;
            out.staffIndex = hit.staffIndex;
            out.pitches = hit.pitches || [];
            out.clickedPitch = hit.clickedPitch || null;
            out.isRest = !!hit.isRest;
            out.isTied = !!hit.isTied;
            out.context = semanticContext(hit);
          }
        }
        if (out.context === 'page') {
          out.context = 'note · unresolved';
        }
      }
    }

    if (!resolvedRect && ev.target instanceof Element) {
      const r = ev.target.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        resolvedRect = {
          x: r.left + window.scrollX,
          y: r.top + window.scrollY,
          w: r.width, h: r.height,
        };
      }
    }

    if (bridge && bridge.ready) {
      try {
        out.thumbnail = await bridge.snapshotAround(
          ev.pageX, ev.pageY, 220, 140,
          { bboxPage: resolvedRect, clickPage: { x: ev.pageX, y: ev.pageY } }
        );
      } catch (_) { /* ignore */ }
    }

    if (out.context === 'page') {
      out.context = 'region · ' + domFallbackContext(ev.target);
    }
    return out;
  }

  function detectChordSymbol(target) {
    if (!(target instanceof Element)) return null;
    const text = target.closest('text');
    if (!text) return null;
    if (!text.closest('.vf-text')) return null;
    const content = (text.textContent || '').trim();
    if (!content) return null;
    if (/^[A-G][#b]?(maj|min|m|M|dim|aug|sus|add)?\d*(\/[A-G][#b]?)?$/.test(content)) {
      return content;
    }
    return null;
  }

  function pointInRect(px, py, rect, pad = 0) {
    if (!rect) return false;
    return px >= rect.x - pad && px <= rect.x + rect.w + pad &&
           py >= rect.y - pad && py <= rect.y + rect.h + pad;
  }

  function semanticContext(hit) {
    const parts = [];
    if (hit.measureNumber != null) parts.push('m' + hit.measureNumber);
    if (hit.staffIndex != null) parts.push('staff ' + (hit.staffIndex + 1));
    if (hit.isRest) {
      parts.push('rest');
    } else {
      const clicked = hit.clickedPitch;
      if (clicked && hit.pitches && hit.pitches.length > 1) {
        parts.push('\u27e8' + clicked + '\u27e9 in [' + hit.pitches.join(' ') + ']');
      } else if (clicked) {
        parts.push(clicked);
      } else if (hit.pitches && hit.pitches.length) {
        parts.push(hit.pitches.length > 1 ? '[' + hit.pitches.join(' ') + ']' : hit.pitches[0]);
      }
      if (hit.isTied) parts.push('tied');
    }
    return parts.join(' · ') || 'score';
  }

  function domFallbackContext(target) {
    if (!(target instanceof Element)) return 'page';
    const control = target.closest('button, a');
    if (control) {
      const label = (control.textContent || '').trim().slice(0, 30);
      return (control.tagName || 'el').toLowerCase() + (label ? ' "' + label + '"' : '');
    }
    const withId = target.closest('[id]');
    if (withId && withId.id && !withId.id.startsWith('osmd-container')) {
      return '#' + withId.id;
    }
    return (target.tagName || 'page').toLowerCase();
  }

  function cssPath(target) {
    if (!(target instanceof Element)) return null;
    const path = [];
    let el = target;
    while (el && el.nodeType === 1 && path.length < 6) {
      let sel = el.tagName.toLowerCase();
      if (el.id) { sel += '#' + el.id; path.unshift(sel); break; }
      if (el.classList.length) sel += '.' + [...el.classList].slice(0, 2).join('.');
      const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.tagName === el.tagName) : [];
      if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      path.unshift(sel);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function rerender() {
    document.querySelectorAll('[data-sheet-pin]').forEach((el) => el.remove());
    state.pins.forEach((p) => document.body.appendChild(renderPinMarker(p)));
    sidebar.rerenderList();
  }

  function renderPinMarker(p) {
    const el = document.createElement('button');
    el.type = 'button';
    el.setAttribute('data-sheet-pin', String(p.id));
    el.setAttribute('data-sheet-annotator', 'pin');
    el.className = 'sheet-annotator-pin';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.textContent = String(p.id);
    el.title = (p.note ? p.note + ' — ' : '') + p.context;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.open();
      sidebar.focusPin(p.id);
    });
    return el;
  }

  function flashPin(id) {
    const el = document.querySelector('[data-sheet-pin="' + id + '"]');
    if (!el) return;
    el.classList.add('is-flashing');
    setTimeout(() => el.classList.remove('is-flashing'), 900);
  }

  function loadLocalPins() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) { return []; }
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pins));
    } catch (err) {
      console.warn('[annotator] localStorage save failed', err);
    }
  }

  async function persist() {
    saveLocal();
    if (state.sidecarStatus !== 'up') return;
    try {
      const res = await fetch(SIDECAR + '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: location.pathname, pins: state.pins }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      sidebar.setStatus('saved → ' + data.path);
    } catch (err) {
      console.warn('[annotator] sidecar save failed', err);
      state.sidecarStatus = 'down';
      sidebar.setStatus('local only (sidecar offline)', true);
    }
  }

  async function probeSidecar() {
    try {
      const res = await fetch(SIDECAR + '/health', { cache: 'no-store' });
      state.sidecarStatus = res.ok ? 'up' : 'down';
    } catch (_) {
      state.sidecarStatus = 'down';
    }
    sidebar.setStatus(
      state.sidecarStatus === 'up' ? 'sidecar online' : 'local only (sidecar offline)',
      state.sidecarStatus !== 'up'
    );
  }

  async function hydrateFromSidecar() {
    if (state.sidecarStatus !== 'up') return;
    try {
      const res = await fetch(SIDECAR + '/load?pathname=' + encodeURIComponent(location.pathname));
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.pins)) return;
      if (!data.pins.length) return;
      const localNewer = state.pins.length > data.pins.length;
      if (localNewer) { await persist(); return; }
      state.pins = data.pins;
      state.nextId = state.pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      saveLocal();
      rerender();
    } catch (err) {
      console.warn('[annotator] hydrate failed', err);
    }
  }

  function pinsAsMarkdown(list) {
    if (!list.length) return '_No annotations yet._\n';
    const header = '### Sheet music feedback — ' + location.pathname + '\n\n';
    const body = list
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((p) => {
        const ctx = p.context || (p.identity && p.identity.context) || '?';
        const note = p.note || '_(no note)_';
        return `${p.id}. **${ctx}** — ${note}`;
      })
      .join('\n');
    return header + body + '\n';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildSidebar() {
    const root = document.createElement('aside');
    root.className = 'sheet-annotator-sidebar is-collapsed';
    root.setAttribute('data-sheet-annotator', 'sidebar');
    root.innerHTML = `
      <button type="button" class="sheet-annotator-sidebar__toggle" data-action="toggle" aria-label="Toggle annotations panel">
        <span class="sheet-annotator-sidebar__toggle-badge" data-count>0</span>
        <span class="sheet-annotator-sidebar__toggle-label">Feedback</span>
      </button>
      <div class="sheet-annotator-sidebar__inner">
        <header class="sheet-annotator-sidebar__head">
          <div class="sheet-annotator-sidebar__title">
            <span class="sheet-annotator-sidebar__dot"></span>
            Dev feedback
          </div>
          <button type="button" class="sheet-annotator-sidebar__close" data-action="close" aria-label="Collapse panel">×</button>
        </header>
        <p class="sheet-annotator-sidebar__hint">Shift-click anywhere on the page to drop a pin.</p>
        <p class="sheet-annotator-sidebar__status" data-status></p>
        <div class="sheet-annotator-sidebar__actions">
          <button type="button" data-action="copy">Copy Markdown</button>
          <button type="button" data-action="download">Download JSON</button>
          <button type="button" data-action="clear">Clear all</button>
        </div>
        <ol class="sheet-annotator-sidebar__list" data-list></ol>
        <p class="sheet-annotator-sidebar__empty" data-empty>No pins yet.</p>
      </div>
      <div class="sheet-annotator-toast" data-toast hidden></div>
    `;

    const list = root.querySelector('[data-list]');
    const emptyMsg = root.querySelector('[data-empty]');
    const countEl = root.querySelector('[data-count]');
    const toast = root.querySelector('[data-toast]');
    const statusEl = root.querySelector('[data-status]');

    root.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const action = target.getAttribute('data-action');
      if (action === 'toggle') root.classList.toggle('is-collapsed');
      else if (action === 'close') root.classList.add('is-collapsed');
      else if (action === 'copy') copyMarkdown();
      else if (action === 'download') downloadJson();
      else if (action === 'clear') clearAll();
    });

    function copyMarkdown() {
      const md = pinsAsMarkdown(state.pins);
      navigator.clipboard.writeText(md).then(
        () => showToast('Copied ' + state.pins.length + ' pin' + (state.pins.length === 1 ? '' : 's') + ' as Markdown'),
        () => showToast('Clipboard blocked — use Download JSON')
      );
    }
    function downloadJson() {
      const blob = new Blob(
        [JSON.stringify({ pathname: location.pathname, pins: state.pins }, null, 2)],
        { type: 'application/json' }
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'annotations' + location.pathname.replace(/\//g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    async function clearAll() {
      if (!state.pins.length) return;
      if (!confirm('Delete all ' + state.pins.length + ' pins for this page?')) return;
      state.pins = [];
      await persist();
      rerender();
    }

    function rerenderList() {
      countEl.textContent = String(state.pins.length);
      list.innerHTML = '';
      state.pins
        .slice()
        .sort((a, b) => a.id - b.id)
        .forEach((p) => list.appendChild(renderEntry(p)));
      emptyMsg.hidden = state.pins.length > 0;
    }

    function renderEntry(p) {
      const li = document.createElement('li');
      li.className = 'sheet-annotator-entry';
      li.setAttribute('data-entry-id', String(p.id));
      const hasThumb = p.identity && p.identity.thumbnail;
      li.innerHTML = `
        <header class="sheet-annotator-entry__head">
          <button type="button" class="sheet-annotator-entry__id" data-entry-action="jump" aria-label="Jump to pin ${p.id}">${p.id}</button>
          <span class="sheet-annotator-entry__ctx">${escapeHtml(p.context || '')}</span>
          <button type="button" class="sheet-annotator-entry__delete" data-entry-action="delete" aria-label="Delete pin ${p.id}">×</button>
        </header>
        ${hasThumb ? `<img class="sheet-annotator-entry__thumb" src="${p.identity.thumbnail}" alt="score crop">` : ''}
        <textarea class="sheet-annotator-entry__note" rows="3" placeholder="Describe the issue or change…">${escapeHtml(p.note)}</textarea>
      `;
      const ta = li.querySelector('textarea');
      let debounce;
      ta.addEventListener('input', () => {
        p.note = ta.value;
        saveLocal();
        clearTimeout(debounce);
        debounce = setTimeout(persist, 400);
        const marker = document.querySelector('[data-sheet-pin="' + p.id + '"]');
        if (marker) marker.title = p.note || p.context;
      });
      li.querySelector('[data-entry-action="jump"]').addEventListener('click', () => {
        window.scrollTo({ top: Math.max(0, p.y - window.innerHeight / 3), behavior: 'smooth' });
        flashPin(p.id);
      });
      li.querySelector('[data-entry-action="delete"]').addEventListener('click', async () => {
        state.pins = state.pins.filter((x) => x.id !== p.id);
        await persist();
        rerender();
      });
      return li;
    }

    function focusPin(id) {
      rerenderList();
      const entry = list.querySelector('[data-entry-id="' + id + '"]');
      if (!entry) return;
      const ta = entry.querySelector('textarea');
      ta.focus();
      entry.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function showToast(msg) {
      toast.textContent = msg;
      toast.hidden = false;
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
    }

    function setStatus(text, warn) {
      statusEl.textContent = text;
      statusEl.classList.toggle('is-warn', !!warn);
    }

    function open() { root.classList.remove('is-collapsed'); }
    function close() { root.classList.add('is-collapsed'); }

    return { root, open, close, rerenderList, focusPin, setStatus };
  }
})();
