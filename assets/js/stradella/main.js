// Stradella Jam Set List — interactive chord recipe tool
(function () {
  'use strict';

  const M = window.Music;

  // qual display labels for Stradella buttons
  const QUAL = { M: 'M', m: 'm', '7': '7' };

  // ── Chord data (semitone offsets from root) ──
  const CHORDS = [
    // Basic Triads
    { id: 'maj', suffix: '', family: 'Basic Triads',
      intervals: '1–3–5', semitones: '0–4–3',
      recipe: { parts: [{note:0, qual:'M'}], bass: 0 },
      notes: '' },
    { id: 'min', suffix: 'm', family: 'Basic Triads',
      intervals: '1–♭3–5', semitones: '0–3–4',
      recipe: { parts: [{note:0, qual:'m'}], bass: 0 },
      notes: '' },

    // Major Family
    { id: 'maj6', suffix: 'maj6', family: 'Major Family',
      intervals: '1–3–5–6', semitones: '0–4–3–2',
      recipe: { parts: [{note:9, qual:'m'}], bass: 0 },
      notes: '6m = 6–1–3 over root',
      uncertain: true, uncertainNote: 'Missing 5th?' },
    { id: 'maj7', suffix: 'maj7', family: 'Major Family',
      intervals: '1–3–5–7', semitones: '0–4–3–4',
      recipe: { parts: [{note:4, qual:'m'}], bass: 0 },
      notes: '3–5–7 of root' },
    { id: 'maj7inv', suffix: 'maj7 (inv)', family: 'Major Family',
      intervals: '1–3–5–7', semitones: '0–4–3–4',
      recipe: { parts: [{note:0, qual:'M'}], bass: 11 },
      notes: '3rd inversion' },
    { id: 'maj9', suffix: 'maj9', family: 'Major Family',
      intervals: '1–3–5–7–9', semitones: '0–4–3–4–3',
      recipe: { parts: [{note:0, qual:'M'},{note:7, qual:'M'}], bass: 0 },
      notes: 'Root gives 1–3–5; 5th gives 5–7–9' },
    { id: 'add9', suffix: 'add9', family: 'Major Family',
      intervals: '1–3–5–9', semitones: '0–4–3–7',
      recipe: { parts: [{note:0, qual:'M'}], bass: 0, rh: 2 },
      notes: 'Exact 1–3–5–9, no 7th',
      uncertain: true, uncertainNote: 'Better way?' },

    // Minor Family
    { id: 'm6', suffix: 'm6', family: 'Minor Family',
      intervals: '1–♭3–5–6', semitones: '0–3–4–2',
      recipe: { parts: [{note:9, qual:'m'}], bass: 0 },
      notes: 'Shared voicing with maj6' },
    { id: 'm7', suffix: 'm7', family: 'Minor Family',
      intervals: '1–♭3–5–♭7', semitones: '0–3–4–3',
      recipe: { parts: [{note:3, qual:'M'}], bass: 0 },
      notes: '♭3 major = ♭3–5–♭7 of root' },
    { id: 'm9', suffix: 'm9', family: 'Minor Family',
      intervals: '1–♭3–5–♭7–9', semitones: '0–3–4–3–4',
      recipe: { parts: [{note:0, qual:'m'},{note:7, qual:'m'}], bass: 0 },
      notes: '♭3 gives ♭3–5–♭7; 5 adds 9' },
    { id: 'mMaj9', suffix: 'm(Maj9)', family: 'Minor Family',
      intervals: '1–♭3–5–7–9', semitones: null,
      recipe: { parts: [{note:0, qual:'m'},{note:7, qual:'M'}], bass: 0 },
      notes: '' },

    // Dominant Family
    { id: '7', suffix: '7', family: 'Dominant Family',
      intervals: '1–3–5–♭7', semitones: '0–4–3–3',
      recipe: { parts: [{note:7, qual:'m'}], bass: 0 },
      notes: '5m = 5–♭7–9 over root' },
    { id: '9', suffix: '9', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9', semitones: null,
      recipe: { parts: [{note:7, qual:'m'},{note:0, qual:'M'}], bass: 0 },
      notes: '' },
    { id: '11', suffix: '11', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9–11', semitones: '0–4–3–3–4–3',
      recipe: { parts: [{note:7, qual:'M'},{note:2, qual:'m'},{note:0, qual:'7'}], bass: 0 },
      notes: '2m adds 11. Theoretical full set' },
    { id: '13', suffix: '13', family: 'Dominant Family',
      intervals: '1–3–5–♭7–9–11–13', semitones: '0–4–3–3–4–3–4',
      recipe: { parts: [{note:7, qual:'M'},{note:2, qual:'m'},{note:4, qual:'m'},{note:0, qual:'7'}], bass: 0 },
      notes: 'Full set; RH recommended' },

    // Diminished Family
    { id: 'hdim7', suffix: 'ø7', family: 'Diminished Family',
      intervals: '1–♭3–♭5–♭7', semitones: '0–3–3–4',
      recipe: { parts: [{note:3, qual:'m'}], bass: 0 },
      notes: '♭3m = ♭3–♭5–♭7, half diminished' },
    { id: 'dim7', suffix: '°7', family: 'Diminished Family',
      intervals: '1–♭3–♭5–𝄫7', semitones: '0–3–3–3',
      recipe: null,
      notes: '',
      uncertain: true, uncertainNote: '♭3m close but ♭7 is half step too high' },
    { id: 'dim', suffix: 'dim', family: 'Diminished Family',
      intervals: '1–♭3–♭5', semitones: '0–3–3',
      recipe: { parts: [{note:3, qual:'m'}], bass: 0 },
      notes: 'Uses ♭3m',
      uncertain: true, uncertainNote: 'Added ♭7 may be noticeable' },

    // Augmented Family
    { id: 'aug', suffix: '+', family: 'Augmented Family',
      intervals: '1–3–♯5', semitones: '0–4–4',
      recipe: { parts: [{note:4, qual:'M'}], bass: 0 },
      notes: '3 major gives 3–♯5–7' },
    { id: 'aug7', suffix: '+7', family: 'Augmented Family',
      intervals: '1–3–♯5–♭7', semitones: '0–4–4–2',
      recipe: { parts: [{note:4, qual:'7'}], bass: 0 },
      notes: '3dom7 = 3–♯5–♭7' },
    { id: 'maj7s5', suffix: 'maj7♯5', family: 'Augmented Family',
      intervals: '1–3–♯5–7', semitones: '0–4–4–3',
      recipe: { parts: [{note:4, qual:'M'},{note:4, qual:'m'}], bass: 0 },
      notes: '',
      uncertain: true, uncertainNote: 'Check voicing' },

    // Altered Dominants
    { id: '7b5', suffix: '7♭5', family: 'Altered Dominants',
      intervals: '1–3–♭5–♭7', semitones: '0–4–2–4',
      recipe: { parts: [{note:6, qual:'7'}], bass: 0 },
      notes: '♭5dom7. Equivalent to ♯4 dom7♭5' },
    { id: '7b9', suffix: '7♭9', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♭9', semitones: '0–4–3–3–3',
      recipe: { parts: [{note:1, qual:'M'}], bass: 0 },
      notes: '♭2 major = ♭9' },
    { id: '7s9', suffix: '7♯9', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♯9', semitones: '0–4–3–3–5',
      recipe: { parts: [{note:3, qual:'M'}], bass: 0 },
      notes: '♯2 major = ♯9' },
    { id: '7s11', suffix: '7♯11', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♯11', semitones: '0–4–3–3–6',
      recipe: { parts: [{note:7, qual:'m'},{note:2, qual:'M'}], bass: 0 },
      notes: '2 major gives ♯11' },
    { id: '7b13', suffix: '7♭13', family: 'Altered Dominants',
      intervals: '1–3–5–♭7–♭13', semitones: '0–4–3–3–5',
      recipe: { parts: [{note:8, qual:'M'}], bass: 0 },
      notes: '♭6 major = ♭13' },

    // Misc
    { id: 'b9no7', suffix: '♭9', family: 'Misc',
      intervals: '1–3–5–♭9', semitones: '0–4–3–6',
      recipe: null,
      notes: 'No clean Stradella recipe' },
    { id: 'tritone', suffix: ' tritone', family: 'Misc',
      intervals: '', semitones: null,
      recipe: null,
      notes: 'Ex: G tritone = G7 + D♭M / G' },
    { id: '9sus4', suffix: '9sus4', family: 'Misc',
      intervals: '1–4–5–♭7–9', semitones: '0–5–2–3–4',
      recipe: { parts: [{note:10, qual:'M'}], bass: 0 },
      notes: 'Dom 9th sus4' },
    { id: '9_11', suffix: '9(11)', family: 'Misc',
      intervals: '1–3–5–♭7–9–11', semitones: null,
      recipe: { parts: [{note:10, qual:'M'},{note:0, qual:'M'}], bass: 0 },
      notes: 'Can omit 5, maybe 3' }
  ];

  // ── Helpers ──

  function renderChordName(entry, key) {
    return M.noteName(key) + entry.suffix;
  }

  function renderRecipe(entry, key) {
    const r = entry.recipe;
    if (!r) return '\u2014'; // em-dash
    const parts = r.parts.map(function (p) {
      return M.noteName(key + p.note) + QUAL[p.qual];
    });
    const bass = M.noteName(key + r.bass);
    let str = parts.join(' + ') + ' / ' + bass;
    if (r.rh != null) {
      str += ' + ' + M.noteName(key + r.rh) + ' (RH)';
    }
    return str;
  }

  function chordById(id) {
    for (let i = 0; i < CHORDS.length; i++) {
      if (CHORDS[i].id === id) return CHORDS[i];
    }
    return null;
  }

  // ── State ──

  const STORAGE_KEY = 'stradella-setlist';
  const state = {
    catalogKey: 0,
    selected: [],
    show: { recipe: true, notes: false, intervals: false, semitones: false }
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      // Migrate v1 format: {key: N, selected: ['id', ...]}
      if (typeof s.key === 'number' && Array.isArray(s.selected) &&
          s.selected.length > 0 && typeof s.selected[0] === 'string') {
        state.catalogKey = s.key;
        const ids = {};
        CHORDS.forEach(function (c) { ids[c.id] = true; });
        state.selected = s.selected
          .filter(function (id) { return ids[id]; })
          .map(function (id) { return { id: id, key: s.key }; });
        saveState();
        return;
      }
      // v2 format: {catalogKey: N, selected: [{id, key}, ...]}
      if (typeof s.catalogKey === 'number') state.catalogKey = s.catalogKey;
      if (Array.isArray(s.selected)) {
        const valid = {};
        CHORDS.forEach(function (c) { valid[c.id] = true; });
        state.selected = s.selected.filter(function (e) {
          return e && valid[e.id] && typeof e.key === 'number';
        });
      }
    } catch (e) { /* ignore */ }
  }

  function isSelectedAtKey(id, key) {
    return state.selected.some(function (e) {
      return e.id === id && e.key === key;
    });
  }

  function addEntry(id, key) {
    state.selected.push({ id: id, key: key });
    saveState();
  }

  function removeEntry(idx) {
    state.selected.splice(idx, 1);
    saveState();
  }

  // ── Export / Import ──

  function exportString() {
    return M.encodeEntries(state.catalogKey, state.selected);
  }

  function importString(str) {
    const validIds = {};
    CHORDS.forEach(function (c) { validIds[c.id] = true; });
    const result = M.decodeEntries(str, validIds);
    if (!result) return false;
    state.catalogKey = result.prefix;
    state.selected = result.entries;
    saveState();
    return true;
  }

  // ── Rendering ──

  function renderSetList() {
    const el = document.getElementById('stradella-setlist');
    if (!el) return;

    if (state.selected.length === 0) {
      el.innerHTML = '<p class="stradella-empty">No chords selected. Use the catalog to add chords.</p>';
      return;
    }

    let html = '';
    state.selected.forEach(function (entry, i) {
      const c = chordById(entry.id);
      if (!c) return;
      const key = entry.key;
      html += '<div class="stradella-card">';
      html += '<button class="stradella-card__remove" data-action="remove" data-idx="' + i + '" aria-label="Remove">&#10005;</button>';
      html += '<div class="stradella-card__chord">' + M.esc(renderChordName(c, key)) + '</div>';
      if (state.show.recipe) {
        html += '<div class="stradella-card__recipe">' + M.esc(renderRecipe(c, key)) + '</div>';
      }
      const info = M.chordInfo(key, c.suffix);
      if (info) {
        if (state.show.notes) {
          html += '<div class="stradella-detail stradella-notes">' + M.esc(info.notes.join(' ')) + '</div>';
        }
        if (state.show.intervals) {
          html += '<div class="stradella-detail stradella-intervals">' + M.esc(info.intervals.join(' ')) + '</div>';
        }
        if (state.show.semitones) {
          html += '<div class="stradella-detail stradella-semitones">' + M.esc(info.semitones.join('\u2013')) + '</div>';
        }
      }
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderCatalog() {
    const el = document.getElementById('stradella-catalog');
    if (!el) return;

    const families = [];
    const familyMap = {};
    CHORDS.forEach(function (c) {
      if (!familyMap[c.family]) {
        familyMap[c.family] = [];
        families.push(c.family);
      }
      familyMap[c.family].push(c);
    });

    const key = state.catalogKey;
    let html = '';
    families.forEach(function (fam) {
      html += '<div class="stradella-catalog-family">';
      html += '<h4 class="stradella-catalog-family__title">' + M.esc(fam) + '</h4>';
      html += '<div class="stradella-catalog-grid">';
      familyMap[fam].forEach(function (c) {
        const sel = isSelectedAtKey(c.id, key);
        let cls = 'stradella-catalog-item';
        if (sel) cls += ' is-selected';
        if (c.uncertain) cls += ' is-uncertain';
        html += '<button class="' + cls + '" data-id="' + c.id + '">';
        html += '<span class="stradella-catalog-item__name">' + M.esc(c.suffix || 'maj') + '</span>';
        if (state.show.recipe) {
          html += '<span class="stradella-catalog-item__recipe">' + M.esc(renderRecipe(c, key)) + '</span>';
        }
        const info = M.chordInfo(key, c.suffix);
        if (info) {
          if (state.show.notes) {
            html += '<span class="stradella-detail stradella-notes">' + M.esc(info.notes.join(' ')) + '</span>';
          }
          if (state.show.intervals) {
            html += '<span class="stradella-detail stradella-intervals">' + M.esc(info.intervals.join(' ')) + '</span>';
          }
          if (state.show.semitones) {
            html += '<span class="stradella-detail stradella-semitones">' + M.esc(info.semitones.join('\u2013')) + '</span>';
          }
        }
        if (c.uncertain && c.uncertainNote) {
          html += '<span class="stradella-catalog-item__warn">' + M.esc(c.uncertainNote) + '</span>';
        }
        html += '</button>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderKeyBar() {
    const bar = document.getElementById('stradella-key-bar');
    if (!bar) return;
    let html = '';
    M.NOTES.forEach(function (n, i) {
      let cls = 'music-key-btn';
      if (i === state.catalogKey) cls += ' is-active';
      html += '<button class="' + cls + '" data-key="' + i + '">' + M.esc(n) + '</button>';
    });
    bar.innerHTML = html;
  }

  function renderShareBox() {
    const el = document.getElementById('stradella-share-text');
    if (!el) return;
    el.value = exportString();
  }

  function renderAll() {
    renderKeyBar();
    renderSetList();
    renderCatalog();
    renderShareBox();
  }

  // ── Events ──

  function init() {
    loadState();
    renderAll();

    // Key bar — delegated click on note buttons
    const keyBar = document.getElementById('stradella-key-bar');
    if (keyBar) {
      keyBar.addEventListener('click', function (e) {
        const btn = e.target.closest('.music-key-btn');
        if (!btn) return;
        state.catalogKey = parseInt(btn.getAttribute('data-key'), 10);
        saveState();
        renderAll();
      });
    }

    // Toggle buttons (multi-select)
    const toggleGroup = document.getElementById('stradella-toggle-group');
    if (toggleGroup) {
      toggleGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('.music-toggle-btn');
        if (!btn) return;
        const layer = btn.dataset.layer;
        if (!state.show.hasOwnProperty(layer)) return;
        state.show[layer] = !state.show[layer];
        btn.classList.toggle('is-active', state.show[layer]);
        renderSetList();
        renderCatalog();
      });
    }

    // Set list remove (delegated)
    const setListEl = document.getElementById('stradella-setlist');
    if (setListEl) {
      setListEl.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action="remove"]');
        if (!btn) return;
        removeEntry(parseInt(btn.getAttribute('data-idx'), 10));
        renderAll();
      });
    }

    // Catalog click — toggle chord at current catalog key
    const catalogEl = document.getElementById('stradella-catalog');
    if (catalogEl) {
      catalogEl.addEventListener('click', function (e) {
        const item = e.target.closest('.stradella-catalog-item');
        if (!item) return;
        const id = item.getAttribute('data-id');
        addEntry(id, state.catalogKey);
        renderAll();
      });
    }

    // Share: copy button
    const copyBtn = document.getElementById('stradella-share-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const el = document.getElementById('stradella-share-text');
        if (!el) return;
        el.select();
        navigator.clipboard.writeText(el.value).then(function () {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });
    }

    // Share: load button
    const loadBtn = document.getElementById('stradella-share-load');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        const el = document.getElementById('stradella-share-text');
        if (!el) return;
        if (importString(el.value)) {
          renderAll();
          loadBtn.textContent = 'Loaded!';
          setTimeout(function () { loadBtn.textContent = 'Load'; }, 1500);
        } else {
          loadBtn.textContent = 'Invalid';
          setTimeout(function () { loadBtn.textContent = 'Load'; }, 1500);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
