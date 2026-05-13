/*
 * Dev-mode annotation overlay for sheet music pages.
 *
 * Activates only on localhost or when ?dev is present in the URL.
 * Shift-click anywhere drops a numbered pin at document coordinates and
 * opens a right-side sidebar focused on that pin's editable note.
 *
 * Storage: localStorage keyed by pathname. Export: copy-as-markdown or
 * download-JSON.
 *
 * Inspiration: kunchenguid/lavish-axi, minus the polling sidecar.
 */

(function () {
  const isDev =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    new URLSearchParams(location.search).has('dev');
  if (!isDev) return;

  const STORAGE_KEY = 'sheet-annotator:' + location.pathname;
  const PIN_MODIFIER = 'shiftKey';

  /** @type {Array<{id:number,x:number,y:number,context:string,note:string,createdAt:string}>} */
  let pins = loadPins();
  let nextId = pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;

  const sidebar = buildSidebar();
  document.body.appendChild(sidebar.root);

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sidebar.close();
  });

  rerender();

  function onClick(e) {
    if (e.target instanceof Element && e.target.closest('[data-sheet-annotator]')) return;
    if (!e[PIN_MODIFIER]) return;
    e.preventDefault();
    e.stopPropagation();

    const context = describeTarget(e.target);
    const pin = {
      id: nextId++,
      x: e.pageX,
      y: e.pageY,
      context,
      note: '',
      createdAt: new Date().toISOString(),
    };
    pins.push(pin);
    persist();
    rerender();
    sidebar.open();
    sidebar.focusPin(pin.id);
    flashPin(pin.id);
  }

  function describeTarget(target) {
    if (!(target instanceof Element)) return 'page';
    const measure =
      target.closest('[id^="measureNumber"]') ||
      target.closest('.vf-measure') ||
      target.closest('[data-measure]');
    if (measure) {
      const n = measure.id || measure.getAttribute('data-measure') || measure.className;
      return 'measure ' + n;
    }
    const withId = target.closest('[id]');
    if (withId && withId.id && !withId.id.startsWith('osmd-container')) {
      return '#' + withId.id;
    }
    const control = target.closest('button, a');
    if (control) {
      const label = (control.textContent || '').trim().slice(0, 40);
      return (control.tagName || 'el').toLowerCase() + (label ? ' "' + label + '"' : '');
    }
    return target.tagName ? target.tagName.toLowerCase() : 'page';
  }

  function rerender() {
    document.querySelectorAll('[data-sheet-pin]').forEach((el) => el.remove());
    pins.forEach((p) => document.body.appendChild(renderPinMarker(p)));
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
    el.title = p.note || p.context;
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
      .map((p) => `${p.id}. **${p.context}** — ${p.note || '_(no note)_'}`)
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

    root.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const action = target.getAttribute('data-action');
      if (action === 'toggle') toggle();
      else if (action === 'close') close();
      else if (action === 'copy') copyMarkdown();
      else if (action === 'download') downloadJson();
      else if (action === 'clear') clearAll();
    });

    function toggle() {
      root.classList.toggle('is-collapsed');
    }
    function open() {
      root.classList.remove('is-collapsed');
    }
    function close() {
      root.classList.add('is-collapsed');
    }

    function copyMarkdown() {
      const md = pinsAsMarkdown(pins);
      navigator.clipboard.writeText(md).then(
        () => showToast('Copied ' + pins.length + ' pin' + (pins.length === 1 ? '' : 's') + ' as Markdown'),
        () => showToast('Clipboard blocked — use Download JSON')
      );
    }
    function downloadJson() {
      const blob = new Blob(
        [JSON.stringify({ pathname: location.pathname, pins }, null, 2)],
        { type: 'application/json' }
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'annotations' + location.pathname.replace(/\//g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    function clearAll() {
      if (!pins.length) return;
      if (!confirm('Delete all ' + pins.length + ' pins for this page?')) return;
      pins = [];
      persist();
      rerender();
    }

    function rerenderList() {
      countEl.textContent = String(pins.length);
      list.innerHTML = '';
      pins
        .slice()
        .sort((a, b) => a.id - b.id)
        .forEach((p) => list.appendChild(renderEntry(p)));
      emptyMsg.hidden = pins.length > 0;
    }

    function renderEntry(p) {
      const li = document.createElement('li');
      li.className = 'sheet-annotator-entry';
      li.setAttribute('data-entry-id', String(p.id));
      li.innerHTML = `
        <header class="sheet-annotator-entry__head">
          <button type="button" class="sheet-annotator-entry__id" data-entry-action="jump" aria-label="Jump to pin ${p.id}">${p.id}</button>
          <span class="sheet-annotator-entry__ctx">${escapeHtml(p.context)}</span>
          <button type="button" class="sheet-annotator-entry__delete" data-entry-action="delete" aria-label="Delete pin ${p.id}">×</button>
        </header>
        <textarea class="sheet-annotator-entry__note" rows="3" placeholder="Describe the issue or change…">${escapeHtml(p.note)}</textarea>
      `;
      const ta = li.querySelector('textarea');
      ta.addEventListener('input', () => {
        p.note = ta.value;
        persist();
        const marker = document.querySelector('[data-sheet-pin="' + p.id + '"]');
        if (marker) marker.title = p.note || p.context;
      });
      li.querySelector('[data-entry-action="jump"]').addEventListener('click', () => {
        window.scrollTo({ top: Math.max(0, p.y - window.innerHeight / 3), behavior: 'smooth' });
        flashPin(p.id);
      });
      li.querySelector('[data-entry-action="delete"]').addEventListener('click', () => {
        pins = pins.filter((x) => x.id !== p.id);
        persist();
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

    return { root, open, close, rerenderList, focusPin };
  }
})();
