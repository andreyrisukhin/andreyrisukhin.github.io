/* One transport view for every playable sheet, independent of its sound source. */
window.SheetTransport = (function () {
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a.5.5 0 0 0 .76.43l10.4-6.5a.5.5 0 0 0 0-.86L8.76 5.07A.5.5 0 0 0 8 5.5z"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    restart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 6.1v11.8a.5.5 0 0 1-.78.41L9.6 12.41a.5.5 0 0 1 0-.82l8.62-5.9a.5.5 0 0 1 .78.41z"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="10.75" y="5" width="2.5" height="9" rx="1"/><circle cx="12" cy="18" r="1.5"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.75" width="14" height="2.5" rx="1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.75" width="14" height="2.5" rx="1"/><rect x="10.75" y="5" width="2.5" height="14" rx="1"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/></svg>',
  };

  function mount(page, player, key, bridge) {
    const events = new AbortController();
    const on = (target, name, handler, options = {}) => target?.addEventListener(name, handler, { ...options, signal: events.signal });
    const persistent = page.dataset.localFile !== "true";
    const settings = page.querySelector(".practice-settings");
    const $ = (name) => page.querySelector("[data-practice-" + name + "]");
    const storageKey = "sheet-reader:" + location.pathname;
    let saved;
    try {
      saved = persistent ? JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("sheet-practice:" + location.pathname)) : null;
      if (saved?.version === 1) {
        player.setRate(saved.rate);
        player.setInstrument(saved.instrument);
        player.setMode(saved.mode);
        player.setTranspose(saved.transpose);
        player.seek(saved.measure);
        if (saved.loop) player.setLoop(saved.loop.start, saved.loop.end, saved.loop.enabled);
        $("follow").checked = saved.follow !== false;
      }
    } catch (_) {}
    if (!persistent) $("follow").checked = true;
    settings.hidden = false;
    const save = () => {
      if (!persistent) return;
      const { rate, instrument, mode, transpose, measure, loop } = player.snapshot();
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            rate,
            instrument,
            mode,
            transpose,
            measure,
            loop,
            follow: $("follow").checked,
            clickSeek: clickSeek.getAttribute("aria-pressed") === "true",
          })
        );
      } catch (_) {}
    };
    const root = document.createElement("div");
    root.className = "sheet-transport";
    root.setAttribute("data-sheet-playback", "");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Playback");
    root.innerHTML = `
      <button type="button" class="sheet-transport__btn sheet-transport__play" data-pb-action="toggle" aria-label="Play">${ICONS.play}</button>
      <button type="button" class="sheet-transport__btn" data-pb-action="reset" aria-label="Back to start" title="Back to start">${
        ICONS.restart
      }</button>
      <div class="sheet-transport__track" data-pb-seek role="slider" tabindex="0" aria-label="Measure">
        <span class="sheet-transport__line"></span>
        <span class="sheet-transport__band" data-pb-band></span>
        <span class="sheet-transport__ticks" data-pb-ticks></span>
        <span class="sheet-transport__progress" data-pb-progress></span>
      </div>
      <span class="sheet-transport__pos" data-pb-pos aria-hidden="true"></span>
      <button type="button" class="sheet-transport__btn sheet-transport__more" data-pb-more aria-expanded="false" aria-controls="sheet-transport-extras" aria-label="Key and sound" title="Key and sound">${
        ICONS.more
      }</button>
      <div class="sheet-transport__extras" id="sheet-transport-extras">
      ${
        page.dataset.renderedAudioUrl
          ? `<label class="sheet-transport__select"><span>Audio</span><select data-pb-mode title="Audio" aria-label="Audio"><option value="recording"></option><option value="live">Live sound</option></select></label>`
          : ""
      }
      ${
        key
          ? `<div class="sheet-transport__key" role="group" aria-label="Transpose">
        <button type="button" class="sheet-transport__step" data-pb-transpose="-1" aria-label="Transpose down a semitone">${ICONS.minus}</button>
        <button type="button" class="sheet-transport__key-name" data-pb-key-reset><span data-pb-key-name></span><span class="sheet-transport__key-offset" data-pb-key-offset></span></button>
        <button type="button" class="sheet-transport__step" data-pb-transpose="1" aria-label="Transpose up a semitone">${ICONS.plus}</button>
        <span class="sheet-transport__sr" aria-live="polite" data-pb-key-live></span>
      </div>`
          : ""
      }
      <label class="sheet-transport__select" data-pb-instrument-field><span>Sound</span><select data-pb-instrument title="Sound" aria-label="Sound"></select></label>
      </div>
      <p data-practice-status class="practice-help sheet-transport__status" role="status"></p>
    `;
    page.insertBefore(root, settings);
    // Click-to-jump is a reading preference, so it lives with the other
    // practice settings and keeps the transport to one row.
    const clickSeek = document.createElement("button");
    clickSeek.type = "button";
    clickSeek.className = "sheet-transport__toggle";
    clickSeek.setAttribute("data-pb-click-seek", "");
    clickSeek.setAttribute("aria-pressed", "false");
    clickSeek.textContent = "Click score to jump";
    settings.querySelector(".practice-settings-grid").append(clickSeek);
    const measureHeight = () => document.documentElement.style.setProperty("--sheet-transport-height", root.offsetHeight + "px");
    const resize = new ResizeObserver(measureHeight);
    resize.observe(root);
    measureHeight();
    const find = (selector) => root.querySelector(selector);
    const play = find('[data-pb-action="toggle"]');
    const track = find("[data-pb-seek]");
    const band = find("[data-pb-band]");
    const progress = find("[data-pb-progress]");
    const instrument = find("[data-pb-instrument]");
    const mode = find("[data-pb-mode]");
    const instrumentField = find("[data-pb-instrument-field]");
    const more = find("[data-pb-more]");
    const status = $("status");
    if (mode) mode.options[0].textContent = page.dataset.renderedLabel || "Recording";
    window.SheetScore.instruments.forEach(([value, label]) => instrument.add(new Option(label, value)));
    clickSeek.setAttribute("aria-pressed", String(saved?.clickSeek === true));
    settings.querySelectorAll("[disabled]").forEach((control) => {
      control.disabled = false;
    });
    ["start", "end", "measure"].forEach((name) => {
      $(name).max = player.snapshot().count;
    });
    let lastMap, lastMeasure, lastKey, lastState;
    const unsubscribe = player.subscribe((state, message) => {
      if (lastState !== state.state) {
        const loading = state.state === "loading";
        const playing = state.state === "playing";
        play.innerHTML = playing ? ICONS.pause : ICONS.play;
        play.setAttribute("aria-label", loading ? "Cancel loading" : playing ? "Pause" : "Play");
        play.setAttribute("aria-busy", String(loading));
        play.classList.toggle("is-loading", loading);
        root.classList.toggle("is-playing", playing);
        lastState = state.state;
      }
      if (lastMap !== state.starts) {
        const marks = state.starts
          .slice(1)
          .map(
            (sec, index) =>
              `<span class="sheet-transport__tick${(index + 1) % 4 === 0 ? " sheet-transport__tick--phrase" : ""}" style="left:${
                (sec / state.duration) * 100
              }%"></span>`
          );
        marks.push('<span class="sheet-transport__tick sheet-transport__tick--final" style="left:100%"></span>');
        find("[data-pb-ticks]").innerHTML = marks.join("");
        track.setAttribute("aria-valuemin", "1");
        track.setAttribute("aria-valuemax", String(state.count));
        lastMap = state.starts;
        lastMeasure = null;
      }
      if (lastMeasure !== state.measure) {
        const start = state.starts[state.measure - 1] || 0;
        const end = state.starts[state.measure] ?? state.duration;
        band.style.left = (start / state.duration) * 100 + "%";
        band.style.width = ((end - start) / state.duration) * 100 + "%";
        find("[data-pb-pos]").textContent = `m. ${state.measure} of ${state.count}`;
        track.setAttribute("aria-valuenow", String(state.measure));
        track.setAttribute("aria-valuetext", `Measure ${state.measure} of ${state.count}`);
        lastMeasure = state.measure;
      }
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, state.time / state.duration))})`;
      if (mode) mode.value = state.mode;
      instrument.value = state.instrument;
      instrument.disabled = state.mode === "recording";
      instrumentField.hidden = state.mode === "recording";
      $("rate").value = String(state.rate);
      $("loop").checked = state.loop.enabled;
      ["start", "end"].forEach((name) => {
        if (document.activeElement !== $(name)) $(name).value = state.loop[name];
      });
      if (document.activeElement !== $("measure")) $("measure").value = state.measure;
      if (key && lastKey !== state.transpose) {
        const description = window.SheetTranspose.describe(key, state.transpose);
        find("[data-pb-key-name]").textContent = description.name;
        find("[data-pb-key-offset]").textContent = description.offset;
        const reset = find("[data-pb-key-reset]");
        reset.setAttribute("aria-label", `Key: ${description.name}. Back to written key`);
        reset.setAttribute("aria-disabled", String(state.transpose === 0));
        find('[data-pb-transpose="-1"]').setAttribute("aria-disabled", String(state.transpose <= -6));
        find('[data-pb-transpose="1"]').setAttribute("aria-disabled", String(state.transpose >= 6));
        if (lastKey !== undefined) find("[data-pb-key-live]").textContent = description.name + ", " + (description.offset || "as written");
        lastKey = state.transpose;
      }
      if (message) status.textContent = message;
    });
    on(play, "click", () => {
      status.textContent = "";
      player.toggle();
      save();
    });
    on(find('[data-pb-action="reset"]'), "click", () => {
      player.restart();
      save();
    });
    on(instrument, "change", () => {
      player.setInstrument(instrument.value);
      save();
    });
    on(mode, "change", () => {
      player.setMode(mode.value);
      status.textContent = "Sound changed. Press Play when ready.";
      save();
    });
    on(more, "click", () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      root.classList.toggle("is-expanded", open);
    });
    on(clickSeek, "click", () => {
      clickSeek.setAttribute("aria-pressed", String(clickSeek.getAttribute("aria-pressed") !== "true"));
      save();
    });
    root.querySelectorAll("[data-pb-transpose]").forEach((button) =>
      on(button, "click", () => {
        const state = player.snapshot();
        player.setTranspose(state.transpose + Number(button.dataset.pbTranspose));
        if (state.mode === "recording" && player.snapshot().mode === "live") status.textContent = "Transposing uses live sound.";
        save();
      })
    );
    on(find("[data-pb-key-reset]"), "click", () => {
      player.setTranspose(0);
      save();
    });
    const seek = (measure) => {
      player.seek(measure);
      save();
    };
    const measureAt = (x) => {
      const state = player.snapshot();
      const rect = track.getBoundingClientRect();
      const time = Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * state.duration;
      let index = 0;
      while (index + 1 < state.starts.length && state.starts[index + 1] <= time) index++;
      return index + 1;
    };
    let dragging = false;
    on(track, "pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      track.setPointerCapture(event.pointerId);
      seek(measureAt(event.clientX));
    });
    on(track, "pointermove", (event) => {
      if (dragging && measureAt(event.clientX) !== player.snapshot().measure) seek(measureAt(event.clientX));
    });
    ["pointerup", "pointercancel"].forEach((name) =>
      on(track, name, () => {
        dragging = false;
      })
    );
    on(track, "keydown", (event) => {
      const state = player.snapshot();
      const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
      const target = event.key in steps ? state.measure + steps[event.key] : event.key === "Home" ? 1 : event.key === "End" ? state.count : null;
      if (target == null) return;
      event.preventDefault();
      seek(Math.max(1, Math.min(state.count, target)));
    });
    on(
      bridge.container,
      "click",
      (event) => {
        if (clickSeek.getAttribute("aria-pressed") !== "true" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
        const hit = bridge.resolveNoteAt(event.pageX, event.pageY, 180, event.target);
        if (!hit?.measureNumber) return;
        seek(hit.measureNumber);
        event.preventDefault();
        event.stopPropagation();
      },
      { capture: true }
    );
    on($("rate"), "change", () => {
      player.setRate(Number($("rate").value));
      status.textContent = "";
      save();
    });
    on($("follow"), "change", save);
    on(page, "sheet-settings-change", save);
    ["start", "end", "loop"].forEach((name) =>
      on($(name), "change", () => {
        const valid = player.setLoop(Number($("start").value), Number($("end").value), $("loop").checked);
        status.textContent = valid
          ? $("loop").checked
            ? "Loop on, including the end measure."
            : ""
          : "Choose a start and end from 1 to " + player.snapshot().count + ", with the start first.";
        $("loop").checked = player.snapshot().loop.enabled;
        save();
      })
    );
    on($("jump"), "submit", (event) => {
      event.preventDefault();
      if (player.seek(Number($("measure").value))) {
        status.textContent = "Ready at measure " + player.snapshot().measure + ".";
        save();
      }
    });
    return {
      save,
      follow: () => $("follow").checked,
      dispose() {
        events.abort();
        unsubscribe();
        resize.disconnect();
        root.remove();
        clickSeek.remove();
        document.documentElement.style.removeProperty("--sheet-transport-height");
        settings.querySelectorAll("input, select, button").forEach((control) => {
          control.disabled = true;
        });
        if (!persistent) {
          settings.hidden = true;
          settings.open = false;
        }
      },
    };
  }
  return { mount };
})();
