// Music Exercises — hardcoded practice progressions with playback.
// The right-hand pattern is a single bar (with sub-beat resolution so you can
// place off-beat notes and rests) that repeats across every chord. The LH
// plays the progression as staccato quarter notes. A combined share string
// encodes the progression plus the one-bar RH pattern.
(function () {
  "use strict";

  var M = window.Music;
  var S = window.StradellaData;
  var EXERCISES = window.MusicExercises || [];

  var STORAGE_KEY = "music-exercises";

  var INTERVAL_LABELS = ["1", "♭9", "9", "♭3", "3", "11", "♭5/♯11", "5", "♯5/♭13", "13", "♭7", "7"];

  var ID_TO_SUFFIX = {
    maj: "",
    min: "m",
    m7: "m7",
    maj7: "maj7",
    maj7inv: "maj7",
    7: "7",
    hdim7: "ø7",
    dim7: "°7",
  };

  // ── State ──

  var state = {
    keyDeltas: {},
    openTheory: {},
    // patterns[id] = [rowIdx] => array<bool> of length slotsPerBar (single bar, repeated)
    patterns: {},
    bpms: {},
  };

  var runtime = {
    playingId: null,
    currentSlot: 0,
    timer: null,
    audioCtx: null,
    piano: null,
    pianoLoading: null, // Promise while a load is in flight
    pianoFailed: false,
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s.keyDeltas) state.keyDeltas = s.keyDeltas;
      if (s.openTheory) state.openTheory = s.openTheory;
      if (s.patterns) state.patterns = s.patterns;
      if (s.bpms) state.bpms = s.bpms;
    } catch (e) {
      /* ignore */
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  // ── Helpers ──

  function currentKey(ex) {
    var delta = state.keyDeltas[ex.id];
    if (typeof delta !== "number") delta = 0;
    return (((ex.default_key + delta) % 12) + 12) % 12;
  }

  function intervalFromRoot(note, root) {
    return (((note - root) % 12) + 12) % 12;
  }

  function intervalLabel(semi) {
    return INTERVAL_LABELS[semi] || "?";
  }

  function beatsPerBar(ex) {
    return (ex.playback && ex.playback.beats_per_bar) || 4;
  }

  function subdivsPerBeat(ex) {
    return (ex.playback && ex.playback.subdivisions_per_beat) || 4;
  }

  function slotsPerBar(ex) {
    return beatsPerBar(ex) * subdivsPerBeat(ex);
  }

  function totalSlots(ex) {
    return ex.progression.length * slotsPerBar(ex);
  }

  function currentBpm(ex) {
    if (typeof state.bpms[ex.id] === "number") return state.bpms[ex.id];
    return (ex.playback && ex.playback.bpm) || 96;
  }

  // Convert a YAML default "1010..." row into a bool[].
  function stringRowToBools(s, len) {
    var out = [];
    for (var i = 0; i < len; i++) {
      out.push(s && s.charAt(i) === "1");
    }
    return out;
  }

  function boolsToStringRow(row) {
    return row
      .map(function (b) {
        return b ? "1" : "0";
      })
      .join("");
  }

  function defaultBar(ex) {
    var rows = ex.right_hand.notes.length;
    var cols = slotsPerBar(ex);
    var defaults = (ex.playback && ex.playback.default_bar) || [];
    var out = [];
    for (var r = 0; r < rows; r++) {
      out.push(stringRowToBools(defaults[r] || "", cols));
    }
    return out;
  }

  function currentPattern(ex) {
    var saved = state.patterns[ex.id];
    var rows = ex.right_hand.notes.length;
    var cols = slotsPerBar(ex);
    if (saved && saved.length === rows && saved[0] && saved[0].length === cols) return saved;
    return defaultBar(ex);
  }

  function setSlot(ex, row, slot, val) {
    var p = currentPattern(ex).map(function (r) {
      return r.slice();
    });
    p[row][slot] = val;
    state.patterns[ex.id] = p;
    saveState();
  }

  // ── Share string (progression + RH pattern) ──

  function buildShareString(ex) {
    var key = currentKey(ex);
    var entries = ex.progression.map(function (step) {
      return { id: step.id, key: (step.offset + key) % 12 };
    });
    var chords = M.encodeEntries(key, entries);
    var pat = currentPattern(ex).map(boolsToStringRow).join("|");
    return chords + ";rh=" + pat;
  }

  function parseShareString(ex, str) {
    str = (str || "").trim();
    var rhIdx = str.indexOf(";rh=");
    var chordPart = rhIdx === -1 ? str : str.substring(0, rhIdx);
    var rhPart = rhIdx === -1 ? null : str.substring(rhIdx + 4);

    var validIds = {};
    S.CHORDS.forEach(function (c) {
      validIds[c.id] = true;
    });
    var decoded = M.decodeEntries(chordPart, validIds);
    if (!decoded) return null;

    var pattern = null;
    if (rhPart) {
      var rows = rhPart.split("|");
      if (rows.length === ex.right_hand.notes.length) {
        var cols = slotsPerBar(ex);
        var ok = rows.every(function (r) {
          return r.length === cols && /^[01]+$/.test(r);
        });
        if (ok) {
          pattern = rows.map(function (r) {
            return stringRowToBools(r, cols);
          });
        }
      }
    }
    return { key: decoded.prefix, pattern: pattern };
  }

  // ── Audio ──

  function ensureAudio() {
    if (!runtime.audioCtx) {
      runtime.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (runtime.audioCtx.state === "suspended") runtime.audioCtx.resume();
    return runtime.audioCtx;
  }

  // MIDI helpers: semi is a semitone offset above C3 (MIDI 48).
  function semiToMidi(semiFromC3) {
    return 48 + semiFromC3;
  }

  function semitoneToFreq(semiFromC3) {
    return 440 * Math.pow(2, (semiToMidi(semiFromC3) - 69) / 12);
  }

  // Build an absolute MIDI voicing for the RH notes at the current key:
  // anchor note 0 within ±a-tritone of A4, then place each subsequent note
  // at the smallest non-zero ascending interval from the previous. Result:
  // a close-voiced ascending cluster instead of identical-octave pitches.
  function rhVoicing(ex, key) {
    var base = 69; // A4
    var out = [];
    var prev = null;
    ex.right_hand.notes.forEach(function (n) {
      var abs = (((n + key) % 12) + 12) % 12;
      var m;
      if (prev === null) {
        m = base - (base % 12) + abs;
        while (m < base - 6) m += 12;
        while (m > base + 6) m -= 12;
      } else {
        var delta = (((abs - prev) % 12) + 12) % 12;
        if (delta === 0) delta = 12; // avoid unison stack
        m = prev + delta;
      }
      out.push(m);
      prev = m;
    });
    return out;
  }

  // Lazily fetch the acoustic grand piano soundfont. Resolves to the
  // soundfont-player instrument object, or null if loading fails or the
  // library is unavailable (offline, CDN blocked). Callers fall back to the
  // pure Web Audio synth voice below.
  function loadPiano() {
    if (runtime.piano) return Promise.resolve(runtime.piano);
    if (runtime.pianoFailed) return Promise.resolve(null);
    if (runtime.pianoLoading) return runtime.pianoLoading;
    if (!window.Soundfont) {
      runtime.pianoFailed = true;
      return Promise.resolve(null);
    }
    var ctx = ensureAudio();
    runtime.pianoLoading = window.Soundfont.instrument(ctx, "acoustic_grand_piano", { soundfont: "MusyngKite" })
      .then(function (inst) {
        runtime.piano = inst;
        runtime.pianoLoading = null;
        return inst;
      })
      .catch(function () {
        runtime.pianoFailed = true;
        runtime.pianoLoading = null;
        return null;
      });
    return runtime.pianoLoading;
  }

  // Piano-like voice: four layered oscillators (fundamental + light detune +
  // octave harmonic + fifth-octave harmonic) through a low-pass filter that
  // darkens over time, driven by a percussive ADSR envelope. Fast attack and
  // slow decay with no sustain give a plucked/hammered character instead of
  // the thin square-triangle "pling" of a single oscillator.
  var PIANO_PARTIALS = [
    { type: "triangle", mult: 1, amp: 0.45, detune: -3 },
    { type: "triangle", mult: 1, amp: 0.35, detune: 3 },
    { type: "sine", mult: 2, amp: 0.22, detune: 0 },
    { type: "sine", mult: 3, amp: 0.07, detune: 0 },
  ];

  function playPianoNote(freq, when, duration, gainVal) {
    var ctx = runtime.audioCtx;

    // ADSR master envelope
    var master = ctx.createGain();
    var attack = 0.004;
    var decayTo = gainVal * 0.15; // percussive: falls off quickly
    var release = 0.12;
    master.gain.setValueAtTime(0.0001, when);
    master.gain.exponentialRampToValueAtTime(Math.max(gainVal, 0.0002), when + attack);
    master.gain.exponentialRampToValueAtTime(Math.max(decayTo, 0.0002), when + attack + duration * 0.9);
    master.gain.exponentialRampToValueAtTime(0.0001, when + attack + duration + release);

    // Low-pass filter for warmth, opens slightly at attack then darkens.
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    var bright = Math.min(freq * 8, 5200);
    var dark = Math.max(freq * 2.2, 600);
    filter.Q.value = 0.3;
    filter.frequency.setValueAtTime(bright, when);
    filter.frequency.exponentialRampToValueAtTime(dark, when + duration + release);

    master.connect(filter);
    filter.connect(ctx.destination);

    var stopAt = when + duration + release + 0.05;
    PIANO_PARTIALS.forEach(function (p) {
      var osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.mult;
      if (p.detune) osc.detune.value = p.detune;
      var g = ctx.createGain();
      g.gain.value = p.amp;
      osc.connect(g);
      g.connect(master);
      osc.start(when);
      osc.stop(stopAt);
    });
  }

  // Play one piano note: prefers the sampled grand piano when loaded,
  // otherwise uses the synthesized fallback above. `gainVal` is a low-range
  // peak gain (~0.05–0.15) tuned for the synth; the sampler uses its own
  // scaled multiplier so both voices land at comparable loudness.
  function emitNote(semiFromC3, when, duration, gainVal) {
    if (runtime.piano) {
      try {
        runtime.piano.play(semiToMidi(semiFromC3), when, {
          duration: duration,
          gain: Math.min(4, gainVal * 22),
        });
        return;
      } catch (e) {
        /* fall through to synth */
      }
    }
    playPianoNote(semitoneToFreq(semiFromC3), when, duration, gainVal);
  }

  // Play whatever is scheduled at this absolute slot index:
  // - LH chord staccato on the first slot of each beat
  // - RH notes on any slots flagged on in the 1-bar pattern (indexed mod bar)
  function playSlot(ex, slotIndex) {
    var ctx = ensureAudio();
    var now = ctx.currentTime + 0.01;
    var bpb = beatsPerBar(ex);
    var sub = subdivsPerBeat(ex);
    var slotsBar = slotsPerBar(ex);
    var barIdx = Math.floor(slotIndex / slotsBar);
    var slotInBar = slotIndex % slotsBar;
    var step = ex.progression[barIdx];
    if (!step) return;

    var key = currentKey(ex);
    var root = (step.offset + key) % 12;
    var chord = S.chordById(step.id);
    var suffix = chord ? chord.suffix : ID_TO_SUFFIX[step.id] || "";

    // LH staccato quarter-note duration scales with tempo; RH notes a touch
    // longer so the melody speaks over the chord hits.
    var quarterSec = 60 / currentBpm(ex);
    var lhDur = Math.min(quarterSec * 0.35, 0.18);
    var rhDur = Math.min(quarterSec * 0.5, 0.24);

    // LH: staccato chord on each beat (slotInBar divisible by subdivsPerBeat)
    if (slotInBar % sub === 0) {
      var info = M.chordInfo(root, suffix);
      var accent = slotInBar === 0;
      var lhGain = accent ? 0.09 : 0.065;
      if (info && info.semitones) {
        info.semitones.forEach(function (offset) {
          emitNote(root + offset, now, lhDur, lhGain);
        });
      }
    }

    // RH: active pattern slots, voiced as a close ascending cluster from a
    // fixed register. The first listed pitch anchors near A4; each later
    // pitch is placed at the smallest interval above the previous one, so
    // `[A, C]` speaks as A4→C5 (minor third up) rather than C5→A5 (minor
    // sixth = the inversion). Keeps the melody inside the relative-minor
    // register no matter what key the user transposes to.
    var pattern = currentPattern(ex);
    var rhMidi = rhVoicing(ex, key);
    ex.right_hand.notes.forEach(function (_n, rowIdx) {
      if (!pattern[rowIdx] || !pattern[rowIdx][slotInBar]) return;
      emitNote(rhMidi[rowIdx] - 48, now, rhDur, 0.13);
    });
    // Silence unused var warning
    void bpb;
  }

  function tickIntervalMs(ex) {
    return 60000 / currentBpm(ex) / subdivsPerBeat(ex);
  }

  function startPlayback(exId) {
    var ex = findExercise(exId);
    if (!ex) return;
    if (runtime.playingId) stopPlayback();
    ensureAudio();

    var beginTransport = function () {
      // Bail out if the user hit Stop (or switched cards) while we waited.
      if (runtime.pendingStart !== exId) return;
      runtime.pendingStart = null;
      runtime.playingId = exId;
      runtime.currentSlot = 0;
      updatePlayhead(ex);
      playSlot(ex, 0);
      var total = totalSlots(ex);
      runtime.timer = setInterval(function () {
        runtime.currentSlot = (runtime.currentSlot + 1) % total;
        updatePlayhead(ex);
        playSlot(ex, runtime.currentSlot);
      }, tickIntervalMs(ex));
      setPlayButtonLabel(exId, true);
    };

    // Fire-and-forget piano load. If it's already loaded or has permanently
    // failed we skip the "Loading…" label and start immediately.
    if (runtime.piano || runtime.pianoFailed || !window.Soundfont) {
      runtime.pendingStart = exId;
      beginTransport();
      return;
    }
    runtime.pendingStart = exId;
    setPlayButtonLabel(exId, "loading");
    loadPiano().then(beginTransport);
  }

  function stopPlayback() {
    if (runtime.timer) {
      clearInterval(runtime.timer);
      runtime.timer = null;
    }
    var oldId = runtime.playingId || runtime.pendingStart;
    runtime.playingId = null;
    runtime.pendingStart = null;
    runtime.currentSlot = 0;
    if (oldId) {
      var ex = findExercise(oldId);
      if (ex) updatePlayhead(ex);
      setPlayButtonLabel(oldId, false);
    }
  }

  function setPlayButtonLabel(exId, stateVal) {
    var btn = document.querySelector('.exercises-card[data-ex="' + exId + '"] [data-action="play"]');
    if (!btn) return;
    var playing = stateVal === true;
    var loading = stateVal === "loading";
    btn.innerHTML = loading ? "\u2026 Loading piano" : playing ? "\u25A0 Stop" : "\u25B6 Play";
    btn.classList.toggle("is-playing", playing);
    btn.classList.toggle("is-loading", loading);
    btn.disabled = loading;
  }

  function updatePlayhead(ex) {
    var card = document.querySelector('.exercises-card[data-ex="' + ex.id + '"]');
    if (!card) return;
    var slotsBar = slotsPerBar(ex);
    var slotInBar = runtime.currentSlot % slotsBar;
    var barIdx = Math.floor(runtime.currentSlot / slotsBar);
    var playing = runtime.playingId === ex.id;

    var bars = card.querySelectorAll(".exercises-chord");
    bars.forEach(function (bar, i) {
      bar.classList.toggle("is-current", playing && barIdx === i);
    });

    var slots = card.querySelectorAll(".exercises-slot");
    slots.forEach(function (s) {
      var idx = parseInt(s.getAttribute("data-slot"), 10);
      s.classList.toggle("is-current", playing && idx === slotInBar);
    });

    // Circle-of-fifths highlights: the active chord node plus the arrow
    // that leads INTO it (i.e. the transition from barIdx-1 to barIdx).
    var key = currentKey(ex);
    var activePc = playing && ex.progression[barIdx] ? (((ex.progression[barIdx].offset + key) % 12) + 12) % 12 : null;
    var nodes = card.querySelectorAll(".exercises-circle__node");
    nodes.forEach(function (node) {
      var pc = parseInt(node.getAttribute("data-circle-pc"), 10);
      node.classList.toggle("is-current", activePc !== null && pc === activePc);
    });
    var arrows = card.querySelectorAll(".exercises-circle__arrow");
    arrows.forEach(function (arr) {
      var from = parseInt(arr.getAttribute("data-arrow-bar"), 10);
      arr.classList.toggle("is-current", playing && from === barIdx - 1);
    });

    // Traveling playhead on the circle. When playing, CSS transitions on
    // cx/cy carry it smoothly from the previous chord's position to the
    // current one. When stopped, it fades back to the origin so the user
    // can see "where the loop will start from" before hitting play again.
    var playhead = card.querySelector(".exercises-circle__playhead");
    if (playhead) {
      var targetPc = activePc !== null ? activePc : ex.progression[0] ? (((ex.progression[0].offset + key) % 12) + 12) % 12 : -1;
      if (targetPc >= 0) {
        var pt = circlePoint(targetPc, 150, 150, 110);
        playhead.setAttribute("cx", pt.x.toFixed(1));
        playhead.setAttribute("cy", pt.y.toFixed(1));
      }
      playhead.classList.toggle("is-visible", playing);
    }
  }

  // ── Theory templating ──
  //
  // The YAML theory text uses {{token}} placeholders so that chord names,
  // note names, and key references stay correct when the user transposes.
  // Tokens available:
  //   {{keyName}}, {{minorKeyName}}      — tonic of the major key / its relative minor
  //   {{rh.0}} … {{rh.N}}                — right-hand pedal tone names
  //   {{prog.N.chord|root|roman}}        — per-progression-step values
  //   {{rootsCycle}}, {{rootsList}}      — roots joined by arrows / commas
  //   {{rolesTable}}                     — generated interval-role table HTML

  function buildTheoryContext(ex, key) {
    var prog = ex.progression.map(function (step) {
      var root = (((step.offset + key) % 12) + 12) % 12;
      var chord = S.chordById(step.id);
      var suffix = chord ? chord.suffix : ID_TO_SUFFIX[step.id] || "";
      return {
        root: root,
        rootName: M.noteName(root),
        chord: M.noteName(root) + suffix,
        roman: step.roman,
        rh_effect: step.rh_effect || "",
      };
    });

    var rh = ex.right_hand.notes.map(function (n) {
      var abs = (((n + key) % 12) + 12) % 12;
      return { pc: abs, name: M.noteName(abs) };
    });

    // First-occurrence order, so repeats (e.g. the vi7 resolution) don't
    // produce duplicate names in the "confidently lands …" list.
    var seen = {};
    var uniqueRootNames = [];
    prog.forEach(function (p) {
      if (!seen[p.root]) {
        seen[p.root] = true;
        uniqueRootNames.push(p.rootName);
      }
    });

    var tokens = {
      keyName: M.noteName(((key % 12) + 12) % 12),
      minorKeyName: M.noteName((((key + 9) % 12) + 12) % 12),
      rootsCycle: prog
        .map(function (p) {
          return p.rootName;
        })
        .join(" \u2192 "),
      rootsList: uniqueRootNames.join(", "),
      rolesTable: buildRolesTable(prog, rh),
    };
    prog.forEach(function (p, i) {
      tokens["prog." + i + ".chord"] = p.chord;
      tokens["prog." + i + ".root"] = p.rootName;
      tokens["prog." + i + ".roman"] = p.roman;
      tokens["prog." + i + ".rh_effect"] = p.rh_effect;
    });
    rh.forEach(function (r, i) {
      tokens["rh." + i] = r.name;
      tokens["rh." + i + ".name"] = r.name;
    });
    return tokens;
  }

  function buildRolesTable(prog, rh) {
    var html = '<table class="exercises-rh-table"><thead><tr><th>Chord</th>';
    rh.forEach(function (r) {
      html += "<th>" + M.esc(r.name) + " is\u2026</th>";
    });
    html += "<th>Effect</th></tr></thead><tbody>";
    prog.forEach(function (p) {
      html += "<tr><td>" + M.esc(p.chord) + "</td>";
      rh.forEach(function (r) {
        var iv = (((r.pc - p.root) % 12) + 12) % 12;
        var label = iv === 0 ? "root" : intervalLabel(iv);
        html += "<td>" + M.esc(label) + "</td>";
      });
      html += "<td>" + M.esc(p.rh_effect) + "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function expandTokens(source, tokens) {
    return String(source || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (_, name) {
      return Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : "";
    });
  }

  // ── Circle of fifths ──

  // Clockwise from 12 o'clock, each step is up a perfect fifth. So moving
  // counter-clockwise is "down a fifth" — the natural direction of this
  // cycle-of-fifths progression.
  var CIRCLE_PCS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  function pcToCircleIndex(pc) {
    for (var i = 0; i < CIRCLE_PCS.length; i++) if (CIRCLE_PCS[i] === pc) return i;
    return 0;
  }

  function circlePoint(pc, cx, cy, radius) {
    var idx = pcToCircleIndex(pc);
    var angle = -Math.PI / 2 + idx * ((2 * Math.PI) / 12);
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  // Shrink the endpoints of a segment so the arrowhead lands on the
  // circumference of the target note circle instead of inside it.
  function shrinkSegment(a, b, padStart, padEnd) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { a: a, b: b };
    var ux = dx / len;
    var uy = dy / len;
    return {
      a: { x: a.x + ux * padStart, y: a.y + uy * padStart },
      b: { x: b.x - ux * padEnd, y: b.y - uy * padEnd },
    };
  }

  function renderCircleOfFifths(ex, key) {
    var W = 300;
    var H = 300;
    var cx = W / 2;
    var cy = H / 2;
    var radius = 110;
    var nodeR = 18;

    var progPcs = ex.progression.map(function (step) {
      return (((step.offset + key) % 12) + 12) % 12;
    });
    var progSet = {};
    progPcs.forEach(function (pc) {
      progSet[pc] = true;
    });

    var markerId = "ex-arrow-" + ex.id;

    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="exercises-circle-svg" aria-hidden="true">';
    svg +=
      '<defs><marker id="' +
      markerId +
      '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>';

    // Diatonic-arc shading. The 7 diatonic pcs of the current major key
    // always form a contiguous 180° arc on the circle of fifths (that's
    // why only half the circle lights up, in any key). The arc starts at
    // the IV (subdominant) and sweeps 6 fifth-steps clockwise to the
    // VII (leading tone). Drawn in two 90° segments so the path is
    // unambiguous for browsers (a single exactly-180° arc is ambiguous
    // with the sweep/large-arc flags).
    var IV_pc = (((key + 5) % 12) + 12) % 12;
    var IV_idx = pcToCircleIndex(IV_pc);
    var angAt = function (idx) {
      return -Math.PI / 2 + idx * ((2 * Math.PI) / 12);
    };
    var ptAt = function (idx, r) {
      var a = angAt(idx);
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };
    var arcStart = ptAt(IV_idx, radius);
    var arcMid = ptAt(IV_idx + 3, radius);
    var arcEnd = ptAt(IV_idx + 6, radius);
    svg +=
      '<path class="exercises-circle__diatonic-arc" d="M ' +
      arcStart.x.toFixed(1) +
      " " +
      arcStart.y.toFixed(1) +
      " A " +
      radius +
      " " +
      radius +
      " 0 0 1 " +
      arcMid.x.toFixed(1) +
      " " +
      arcMid.y.toFixed(1) +
      " A " +
      radius +
      " " +
      radius +
      " 0 0 1 " +
      arcEnd.x.toFixed(1) +
      " " +
      arcEnd.y.toFixed(1) +
      '"/>';

    // Tritone diameter: IV and VII are pitch-class 6 semitones apart, which
    // on the circle of fifths is 6 fifth-steps = 180° = a literal diameter.
    // Drawing it makes the vii°–tonic "shortcut" visually honest: it's the
    // line that jumps across the gap in the diatonic arc.
    svg +=
      '<line class="exercises-circle__tritone" x1="' +
      arcStart.x.toFixed(1) +
      '" y1="' +
      arcStart.y.toFixed(1) +
      '" x2="' +
      arcEnd.x.toFixed(1) +
      '" y2="' +
      arcEnd.y.toFixed(1) +
      '"/>';

    // Guide circle behind the note nodes.
    svg +=
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--global-divider-color)" stroke-width="1" opacity="0.5"/>';

    // Transition arrows between consecutive progression steps.
    for (var t = 0; t < progPcs.length - 1; t++) {
      var from = circlePoint(progPcs[t], cx, cy, radius);
      var to = circlePoint(progPcs[t + 1], cx, cy, radius);
      if (progPcs[t] === progPcs[t + 1]) continue; // skip self-loop
      var pad = nodeR + 2;
      var seg = shrinkSegment(from, to, pad, pad);
      var steps = (((pcToCircleIndex(progPcs[t + 1]) - pcToCircleIndex(progPcs[t])) % 12) + 12) % 12;
      var isFifth = steps === 1 || steps === 11;
      var cls = "exercises-circle__arrow" + (isFifth ? "" : " is-wide");
      svg +=
        '<line class="' +
        cls +
        '" data-arrow-bar="' +
        t +
        '" x1="' +
        seg.a.x.toFixed(1) +
        '" y1="' +
        seg.a.y.toFixed(1) +
        '" x2="' +
        seg.b.x.toFixed(1) +
        '" y2="' +
        seg.b.y.toFixed(1) +
        '" marker-end="url(#' +
        markerId +
        ')"/>';
    }

    // Origin is the tonal "home" of the cycle — where progression starts
    // and resolves back to. Marking it makes the visual direction of motion
    // readable at a glance (you see where you came from, where you're going).
    var originPc = progPcs.length ? progPcs[0] : -1;
    var originPt = originPc >= 0 ? circlePoint(originPc, cx, cy, radius) : null;

    // Twelve note nodes.
    for (var i = 0; i < 12; i++) {
      var pc = CIRCLE_PCS[i];
      var pt = circlePoint(pc, cx, cy, radius);
      var active = !!progSet[pc];
      var isOrigin = pc === originPc;
      var cls2 = "exercises-circle__node" + (active ? " is-active" : "") + (isOrigin ? " is-origin" : "");
      svg += '<g class="' + cls2 + '" data-circle-pc="' + pc + '" transform="translate(' + pt.x.toFixed(1) + "," + pt.y.toFixed(1) + ')">';
      if (isOrigin) {
        // Slowly rotating dashed ring marks the home chord.
        svg += '<circle class="exercises-circle__origin-ring" r="' + (nodeR + 6) + '"/>';
      }
      svg += '<circle class="exercises-circle__node-bg" r="' + nodeR + '"/>';
      svg += '<text class="exercises-circle__note-label" text-anchor="middle" dominant-baseline="central">' + M.esc(M.noteName(pc)) + "</text>";
      svg += "</g>";
    }

    // Traveling playhead — a small glowing disk that animates between the
    // active chord nodes during playback. It lives at the end of the SVG
    // so it draws on top of arrows and nodes. Its cx/cy have a CSS
    // transition, so updating them moves it smoothly around the circle.
    if (originPt) {
      svg += '<circle class="exercises-circle__playhead" cx="' + originPt.x.toFixed(1) + '" cy="' + originPt.y.toFixed(1) + '" r="7"/>';
    }

    svg += "</svg>";

    var html = '<div class="exercises-circle">';
    html +=
      '<div class="exercises-circle__legend">Circle of fifths. The <strong>shaded 180° arc</strong> is the diatonic half of the key — every chord root of a major key lives there, which is why only half the circle lights up in any transposition. The ringed node is <strong>home</strong>. Arrows walk counter-clockwise (each a descending 5th); the <strong>dashed diameter</strong> is the tritone between IV and VII — a literal diameter of the circle, and the only "shortcut" the progression takes across the gap. Hit Play to watch the playhead traverse.</div>';
    html += '<div class="exercises-circle__wrap">' + svg + "</div>";
    html += "</div>";
    return html;
  }

  // ── Rendering ──

  function renderProgressionRow(ex) {
    var key = currentKey(ex);
    var html = '<div class="exercises-progression">';
    ex.progression.forEach(function (step, barIdx) {
      var root = (step.offset + key) % 12;
      var chord = S.chordById(step.id);
      var suffix = chord ? chord.suffix : ID_TO_SUFFIX[step.id] || "";
      var displayName = M.noteName(root) + (suffix || "");
      var recipe = chord ? S.renderRecipe(chord, root, true) : "\u2014";

      var rhLabels = ex.right_hand.notes
        .map(function (n) {
          var abs = (n + key) % 12;
          var iv = intervalFromRoot(abs, root);
          return M.noteName(abs) + "=" + intervalLabel(iv);
        })
        .join("  \u00B7  ");

      html += '<div class="exercises-chord" data-bar="' + barIdx + '">';
      html += '<div class="exercises-chord__roman">' + M.esc(step.roman) + "</div>";
      html += '<div class="exercises-chord__name">' + M.esc(displayName) + "</div>";
      html += '<div class="exercises-chord__recipe">' + M.esc(recipe) + "</div>";
      html += '<div class="exercises-chord__rh">' + M.esc(rhLabels) + "</div>";
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  // Quarter-note rest glyph at beat starts where the slot is empty.
  var REST_GLYPH = "\uD834\uDD3D"; // 𝄽 U+1D13D QUARTER REST

  function renderSheet(ex) {
    var pattern = currentPattern(ex);
    var bpb = beatsPerBar(ex);
    var sub = subdivsPerBeat(ex);
    var cols = bpb * sub;
    var key = currentKey(ex);

    var html = '<div class="exercises-sheet">';
    html +=
      '<div class="exercises-sheet__legend">One bar of right-hand rhythm, repeated under every chord. Click a slot to toggle between note and rest — use the off-beats (e, &amp;, a) for syncopation.</div>';

    // Beat-number strip above the staves
    html += '<div class="exercises-sheet__row exercises-sheet__row--head">';
    html += '<div class="exercises-sheet__label exercises-sheet__label--head"></div>';
    html += '<div class="exercises-sheet__staff exercises-sheet__staff--head" style="--slots: ' + cols + ';">';
    for (var i = 0; i < cols; i++) {
      var inBeat = i % sub;
      var beatNum = Math.floor(i / sub) + 1;
      var label = inBeat === 0 ? String(beatNum) : inBeat === sub / 2 ? "&amp;" : inBeat === 1 ? "e" : "a";
      var beatCls = "exercises-sheet__beatlabel" + (inBeat === 0 ? " is-beat" : "");
      html += '<span class="' + beatCls + '" style="--slot: ' + i + ';">' + label + "</span>";
    }
    html += "</div></div>";

    // One staff-line row per RH note
    ex.right_hand.notes.forEach(function (n, rowIdx) {
      var abs = (n + key) % 12;
      var noteName = M.noteName(abs);
      var row = pattern[rowIdx] || [];
      html += '<div class="exercises-sheet__row" data-row="' + rowIdx + '">';
      html += '<div class="exercises-sheet__label">' + M.esc(noteName) + "</div>";
      html += '<div class="exercises-sheet__staff" style="--slots: ' + cols + "; --subdivs: " + sub + ';">';
      html += '<div class="exercises-sheet__line"></div>';
      // Beat separators (internal only — skip the leading edge)
      for (var b = 1; b < bpb; b++) {
        html += '<div class="exercises-sheet__beatsep" style="--slot: ' + b * sub + ';"></div>';
      }
      // Slot buttons (notes or rests)
      for (var c = 0; c < cols; c++) {
        var on = !!row[c];
        var inBeat = c % sub;
        var isBeatStart = inBeat === 0;
        var cls = "exercises-slot";
        if (on) cls += " is-on";
        if (isBeatStart) cls += " is-beatstart";
        var label = on ? "\u25CF" : isBeatStart ? REST_GLYPH : "";
        var aria = on ? "Note on slot " + (c + 1) + ", click for rest" : "Rest on slot " + (c + 1) + ", click for note";
        html +=
          '<button type="button" class="' +
          cls +
          '" data-row="' +
          rowIdx +
          '" data-slot="' +
          c +
          '" style="--slot: ' +
          c +
          ';" aria-label="' +
          aria +
          '">' +
          label +
          "</button>";
      }
      html += "</div></div>";
    });

    html += "</div>";
    return html;
  }

  function renderTransport(ex) {
    var bpm = currentBpm(ex);
    var html = '<div class="exercises-transport">';
    html += '<button class="music-share-btn exercises-play" data-action="play">\u25B6 Play</button>';
    html += '<label class="exercises-bpm-label">BPM';
    html += '<input type="range" class="exercises-bpm-slider" data-action="bpm-range" min="40" max="200" value="' + bpm + '">';
    html += '<input type="number" class="exercises-bpm-number" data-action="bpm-num" min="40" max="200" value="' + bpm + '">';
    html += "</label>";
    html += '<button class="music-share-btn" data-action="pattern-clear">All rests</button>';
    html += '<button class="music-share-btn" data-action="pattern-reset">Reset</button>';
    html += "</div>";
    return html;
  }

  function renderRhPills(ex) {
    var key = currentKey(ex);
    var tokens = buildTheoryContext(ex, key);
    var html = '<div class="exercises-rh-pills">';
    html += '<span class="exercises-rh-pills__label">Right hand:</span>';
    ex.right_hand.notes.forEach(function (n) {
      var abs = (n + key) % 12;
      html += '<span class="exercises-rh-pill">' + M.esc(M.noteName(abs)) + "</span>";
    });
    html += "</div>";
    var desc = expandTokens(ex.right_hand.description, tokens);
    html += '<p class="exercises-rh-desc">' + M.esc(desc) + "</p>";
    return html;
  }

  function renderKeyBar(ex) {
    var key = currentKey(ex);
    var html = '<div class="music-key-bar exercises-key-bar" data-ex="' + M.esc(ex.id) + '">';
    M.NOTES.forEach(function (n, i) {
      var cls = "music-key-btn";
      if (i === key) cls += " is-active";
      html += '<button class="' + cls + '" data-key="' + i + '">' + M.esc(n) + "</button>";
    });
    html += "</div>";
    return html;
  }

  function renderTheory(ex) {
    var key = currentKey(ex);
    var tokens = buildTheoryContext(ex, key);
    var open = !!state.openTheory[ex.id];
    var shortText = expandTokens(ex.theory.short, tokens);
    var longHtml = expandTokens(ex.theory.long_html, tokens);
    var html = '<details class="exercises-theory"' + (open ? " open" : "") + ' data-ex="' + M.esc(ex.id) + '">';
    html += "<summary><strong>Theory</strong> \u2014 " + M.esc(shortText) + "</summary>";
    html += '<div class="exercises-theory__body">' + longHtml + "</div>";
    html += "</details>";
    return html;
  }

  function renderAttribution(ex) {
    if (!ex.attribution) return "";
    var a = ex.attribution;
    var html = '<p class="exercises-attribution">From ';
    if (a.url) {
      html += '<a href="' + M.esc(a.url) + '" target="_blank" rel="noopener">' + M.esc(a.name) + "</a>";
    } else {
      html += M.esc(a.name);
    }
    if (a.note) html += ". " + M.esc(a.note);
    html += "</p>";
    return html;
  }

  function renderShareRow(ex) {
    var share = buildShareString(ex);
    var stradellaUrl = "/music/stradella/#load=" + encodeURIComponent(share);
    var html = '<div class="music-share exercises-share">';
    html += "<label>Share:</label>";
    html += '<input type="text" class="music-share-text" data-share-input value="' + M.esc(share) + '" spellcheck="false">';
    html += '<button class="music-share-btn" data-action="share-copy">Copy</button>';
    html += '<button class="music-share-btn" data-action="share-load">Load</button>';
    html += '<a class="music-share-btn" data-action="open-stradella" href="' + M.esc(stradellaUrl) + '">Open in Stradella</a>';
    html += "</div>";
    return html;
  }

  function renderExercise(ex) {
    var html = '<section class="exercises-card" data-ex="' + M.esc(ex.id) + '">';
    html += '<header class="exercises-card__header">';
    html += '<h2 class="exercises-card__title">' + M.esc(ex.title) + "</h2>";
    html += renderAttribution(ex);
    html += "</header>";
    html += renderKeyBar(ex);
    html += renderProgressionRow(ex);
    html += renderCircleOfFifths(ex, currentKey(ex));
    html += renderRhPills(ex);
    html += renderSheet(ex);
    html += renderTransport(ex);
    html += renderShareRow(ex);
    html += renderTheory(ex);
    html += "</section>";
    return html;
  }

  function renderAll() {
    var root = document.getElementById("exercises-root");
    if (!root) return;
    if (!EXERCISES.length) {
      root.innerHTML = "<p><em>No exercises yet.</em></p>";
      return;
    }
    root.innerHTML = EXERCISES.map(renderExercise).join("");
  }

  function rerenderCard(ex) {
    var card = document.querySelector('.exercises-card[data-ex="' + ex.id + '"]');
    if (!card) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = renderExercise(ex);
    card.replaceWith(tmp.firstChild);
  }

  // Update only the share textbox (cheaper than full re-render after a slot toggle)
  function refreshShareInput(ex) {
    var input = document.querySelector('.exercises-card[data-ex="' + ex.id + '"] [data-share-input]');
    if (input) input.value = buildShareString(ex);
    var link = document.querySelector('.exercises-card[data-ex="' + ex.id + '"] [data-action="open-stradella"]');
    if (link) link.href = "/music/stradella/#load=" + encodeURIComponent(buildShareString(ex));
  }

  function findExercise(id) {
    for (var i = 0; i < EXERCISES.length; i++) {
      if (EXERCISES[i].id === id) return EXERCISES[i];
    }
    return null;
  }

  // ── Events ──

  function init() {
    loadState();
    renderAll();

    var root = document.getElementById("exercises-root");
    if (!root) return;

    root.addEventListener("click", function (e) {
      // Key bar
      var keyBtn = e.target.closest(".exercises-key-bar .music-key-btn");
      if (keyBtn) {
        var bar = keyBtn.closest(".exercises-key-bar");
        var exId = bar.getAttribute("data-ex");
        var ex = findExercise(exId);
        if (!ex) return;
        if (runtime.playingId === exId) stopPlayback();
        var newKey = parseInt(keyBtn.getAttribute("data-key"), 10);
        state.keyDeltas[exId] = (((newKey - ex.default_key) % 12) + 12) % 12;
        saveState();
        rerenderCard(ex);
        return;
      }

      // Slot toggle
      var slot = e.target.closest(".exercises-slot");
      if (slot) {
        var card = slot.closest(".exercises-card");
        var ex2 = findExercise(card.getAttribute("data-ex"));
        if (!ex2) return;
        var row = parseInt(slot.getAttribute("data-row"), 10);
        var idx = parseInt(slot.getAttribute("data-slot"), 10);
        var on = !slot.classList.contains("is-on");
        setSlot(ex2, row, idx, on);
        slot.classList.toggle("is-on", on);
        // Update glyph
        var isBeatStart = idx % subdivsPerBeat(ex2) === 0;
        slot.innerHTML = on ? "\u25CF" : isBeatStart ? REST_GLYPH : "";
        refreshShareInput(ex2);
        return;
      }

      // Play / Stop
      var playBtn = e.target.closest('[data-action="play"]');
      if (playBtn) {
        var card2 = playBtn.closest(".exercises-card");
        var exId3 = card2.getAttribute("data-ex");
        if (runtime.playingId === exId3 || runtime.pendingStart === exId3) stopPlayback();
        else startPlayback(exId3);
        return;
      }

      // Clear to all rests
      var clearBtn = e.target.closest('[data-action="pattern-clear"]');
      if (clearBtn) {
        var ex4 = findExercise(clearBtn.closest(".exercises-card").getAttribute("data-ex"));
        if (!ex4) return;
        var rows = ex4.right_hand.notes.length;
        var cols = slotsPerBar(ex4);
        var empty = [];
        for (var r = 0; r < rows; r++) {
          var rr = [];
          for (var c = 0; c < cols; c++) rr.push(false);
          empty.push(rr);
        }
        state.patterns[ex4.id] = empty;
        saveState();
        rerenderCard(ex4);
        return;
      }

      // Reset to YAML default
      var resetBtn = e.target.closest('[data-action="pattern-reset"]');
      if (resetBtn) {
        var ex5 = findExercise(resetBtn.closest(".exercises-card").getAttribute("data-ex"));
        if (!ex5) return;
        delete state.patterns[ex5.id];
        saveState();
        rerenderCard(ex5);
        return;
      }

      // Share: copy
      var copyBtn = e.target.closest('[data-action="share-copy"]');
      if (copyBtn) {
        var input = copyBtn.closest(".exercises-card").querySelector("[data-share-input]");
        if (!input) return;
        input.select();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(input.value).then(function () {
            copyBtn.textContent = "Copied!";
            setTimeout(function () {
              copyBtn.textContent = "Copy";
            }, 1500);
          });
        }
        return;
      }

      // Share: load
      var loadBtn = e.target.closest('[data-action="share-load"]');
      if (loadBtn) {
        var card3 = loadBtn.closest(".exercises-card");
        var ex6 = findExercise(card3.getAttribute("data-ex"));
        var input2 = card3.querySelector("[data-share-input]");
        if (!ex6 || !input2) return;
        var parsed = parseShareString(ex6, input2.value);
        if (!parsed) {
          loadBtn.textContent = "Invalid";
          setTimeout(function () {
            loadBtn.textContent = "Load";
          }, 1500);
          return;
        }
        if (runtime.playingId === ex6.id) stopPlayback();
        state.keyDeltas[ex6.id] = (((parsed.key - ex6.default_key) % 12) + 12) % 12;
        if (parsed.pattern) state.patterns[ex6.id] = parsed.pattern;
        saveState();
        rerenderCard(ex6);
        var newLoad = document.querySelector('.exercises-card[data-ex="' + ex6.id + '"] [data-action="share-load"]');
        if (newLoad) {
          newLoad.textContent = "Loaded!";
          setTimeout(function () {
            newLoad.textContent = "Load";
          }, 1500);
        }
        return;
      }
    });

    // BPM inputs (live update)
    root.addEventListener("input", function (e) {
      var el = e.target;
      var action = el.getAttribute && el.getAttribute("data-action");
      if (action !== "bpm-range" && action !== "bpm-num") return;
      var card = el.closest(".exercises-card");
      if (!card) return;
      var ex = findExercise(card.getAttribute("data-ex"));
      if (!ex) return;
      var val = parseInt(el.value, 10);
      if (isNaN(val)) return;
      val = Math.max(40, Math.min(200, val));
      state.bpms[ex.id] = val;
      saveState();
      var other = card.querySelector(action === "bpm-range" ? '[data-action="bpm-num"]' : '[data-action="bpm-range"]');
      if (other) other.value = val;
      if (runtime.playingId === ex.id && runtime.timer) {
        clearInterval(runtime.timer);
        var total = totalSlots(ex);
        runtime.timer = setInterval(function () {
          runtime.currentSlot = (runtime.currentSlot + 1) % total;
          updatePlayhead(ex);
          playSlot(ex, runtime.currentSlot);
        }, tickIntervalMs(ex));
      }
    });

    root.addEventListener(
      "toggle",
      function (e) {
        var details = e.target;
        if (!details.classList || !details.classList.contains("exercises-theory")) return;
        var exId = details.getAttribute("data-ex");
        if (!exId) return;
        state.openTheory[exId] = details.open;
        saveState();
      },
      true
    );

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && runtime.playingId) stopPlayback();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
