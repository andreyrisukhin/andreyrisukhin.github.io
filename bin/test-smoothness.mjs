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
  evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const cs = [...svg.querySelectorAll('text')].find(t => /^Cm$/.test(t.textContent.trim()));
      const r = cs.getBoundingClientRect();
      cs.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window,
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
  const d = evalJs(`
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
  const dTiming = JSON.parse(d);
  assert(dTiming.saveMs != null && dTiming.saveMs < THRESHOLDS.keystrokeToSaveMs,
    `keystroke \u2192 sidecar save < ${THRESHOLDS.keystrokeToSaveMs}ms (got ${dTiming.saveMs})`, dTiming);

  section('Scenario E — reload persistence');
  ab(['reload']);
  ab(['wait', '--fn', 'window.__sheetMusic && window.__sheetMusic.ready']);
  const after = evalJs(`
    (async () => {
      // Wait up to 1s for hydrate
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
  const afterObj = JSON.parse(after);
  assert(afterObj.pinCount === 3, `3 pins restored on reload`, afterObj);
  assert(afterObj.entryCount === 3, `3 sidebar entries restored`, afterObj);

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
