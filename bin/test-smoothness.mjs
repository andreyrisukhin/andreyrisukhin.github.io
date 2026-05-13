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
      // Dev mode is now opt-in; tests need it on so shift-click and
      // the annotator sidebar wake up.
      localStorage.setItem('sheet-dev-mode', '1');
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

  section('Scenario J — click 1 sticky tag, click 2 escalates to inspector');
  const inspector = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const chord = [...svg.querySelectorAll('.vf-stavenote')]
        .find(sn => sn.querySelectorAll('.vf-notehead').length >= 3);
      if (!chord) return JSON.stringify({skip: true, reason: 'no chord stack'});
      chord.scrollIntoView({block: 'center'});
      await new Promise(r => setTimeout(r, 150));
      const head = chord.querySelector('.vf-notehead');
      const r = head.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const click = (target, x, y) => target.dispatchEvent(new MouseEvent('click', {
        bubbles:true, cancelable:true, view:window,
        clientX:x, clientY:y, button:0,
      }));
      const tag = document.querySelector('.chord-tag');
      const pop = document.querySelector('.chord-inspector');
      tag.classList.remove('is-visible');
      pop.classList.remove('is-visible');
      // ── Click 1: tag becomes sticky, popover stays hidden ─────────
      click(head, cx, cy);
      await new Promise(r => setTimeout(r, 250));
      const stage1 = {
        tagVisible: tag.classList.contains('is-visible'),
        tagSticky: tag.classList.contains('is-sticky'),
        tagText: (tag.querySelector('.chord-tag__chord')?.textContent || '')
                 + (tag.querySelector('.chord-tag__pitch')?.textContent ? ' ' + tag.querySelector('.chord-tag__pitch').textContent : ''),
        popoverVisible: pop.classList.contains('is-visible'),
      };
      // ── Click 2 (on the sticky tag): inspector opens ──────────────
      const tr = tag.getBoundingClientRect();
      click(tag, tr.left + tr.width/2, tr.top + tr.height/2);
      await new Promise(r => setTimeout(r, 250));
      const stage2 = {
        tagVisible: tag.classList.contains('is-visible'),
        popoverVisible: pop.classList.contains('is-visible'),
        title: pop.querySelector('.chord-inspector__title')?.textContent,
        hasStradellaSection: !!pop.querySelector('.chord-inspector__stradella'),
        stradellaItems: pop.querySelectorAll('.stradella-recipe__item').length,
      };
      // ── Click 3 (re-click chord): everything hides ────────────────
      click(head, cx, cy);
      await new Promise(r => setTimeout(r, 250));
      const stage3 = {
        tagVisible: tag.classList.contains('is-visible'),
        popoverVisible: pop.classList.contains('is-visible'),
      };
      return JSON.stringify({stage1, stage2, stage3});
    })();
  `);
  const insp = JSON.parse(inspector);
  if (insp.skip) {
    console.log('  (skipped: ' + insp.reason + ')');
  } else {
    assert(insp.stage1.tagVisible === true,
      'click 1: chord tag becomes visible', insp.stage1);
    assert(insp.stage1.tagSticky === true,
      'click 1: chord tag is marked sticky', insp.stage1);
    assert(insp.stage1.popoverVisible === false,
      'click 1: full inspector stays hidden', insp.stage1);
    assert((insp.stage1.tagText || '').trim().length > 0,
      'click 1: tag shows a chord/pitch label', insp.stage1.tagText);
    assert(insp.stage2.popoverVisible === true,
      'click 2 (on sticky tag): inspector becomes visible', insp.stage2);
    assert(parseFloat(insp.stage2.popoverVisible ? '1' : '0') > 0.5,
      'click 2: inspector visible flag set', insp.stage2);
    assert((insp.stage2.title || '').length > 0,
      'click 2: inspector shows a chord title', insp.stage2.title);
    assert(insp.stage2.hasStradellaSection === true,
      'click 2: inspector has Stradella section', insp.stage2);
    assert(insp.stage2.stradellaItems >= 1,
      'click 2: inspector lists at least one Stradella voicing',
      insp.stage2);
    assert(insp.stage3.popoverVisible === false && insp.stage3.tagVisible === false,
      'click 3 on chord: tag and inspector both hide', insp.stage3);
  }

  section('Scenario K — hover delay surfaces a quiet chord-name tag');
  const hoverProbe = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const chord = [...svg.querySelectorAll('.vf-stavenote')]
        .find(sn => sn.querySelectorAll('.vf-notehead').length >= 3);
      if (!chord) return JSON.stringify({skip: true, reason: 'no chord stack'});
      const head = chord.querySelector('.vf-notehead');
      chord.scrollIntoView({block: 'center'});
      await new Promise(r => setTimeout(r, 150));
      const r = head.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const tag = document.querySelector('.chord-tag');
      tag.classList.remove('is-visible', 'is-sticky');
      // Move cursor onto the chord stack.
      head.dispatchEvent(new MouseEvent('mousemove', {
        bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy,
      }));
      // Tag should NOT be visible immediately (delay is 250 ms).
      const beforeDelay = {
        atT0Ms: tag.classList.contains('is-visible'),
      };
      await new Promise(r => setTimeout(r, 350));
      const afterDelay = {
        visible: tag.classList.contains('is-visible'),
        sticky: tag.classList.contains('is-sticky'),
        text: (tag.querySelector('.chord-tag__chord')?.textContent || '')
              + (tag.querySelector('.chord-tag__pitch')?.textContent ? ' ' + tag.querySelector('.chord-tag__pitch').textContent : ''),
      };
      // Move cursor off the chord (to body) -> tag should fade.
      document.body.dispatchEvent(new MouseEvent('mousemove', {
        bubbles:true, cancelable:true, view:window, clientX:1, clientY:1,
      }));
      await new Promise(r => setTimeout(r, 50));
      const afterLeave = {
        visible: tag.classList.contains('is-visible'),
      };
      return JSON.stringify({beforeDelay, afterDelay, afterLeave});
    })();
  `);
  const hov = JSON.parse(hoverProbe);
  if (hov.skip) {
    console.log('  (skipped: ' + hov.reason + ')');
  } else {
    assert(hov.beforeDelay.atT0Ms === false,
      'hover: tag does NOT appear immediately (delay enforced)', hov.beforeDelay);
    assert(hov.afterDelay.visible === true,
      'hover: tag appears after the 250 ms delay', hov.afterDelay);
    assert(hov.afterDelay.sticky === false,
      'hover: tag is non-sticky (transient)', hov.afterDelay);
    assert((hov.afterDelay.text || '').trim().length > 0,
      'hover: tag shows a chord/pitch label', hov.afterDelay.text);
    assert(hov.afterLeave.visible === false,
      'hover: leaving the stavenote hides the non-sticky tag',
      hov.afterLeave);
  }

  section('Scenario M — hover tag updates as cursor moves between noteheads');
  const moveProbe = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const chord = [...svg.querySelectorAll('.vf-stavenote')]
        .find(sn => sn.querySelectorAll('.vf-notehead').length >= 3);
      if (!chord) return JSON.stringify({skip: true, reason: 'no chord stack'});
      chord.scrollIntoView({block: 'center'});
      await new Promise(r => setTimeout(r, 200));
      const heads = [...chord.querySelectorAll('.vf-notehead')];
      const tag = document.querySelector('.chord-tag');
      tag.classList.remove('is-visible', 'is-sticky');
      const samples = [];
      for (const h of heads) {
        const r = h.getBoundingClientRect();
        h.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true, cancelable: true, view: window,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }));
        await new Promise(r => setTimeout(r, 320));
        samples.push({
          pitch: tag.querySelector('.chord-tag__pitch')?.textContent || null,
          chord: tag.querySelector('.chord-tag__chord')?.textContent || null,
          visible: tag.classList.contains('is-visible'),
        });
      }
      return JSON.stringify({samples});
    })();
  `);
  const mv = JSON.parse(moveProbe);
  if (mv.skip) {
    console.log('  (skipped: ' + mv.reason + ')');
  } else {
    const visibleAll = mv.samples.every(s => s.visible);
    const pitches = mv.samples.map(s => s.pitch).filter(Boolean);
    const distinctPitches = new Set(pitches);
    assert(visibleAll === true,
      'tag stays visible while sweeping noteheads in the same stack',
      mv.samples);
    assert(distinctPitches.size === pitches.length && distinctPitches.size >= 2,
      'tag pitch updates with each notehead under the cursor',
      mv.samples);
  }

  section('Scenario N — Stradella overlay toggles, paints, and dedupes');
  const stradProbe = evalJs(`
    (async () => {
      if (!window.StradellaOverlay) return JSON.stringify({skip: true, reason: 'overlay module not loaded'});
      // Start clean.
      window.StradellaOverlay.setEnabled(false);
      await new Promise(r => setTimeout(r, 100));
      const offCount = document.querySelectorAll('[data-stradella-overlay]').length;
      // Turn on.
      window.StradellaOverlay.setEnabled(true);
      await new Promise(r => setTimeout(r, 250));
      const overlays = [...document.querySelectorAll('[data-stradella-overlay]')];
      // Sample first few labels and verify dedupe within row+chord.
      const labels = overlays.slice(0, 30).map(o => o.title || o.textContent);
      // Verify no two ADJACENT overlays in DOM order share both
      // chord-name and tightly-clustered y position (dedupe working).
      let adjacentDupes = 0;
      for (let i = 1; i < overlays.length; i++) {
        const a = overlays[i-1];
        const b = overlays[i];
        const ay = a.getBoundingClientRect().top;
        const by = b.getBoundingClientRect().top;
        if (a.textContent === b.textContent && Math.abs(ay - by) < 3) adjacentDupes++;
      }
      const btn = document.getElementById('osmd-stradella-toggle');
      // Toggle off again to leave state clean for subsequent runs.
      const wasPressed = btn.classList.contains('is-pressed');
      window.StradellaOverlay.setEnabled(false);
      await new Promise(r => setTimeout(r, 100));
      const offAgainCount = document.querySelectorAll('[data-stradella-overlay]').length;
      return JSON.stringify({
        offCount,
        onCount: overlays.length,
        sampleLabels: labels,
        adjacentDupes,
        toggleHasPressed: wasPressed,
        offAgainCount,
      });
    })();
  `);
  const sp = JSON.parse(stradProbe);
  if (sp.skip) {
    console.log('  (skipped: ' + sp.reason + ')');
  } else {
    assert(sp.offCount === 0,
      'overlay starts off with no painted recipes', sp);
    assert(sp.onCount > 5,
      'enabling the overlay paints multiple recipes across the score',
      { count: sp.onCount });
    assert(sp.toggleHasPressed === true,
      'toggle button gains is-pressed when overlay is on', sp);
    assert(sp.adjacentDupes === 0,
      'consecutive identical chords on the same row are deduped',
      { dupes: sp.adjacentDupes, sample: sp.sampleLabels });
    assert(sp.offAgainCount === 0,
      'turning the overlay off removes every painted recipe',
      { count: sp.offAgainCount });
  }

  section('Scenario O — chord name reflects actual bass when voiced in inversion');
  // Resolves every stack of >=3 noteheads in the score and looks for
  // at least one whose lowest MIDI pitch class differs from the
  // chord's root. Asserts that the bridge surfaces this as
  // "Chord/Bass" notation, and that the rendered Stradella recipe
  // string carries that bass note rather than the root. Catches the
  // class of bug where pitch-class detection threw away inversion
  // information (m2 in Cogwork Dancers showed "GM / G" instead of
  // "GM / B" for a B-D-G voicing).
  const inversionProbe = evalJs(`
    (async () => {
      const svg = document.querySelector('#osmd-container svg');
      const stavenotes = [...svg.querySelectorAll('.vf-stavenote')];
      const findings = [];
      for (const sn of stavenotes) {
        const heads = sn.querySelectorAll('.vf-notehead');
        if (heads.length < 3) continue;
        const head = heads[0];
        const r = head.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const px = r.left + r.width/2 + window.scrollX;
        const py = r.top + r.height/2 + window.scrollY;
        const hit = window.__sheetMusic.resolveNoteAt(px, py, 80, head);
        if (!hit || !hit.chordName) continue;
        if (hit.chordName.indexOf('/') < 0) continue;
        const recipe = window.StradellaRecipe ? window.StradellaRecipe.render(hit.chordName) : '';
        findings.push({
          id: sn.id,
          chordName: hit.chordName,
          pitches: hit.pitches,
          recipeIncludesBass: (function(){
            const bass = hit.chordName.split('/')[1];
            if (!bass) return false;
            const tmp = document.createElement('div');
            tmp.innerHTML = recipe;
            const txt = tmp.textContent || '';
            return txt.indexOf(' / ' + bass) >= 0 || txt.indexOf(' / ' + bass.replace('b','\u266D').replace('#','\u266F')) >= 0;
          })(),
        });
        if (findings.length >= 3) break;
      }
      return JSON.stringify({ findings });
    })();
  `);
  const inv = JSON.parse(inversionProbe);
  assert(inv.findings.length > 0,
    'score contains at least one chord stack voiced in inversion (lowest pitch != root)',
    inv);
  if (inv.findings.length > 0) {
    assert(inv.findings.every((f) => /^[A-G][#b\u266F\u266D]?[^/]*\/[A-G][#b\u266F\u266D]?$/.test(f.chordName)),
      'every inverted chord name has shape "Chord/Bass"', inv.findings);
    assert(inv.findings.every((f) => f.recipeIncludesBass),
      'rendered Stradella recipe shows the actual bass, not the chord root',
      inv.findings);
  }

  // Sub-assertion: m2 of Cogwork Dancers is voiced as B2 (eighth) +
  // G3-B3-D4 chord (oom-pah). The chord stack alone is root-position
  // GM, so naive inversion detection misses it. The bridge has to
  // walk the measure context and promote the lower chord-tone B2 to
  // the bass for the recipe to read "GM / B".
  const m2Probe = evalJs(`
    (() => {
      const stavenotes = [...document.querySelectorAll('#osmd-container svg .vf-stavenote')];
      const m2Chords = [];
      for (const sn of stavenotes) {
        const heads = sn.querySelectorAll('.vf-notehead');
        if (heads.length < 3) continue;
        const head = heads[0];
        const r = head.getBoundingClientRect();
        if (r.width <= 0) continue;
        const px = r.left + r.width/2 + window.scrollX;
        const py = r.top + r.height/2 + window.scrollY;
        const hit = window.__sheetMusic.resolveNoteAt(px, py, 80, head);
        if (!hit || hit.measureNumber !== 2) continue;
        m2Chords.push({ chord: hit.chordName, pitches: hit.pitches });
      }
      return JSON.stringify({ m2Chords });
    })();
  `);
  const m2 = JSON.parse(m2Probe);
  assert(m2.m2Chords.length > 0, 'measure 2 contains at least one chord stack', m2);
  assert(m2.m2Chords.every((c) => c.chord === 'GM/B'),
    'measure 2 oom-pah pattern surfaces as "GM/B" (uses sustained/contextual bass, not stack-root)',
    m2);

  section('Scenario L — dev mode is opt-in and toggle persists');
  const devModeProbe = evalJs(`
    (() => {
      const lsOn = localStorage.getItem('sheet-dev-mode');
      const sidebar = document.querySelector('.sheet-annotator-sidebar');
      const toggle = document.querySelector('[data-sheet-dev-toggle]');
      return JSON.stringify({
        lsOn,
        annotatorMounted: !!sidebar,
        toggleRendered: !!toggle,
        toggleClass: toggle ? toggle.className : null,
      });
    })();
  `);
  const dm = JSON.parse(devModeProbe);
  assert(dm.lsOn === '1',
    'dev mode flag is set in localStorage during tests', dm);
  assert(dm.annotatorMounted === true,
    'annotator sidebar is mounted when dev mode is on', dm);
  assert(dm.toggleRendered === true,
    'dev-mode toggle button is rendered', dm);
  assert(/is-on/.test(dm.toggleClass || ''),
    'dev-mode toggle is in is-on state', dm.toggleClass);

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
