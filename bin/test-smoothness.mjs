#!/usr/bin/env node
/*
 * End-to-end smoothness test for the sheet-music dev annotator.
 *
 * Drives the live page through agent-browser (Playwright under the hood)
 * and asserts the feedback loop stays responsive and semantically correct.
 *
 * Prereq: `bin/dev-serve.sh` running (Jekyll on :4000 + sidecar on :4001)
 * and `agent-browser install` has been run at least once.
 *
 * Run:   node bin/test-smoothness.mjs
 * Exit:  0 on pass, 1 on first failure.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PAGE = 'http://localhost:4000/music/sheet/cogwork-dancers/';
const SIDECAR = 'http://127.0.0.1:4001';
const PATHNAME = '/music/sheet/cogwork-dancers/';
const ANNOT_FILE = resolve(ROOT, '.dev-annotations/music-sheet-cogwork-dancers.json');

const THRESHOLDS = {
  clickToPinMs: 300,
  clickToSidebarMs: 300,
  keystrokeToSaveMs: 250,
};

let passed = 0;
let failed = 0;

function ab(args, { stdin } = {}) {
  const opts = { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, cwd: ROOT };
  if (stdin !== undefined) opts.input = stdin;
  return execFileSync('agent-browser', args, opts);
}

function evalJs(js) {
  const raw = ab(['eval', '--stdin'], { stdin: js });
  const text = raw.trim();
  if (!text) return null;
  return JSON.parse(text);
}

function assert(cond, msg, actual) {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.log(`  \u2717 ${msg}`);
    if (actual !== undefined) {
      console.log(`    got: ${JSON.stringify(actual)}`);
    }
  }
}

function section(title) {
  console.log(`\n${title}`);
}

function checkSidecarUp() {
  try {
    execFileSync('curl', ['-sSf', '-m', '3', `${SIDECAR}/health`], { stdio: 'pipe' });
    return true;
  } catch (_) { return false; }
}

function readSidecar() {
  if (!existsSync(ANNOT_FILE)) return { pins: [] };
  return JSON.parse(readFileSync(ANNOT_FILE, 'utf8'));
}

async function main() {
  section('Preflight');
  assert(checkSidecarUp(), 'sidecar responds on :4001');
  if (failed) { summarize(); process.exit(1); }

  ab(['open', PAGE]);
  ab(['wait', '--load', 'networkidle']);
  ab(['wait', '--fn', 'window.__sheetMusic && window.__sheetMusic.ready']);

  section('Reset state');
  evalJs(`
    (async () => {
      localStorage.setItem('sheet-annotator:${PATHNAME}', '[]');
      await fetch('${SIDECAR}/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pathname: '${PATHNAME}', pins: []})
      });
      return 'ok';
    })();
  `);
  ab(['reload']);
  ab(['wait', '--fn', 'window.__sheetMusic && window.__sheetMusic.ready']);
  const initial = evalJs(`document.querySelectorAll('[data-sheet-pin]').length`);
  assert(initial === 0, 'page starts with zero pins', initial);

  section('Scenario A — notehead shift-click');
  const a = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const note = svg.querySelectorAll('.vf-stavenote')[0];
      const r = note.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const t0 = performance.now();
      let pinT = null, sidebarT = null;
      const obs = new MutationObserver(() => {
        if (pinT == null && document.querySelector('[data-sheet-pin]')) pinT = performance.now();
        const sb = document.querySelector('.sheet-annotator-sidebar');
        if (sidebarT == null && sb && !sb.classList.contains('is-collapsed')) sidebarT = performance.now();
      });
      obs.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
      note.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window,
        clientX:cx, clientY:cy, shiftKey:true, button:0}));
      const deadline = performance.now() + 1500;
      while (performance.now() < deadline && (pinT == null || sidebarT == null)) {
        await new Promise(r => setTimeout(r, 20));
      }
      obs.disconnect();
      return JSON.stringify({
        clickToPinMs: pinT == null ? null : +(pinT - t0).toFixed(1),
        clickToSidebarMs: sidebarT == null ? null : +(sidebarT - t0).toFixed(1),
      });
    })();
  `);
  const aTimings = JSON.parse(a);
  assert(aTimings.clickToPinMs != null && aTimings.clickToPinMs < THRESHOLDS.clickToPinMs,
    `click \u2192 pin DOM < ${THRESHOLDS.clickToPinMs}ms (got ${aTimings.clickToPinMs})`, aTimings);
  assert(aTimings.clickToSidebarMs != null && aTimings.clickToSidebarMs < THRESHOLDS.clickToSidebarMs,
    `click \u2192 sidebar open < ${THRESHOLDS.clickToSidebarMs}ms (got ${aTimings.clickToSidebarMs})`, aTimings);

  section('Scenario B — chord symbol shift-click');
  // Static chord symbols are now hidden in the rendered score, so we
  // inject a synthetic .vf-text > text reading 'Cm' inside the SVG just
  // for this click. The classifier doesn't care how the text got there,
  // only that detectChordSymbol matches its content.
  evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const ns = 'http://www.w3.org/2000/svg';
      const wrap = document.createElementNS(ns, 'g');
      wrap.setAttribute('class', 'vf-text');
      wrap.setAttribute('data-test-injected', 'chord-symbol');
      const t = document.createElementNS(ns, 'text');
      const box = svg.getBoundingClientRect();
      const svgRect = svg.viewBox.baseVal;
      const tx = svgRect.x + 80, ty = svgRect.y + 60;
      t.setAttribute('x', tx);
      t.setAttribute('y', ty);
      t.setAttribute('font-size', '16');
      t.textContent = 'Cm';
      wrap.appendChild(t);
      svg.appendChild(wrap);
      const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window,
        clientX: r.left + r.width/2, clientY: r.top + r.height/2, shiftKey:true, button:0}));
      await new Promise(r => setTimeout(r, 400));
      return 'ok';
    })();
  `);

  section('Scenario C — empty-space shift-click');
  evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const box = svg.getBoundingClientRect();
      const x = box.left + 40, y = box.top + 40;
      const hit = document.elementFromPoint(x, y) || document.body;
      hit.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window,
        clientX:x, clientY:y, shiftKey:true, button:0}));
      await new Promise(r => setTimeout(r, 400));
      return 'ok';
    })();
  `);

  section('Verify saved pin kinds');
  const saved = readSidecar();
  assert(saved.pins.length === 3, `sidecar has 3 pins`, saved.pins.length);
  const kinds = saved.pins.map(p => p.identity?.kind);
  assert(kinds[0] === 'notehead', `pin 1 kind = notehead`, kinds[0]);
  assert(saved.pins[0].identity?.pitches?.length > 0, `pin 1 has pitches`, saved.pins[0].identity?.pitches);
  assert(/^[A-G][#b]?\d$/.test(saved.pins[0].identity?.pitches?.[0] || ''),
    `pin 1 pitch is SPN (letter+acc+octave)`, saved.pins[0].identity?.pitches?.[0]);
  assert(kinds[1] === 'chord-symbol', `pin 2 kind = chord-symbol`, kinds[1]);
  assert(saved.pins[1].identity?.chordSymbol === 'Cm', `pin 2 chordSymbol = Cm`, saved.pins[1].identity?.chordSymbol);
  assert(kinds[2] === 'region', `pin 3 kind = region (no phantom notehead)`, kinds[2]);
  assert(!saved.pins[2].identity?.pitches?.length, `pin 3 has no pitches`, saved.pins[2].identity?.pitches);

  section('Thumbnail rasterization');
  for (const p of saved.pins) {
    const size = p.identity?.thumbnail?.length || 0;
    assert(size > 1000, `pin ${p.id} thumbnail > 1KB (got ${size}B)`, size);
  }

  section('Scenario D — keystroke \u2192 sidecar save latency');
  const dEarly = evalJs(`
    (async () => {
      const ta = document.querySelector('.sheet-annotator-entry__note');
      if (!ta) return JSON.stringify({err: 'no textarea'});
      const orig = window.fetch;
      let t0 = null, t1 = null;
      window.fetch = function(...args) {
        if (typeof args[0] === 'string' && args[0].includes('/save')) {
          t0 = performance.now();
          return orig.apply(this, args).then(res => { t1 = performance.now(); return res; });
        }
        return orig.apply(this, args);
      };
      ta.focus();
      ta.value = 'smoothness test ' + Date.now();
      ta.dispatchEvent(new Event('input', {bubbles: true}));
      const deadline = performance.now() + 2000;
      while (performance.now() < deadline && t1 == null) await new Promise(r => setTimeout(r, 20));
      window.fetch = orig;
      return JSON.stringify({saveMs: (t0 != null && t1 != null) ? +(t1 - t0).toFixed(1) : null});
    })();
  `);
  const dTimingEarly = JSON.parse(dEarly);
  assert(dTimingEarly.saveMs != null && dTimingEarly.saveMs < THRESHOLDS.keystrokeToSaveMs,
    `keystroke \u2192 sidecar save < ${THRESHOLDS.keystrokeToSaveMs}ms (got ${dTimingEarly.saveMs})`, dTimingEarly);

  section('Scenario E — reload persistence');
  ab(['reload']);
  ab(['wait', '--fn', 'window.__sheetMusic && window.__sheetMusic.ready']);
  const afterEarly = evalJs(`
    (async () => {
      const deadline = performance.now() + 1000;
      while (performance.now() < deadline && document.querySelectorAll('[data-sheet-pin]').length < 3) {
        await new Promise(r => setTimeout(r, 50));
      }
      return JSON.stringify({
        pinCount: document.querySelectorAll('[data-sheet-pin]').length,
        entryCount: document.querySelectorAll('.sheet-annotator-entry').length,
      });
    })();
  `);
  const afterEarlyObj = JSON.parse(afterEarly);
  assert(afterEarlyObj.pinCount === 3, `3 pins restored on reload`, afterEarlyObj);
  assert(afterEarlyObj.entryCount === 3, `3 sidebar entries restored`, afterEarlyObj);

  section('Scenario F — chord / stacked notes disambiguate by Y');
  evalJs(`
    (async () => {
      localStorage.setItem('sheet-annotator:${PATHNAME}', '[]');
      await fetch('${SIDECAR}/save', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({pathname:'${PATHNAME}', pins: []})
      });
      return 'ok';
    })();
  `);
  ab(['reload']);
  ab(['wait', '--fn', 'window.__sheetMusic && window.__sheetMusic.ready']);
  const chordData = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const chords = [...svg.querySelectorAll('.vf-stavenote')]
        .filter(sn => sn.querySelectorAll('.vf-notehead').length >= 2);
      if (!chords.length) return JSON.stringify({skip: true});
      const c = chords[0];
      const heads = [...c.querySelectorAll('.vf-notehead')];
      for (const h of heads) {
        const b = h.getBoundingClientRect();
        const cx = b.left + b.width/2, cy = b.top + b.height/2;
        h.dispatchEvent(new MouseEvent('click', {
          bubbles:true, cancelable:true, view:window,
          clientX:cx, clientY:cy, shiftKey:true, button:0,
        }));
        await new Promise(r => setTimeout(r, 350));
      }
      const saved = await (await fetch('${SIDECAR}/load?pathname=${PATHNAME}')).json();
      return JSON.stringify({
        expectedCount: heads.length,
        pins: saved.pins.map(p => ({
          id: p.id,
          kind: p.identity?.kind,
          clicked: p.identity?.clickedPitch,
          pitches: p.identity?.pitches,
          chordName: p.identity?.chordName,
          context: p.context,
        })),
      });
    })();
  `);
  const chord = JSON.parse(chordData);
  if (chord.skip) {
    console.log('  (skipped: no chord stacks in score)');
  } else {
    assert(chord.pins.length === chord.expectedCount,
      'one pin per chord note', chord.pins.length);
    const uniqClicked = new Set(chord.pins.map(p => p.clicked));
    assert(uniqClicked.size === chord.expectedCount,
      'clicked pitches are distinct per notehead Y',
      [...uniqClicked]);
    for (const p of chord.pins) {
      assert(/^[A-G][#b]?\d$/.test(p.clicked || ''),
        'pin ' + p.id + ' clickedPitch is SPN', p.clicked);
      assert(p.pitches && p.pitches.includes(p.clicked),
        'pin ' + p.id + ' pitches array contains clicked pitch',
        {clicked: p.clicked, pitches: p.pitches});
      assert((p.context || '').includes(p.clicked || 'xx'),
        'pin ' + p.id + ' context label shows the clicked pitch, not another chord tone',
        {clicked: p.clicked, context: p.context});
      assert(typeof p.chordName === 'string' && p.chordName.length > 0,
        'pin ' + p.id + ' has Tonal-detected chordName for the stack',
        {chordName: p.chordName, pitches: p.pitches});
      assert((p.context || '').includes(p.chordName || 'xx'),
        'pin ' + p.id + ' context label leads with the chord name',
        {chordName: p.chordName, context: p.context});
    }
  }

  section('Scenario G — rests get a rest label');
  const restData = evalJs(`
    (async () => {
      localStorage.setItem('sheet-annotator:${PATHNAME}', '[]');
      await fetch('${SIDECAR}/save', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({pathname:'${PATHNAME}', pins: []})
      });
      const svg = document.querySelector('#osmd-container svg');
      // OSMD wraps rests differently; check both classes and isRest via bridge
      const restEls = [...svg.querySelectorAll('[class*="rest" i]')];
      if (!restEls.length) return JSON.stringify({skip: true, reason: 'no rest elements'});
      const el = restEls[0];
      el.scrollIntoView({block: 'center'});
      await new Promise(r => setTimeout(r, 200));
      const b = el.getBoundingClientRect();
      const cx = b.left + b.width/2, cy = b.top + b.height/2;
      const hit = document.elementFromPoint(cx, cy) || el;
      hit.dispatchEvent(new MouseEvent('click', {
        bubbles:true, cancelable:true, view:window,
        clientX:cx, clientY:cy, shiftKey:true, button:0,
      }));
      await new Promise(r => setTimeout(r, 400));
      const saved = await (await fetch('${SIDECAR}/load?pathname=${PATHNAME}')).json();
      const pin = saved.pins[saved.pins.length - 1];
      return JSON.stringify({
        skip: false,
        context: pin?.context,
        kind: pin?.identity?.kind,
        isRest: pin?.identity?.isRest,
      });
    })();
  `);
  const rest = JSON.parse(restData);
  if (rest.skip) {
    console.log('  (skipped: ' + (rest.reason || 'no rests') + ')');
  } else {
    assert(/rest/i.test(rest.context || ''),
      'rest pin context label says "rest"', rest.context);
    assert(rest.isRest === true,
      'rest pin identity.isRest === true', rest.isRest);
  }

  section('Scenario H — tied notes hover-resolve with isTied + chord context');
  // Find ties via OSMD's source-of-truth (sourceNote.NoteTie) instead of
  // scanning .vf-stavetie SVG elements. VexFlow uses .vf-stavetie for both
  // ties and slurs, so the SVG class isn't a reliable filter — we want the
  // notes that the musicxml actually marks as tied.
  const tieData = evalJs(`
    (async () => {
      localStorage.setItem('sheet-annotator:${PATHNAME}', '[]');
      await fetch('${SIDECAR}/save', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({pathname:'${PATHNAME}', pins: []})
      });
      const svg = document.querySelector('#osmd-container svg');
      const osmd = window.__sheetMusic.osmd;
      const graphic = osmd.GraphicSheet || osmd.graphic;
      const tiedSamples = [];
      for (const page of graphic.MusicPages || [])
        for (const sys of page.MusicSystems || [])
          for (const line of sys.StaffLines || [])
            for (const m of line.Measures || [])
              for (const se of m.staffEntries || [])
                for (const gve of se.graphicalVoiceEntries || [])
                  for (const gn of gve.notes || []) {
                    if (gn.sourceNote && gn.sourceNote.NoteTie) {
                      const vf = Array.isArray(gn.vfnote) ? gn.vfnote[0] : gn.vfnote;
                      const id = vf && vf.attrs && vf.attrs.id;
                      if (id) tiedSamples.push({vfId: id, measure: m.MeasureNumber || m.measureNumber, vfnoteIndex: gn.vfnoteIndex});
                    }
                  }
      if (!tiedSamples.length) return JSON.stringify({skip: true, reason: 'no NoteTie in any source note'});
      const probe = (s) => {
        const sn = svg.querySelector('#vf-' + s.vfId);
        if (!sn) return null;
        const heads = [...sn.querySelectorAll('.vf-notehead')];
        const head = heads[s.vfnoteIndex] || heads[0];
        if (!head) return null;
        const r = head.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        sn.scrollIntoView({block: 'center'});
        const r2 = head.getBoundingClientRect();
        const px = r2.left + r2.width/2 + window.scrollX;
        const py = r2.top + r2.height/2 + window.scrollY;
        const hit = window.__sheetMusic.resolveNoteAt(px, py, 80, head);
        return hit && {
          measure: hit.measureNumber,
          clickedPitch: hit.clickedPitch,
          isTied: hit.isTied,
          chordName: hit.chordName,
          pitches: hit.pitches,
        };
      };
      const checked = [];
      for (const s of tiedSamples.slice(0, 8)) {
        const r = probe(s);
        if (r) checked.push({expected: s, got: r});
        await new Promise(r => setTimeout(r, 50));
      }
      // Also click one to verify identity is persisted with isTied
      const first = tiedSamples[0];
      const sn = svg.querySelector('#vf-' + first.vfId);
      sn.scrollIntoView({block: 'center'});
      await new Promise(r => setTimeout(r, 150));
      const head = sn.querySelectorAll('.vf-notehead')[first.vfnoteIndex] || sn.querySelector('.vf-notehead');
      const r3 = head.getBoundingClientRect();
      head.dispatchEvent(new MouseEvent('click', {
        bubbles:true, cancelable:true, view:window,
        clientX: r3.left + r3.width/2, clientY: r3.top + r3.height/2,
        shiftKey:true, button:0,
      }));
      await new Promise(r => setTimeout(r, 350));
      const saved = await (await fetch('${SIDECAR}/load?pathname=${PATHNAME}')).json();
      const pin = saved.pins[saved.pins.length - 1];
      return JSON.stringify({
        skip: false,
        sampleCount: checked.length,
        checked: checked.slice(0, 4),
        savedPin: pin && {
          isTied: pin.identity?.isTied,
          clickedPitch: pin.identity?.clickedPitch,
          context: pin.context,
        },
      });
    })();
  `);
  const tie = JSON.parse(tieData);
  if (tie.skip) {
    console.log('  (skipped: ' + (tie.reason || 'no ties') + ')');
  } else {
    console.log('  sampled ' + tie.sampleCount + ' tied notes');
    const allTied = tie.checked.every((c) => c.got && c.got.isTied === true);
    assert(allTied, 'every sampled tied source note hover-resolves with isTied=true',
      tie.checked.filter((c) => !c.got || c.got.isTied !== true));
    const allHavePitch = tie.checked.every((c) => c.got && c.got.clickedPitch);
    assert(allHavePitch, 'every sampled tied note has a clickedPitch (not null)',
      tie.checked.filter((c) => !c.got || !c.got.clickedPitch));
    assert(tie.savedPin && tie.savedPin.isTied === true,
      'shift-clicking a tied note saves identity.isTied === true',
      tie.savedPin);
  }

  section('Scenario I — bridge agrees with OSMD source on note vs rest');
  // Regression: previously the bridge used GetNearestNote at click coordinates,
  // which snapped to a nearby rest when the clicked notehead lived in a voice
  // sharing the same x/y range. Now the bridge anchors to the clicked DOM
  // element and walks OSMD's graphical tree to find the matching note. This
  // test asserts the bridge's isRest flag matches the source XML for every
  // stavenote in the score (using the rest glyph's centroid as the click).
  const restRegression = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const stavenotes = [...svg.querySelectorAll('.vf-stavenote')];
      const osmd = window.__sheetMusic.osmd;
      const graphic = osmd.GraphicSheet || osmd.graphic;
      // Build id -> first-source-note map for ground truth.
      const truth = new Map();
      for (const page of graphic.MusicPages || [])
        for (const system of page.MusicSystems || [])
          for (const line of system.StaffLines || [])
            for (const m of line.Measures || [])
              for (const se of m.staffEntries || [])
                for (const gve of se.graphicalVoiceEntries || [])
                  for (const gn of gve.notes || []) {
                    const vf = Array.isArray(gn.vfnote) ? gn.vfnote[0] : gn.vfnote;
                    const id = vf && vf.attrs && vf.attrs.id;
                    if (id && !truth.has(id)) {
                      truth.set(id, gn.sourceNote && gn.sourceNote.isRestFlag === true);
                    }
                  }
      const mismatches = [];
      let sampled = 0;
      const step = Math.max(1, Math.floor(stavenotes.length / 60));
      for (let i = 0; i < stavenotes.length; i += step) {
        const sn = stavenotes[i];
        const head = sn.querySelector('.vf-notehead');
        if (!head) continue;
        const r = head.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const vfId = sn.id.replace(/^vf-/, '');
        if (!truth.has(vfId)) continue;
        const expectedRest = truth.get(vfId);
        const px = r.left + r.width/2 + window.scrollX;
        const py = r.top + r.height/2 + window.scrollY;
        const hit = window.__sheetMusic.resolveNoteAt(px, py, 80, head);
        sampled++;
        if (!hit) {
          mismatches.push({id: sn.id, expectedRest, actual: 'null'});
          continue;
        }
        if (hit.isRest !== expectedRest) {
          mismatches.push({id: sn.id, expectedRest, actualRest: hit.isRest, pitch: hit.clickedPitch});
        }
      }
      return JSON.stringify({sampled, mismatches: mismatches.slice(0, 8)});
    })();
  `);
  const restReg = JSON.parse(restRegression);
  console.log('  sampled ' + restReg.sampled + ' stavenotes against source-XML truth');
  assert(restReg.mismatches.length === 0,
    'bridge isRest matches source for every sampled stavenote',
    restReg.mismatches);

  section('Cleanup');
  evalJs(`
    (async () => {
      localStorage.setItem('sheet-annotator:${PATHNAME}', '[]');
      await fetch('${SIDECAR}/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pathname: '${PATHNAME}', pins: []})
      });
      return 'ok';
    })();
  `);
}

function summarize() {
  console.log(`\n${passed} passed, ${failed} failed`);
}

try {
  await main();
  summarize();
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error('\n[test-smoothness] crashed:', err.message);
  console.error(err.stack);
  summarize();
  process.exit(1);
}
