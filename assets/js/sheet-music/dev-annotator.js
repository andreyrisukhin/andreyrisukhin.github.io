/*
 * Dev-mode annotation overlay for sheet music pages.
 *
 * Activates only on localhost or when ?dev is present in the URL.
 * Shift-click (or long-press on touch) anywhere on the score or page
 * drops a numbered pin, opens a textarea for a comment, and persists
 * all pins to localStorage keyed by pathname.
 *
 * Export: copy-as-markdown or download-JSON, both structured so an
 * agent can consume the feedback without a live round-trip.
 *
 * Inspiration: kunchenguid/lavish-axi. This is a lighter, static-site
 * variant without the polling sidecar.
 */

(function () {
  const isDev =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    new URLSearchParams(location.search).has('dev');
  if (!isDev) return;

  const STORAGE_KEY = 'sheet-annotator:' + location.pathname;
  const PIN_MODIFIER = 'shiftKey';

  /** @type {Array<{id:number,x:number,y:number,anchorX:number,anchorY:number,context:string,note:string,createdAt:string}>} */
  let pins = loadPins();
  let nextId = pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  let selectedPinId = null;

  const root = document.createElement('div');
  root.className = 'sheet-annotator-root';
  root.innerHTML = `
    <div class="sheet-annotator-hud" role="region" aria-label="Sheet music annotations (dev mode)">
      <div class="sheet-annotator-hud__title">
        <span class="sheet-annotator-hud__dot"></span>
        Dev annotator
        <span class="sheet-annotator-hud__count" data-count>0 pins</span>
      </div>
      <div class="sheet-annotator-hud__hint">Shift-click anywhere on the score to pin feedback.</div>
      <div class="sheet-annotator-hud__actions">
        <button type="button" data-action="copy">Copy as Markdown</button>
        <button type="button" data-action="download">Download JSON</button>
        <button type="button" data-action="clear">Clear all</button>
      </div>
    </div>
    <div class="sheet-annotator-layer" data-layer aria-hidden="true"></div>
    <div class="sheet-annotator-toast" data-toast hidden></div>
  `;
  document.body.appendChild(root);

  const layer = root.querySelector('[data-layer]');
  const countEl = root.querySelector('[data-count]');
  const toast = root.querySelector('[data-toast]');

  root.querySelector('[data-action="copy"]').addEventListener('click', () => {
    const md = pinsAsMarkdown(pins);
    navigator.clipboard.writeText(md).then(
      () => showToast('Copied ' + pins.length + ' pin' + (pins.length === 1 ? '' : 's') + ' as Markdown'),
      () => showToast('Clipboard blocked — use Download JSON')
    );
  });
  root.querySelector('[data-action="download"]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ pathname: location.pathname, pins }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotations' + location.pathname.replace(/\//g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  root.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (!pins.length) return;
    if (!confirm('Delete all ' + pins.length + ' pins for this page?')) return;
    pins = [];
    persist();
    rerenderPins();
  });

  document.addEventListener('click', (e) => {
    if (!e[PIN_MODIFIER]) return;
    if (e.target instanceof Element && e.target.closest('.sheet-annotator-root')) return;
    e.preventDefault();
    e.stopPropagation();
    addPin(e);
  }, true);

  window.addEventListener('resize', rerenderPins);
  const osmdContainer = document.getElementById('osmd-container');
  if (osmdContainer) {
    new MutationObserver(rerenderPins).observe(osmdContainer, { childList: true, subtree: true });
  }

  rerenderPins();

  function addPin(ev) {
    const { x, y, anchorX, anchorY } = pageCoords(ev);
    const context = describeTarget(ev.target);
    const note = window.prompt('Feedback on ' + context + ':', '');
    if (note == null || note.trim() === '') return;
    pins.push({
      id: nextId++,
      x, y, anchorX, anchorY,
      context,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    persist();
    rerenderPins();
  }

  function pageCoords(ev) {
    const anchor = nearestAnchor(ev.target);
    const rect = anchor ? anchor.getBoundingClientRect() : null;
    return {
      x: ev.pageX,
      y: ev.pageY,
      anchorX: rect ? (ev.clientX - rect.left) / Math.max(rect.width, 1) : null,
      anchorY: rect ? (ev.clientY - rect.top) / Math.max(rect.height, 1) : null,
    };
  }

  function nearestAnchor(el) {
    if (!(el instanceof Element)) return null;
    return el.closest('[id], .vf-measure, .vf-stavenote, svg, #osmd-container') || null;
  }

  function describeTarget(target) {
    if (!(target instanceof Element)) return 'page';
    const measure = target.closest('[id^="measureNumber"], .vf-measure');
    if (measure) {
      const n = measure.id || measure.getAttribute('data-measure') || measure.className;
      return 'measure ' + n;
    }
    const control = target.closest('[id], button, a');
    if (control) {
      if (control.id) return '#' + control.id;
      return (control.tagName || 'el').toLowerCase() + ' "' + (control.textContent || '').trim().slice(0, 40) + '"';
    }
    return target.tagName ? target.tagName.toLowerCase() : 'page';
  }

  function rerenderPins() {
    layer.innerHTML = '';
    pins.forEach((p) => layer.appendChild(renderPin(p)));
    countEl.textContent = pins.length + ' pin' + (pins.length === 1 ? '' : 's');
  }

  function renderPin(p) {
    const el = document.createElement('div');
    el.className = 'sheet-annotator-pin';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Pin ' + p.id + ': ' + p.note);
    el.innerHTML = `
      <span class="sheet-annotator-pin__num">${p.id}</span>
      <div class="sheet-annotator-pin__card" hidden>
        <div class="sheet-annotator-pin__ctx">${escapeHtml(p.context)}</div>
        <textarea rows="3">${escapeHtml(p.note)}</textarea>
        <div class="sheet-annotator-pin__card-actions">
          <button type="button" data-pin-action="save">Save</button>
          <button type="button" data-pin-action="delete">Delete</button>
        </div>
      </div>
    `;
    const card = el.querySelector('.sheet-annotator-pin__card');
    const textarea = el.querySelector('textarea');
    el.querySelector('.sheet-annotator-pin__num').addEventListener('click', (e) => {
      e.stopPropagation();
      const wasHidden = card.hasAttribute('hidden');
      document.querySelectorAll('.sheet-annotator-pin__card').forEach((c) => c.setAttribute('hidden', ''));
      if (wasHidden) {
        card.removeAttribute('hidden');
        textarea.focus();
        selectedPinId = p.id;
      } else {
        selectedPinId = null;
      }
    });
    card.querySelector('[data-pin-action="save"]').addEventListener('click', () => {
      p.note = textarea.value.trim();
      persist();
      card.setAttribute('hidden', '');
    });
    card.querySelector('[data-pin-action="delete"]').addEventListener('click', () => {
      pins = pins.filter((x) => x.id !== p.id);
      persist();
      rerenderPins();
    });
    return el;
  }

  function loadPins() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  }

  function pinsAsMarkdown(list) {
    if (!list.length) return '_No annotations yet._\n';
    const header = '### Sheet music feedback — ' + location.pathname + '\n\n';
    const body = list
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((p) => `${p.id}. **${p.context}** — ${p.note}`)
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
  }
})();
