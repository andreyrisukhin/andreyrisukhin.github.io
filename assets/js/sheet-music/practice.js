(function () {
  "use strict";
  const page = document.querySelector(".sheet-practice");
  if (!page) return;
  const $ = (name) => page.querySelector("[data-practice-" + name + "]");
  const transport = page.querySelector(".practice-transport");
  const status = $("status");
  window.__sheetMusic.readyPromise.then(() => {
    try {
      const bridge = window.__sheetMusic;
      const score = window.SheetPracticeTimeline.fromXML(bridge.xml);
      let lastMeasure = 0;
      function cursorAt(measure) {
        if (measure === lastMeasure) return;
        lastMeasure = measure;
        const cursor = bridge.osmd.cursor;
        if (!cursor) return;
        cursor.reset();
        cursor.show();
        if (cursor.cursorElement) cursor.cursorElement.alt = "";
        for (let count = 0; count < 10000 && !cursor.iterator.EndReached; count++) {
          if (cursor.iterator.CurrentMeasureIndex >= measure - 1) break;
          cursor.next();
        }
        if ($("follow").checked && window.SheetPractice?.player.snapshot().state === "playing") {
          const rect = cursor.cursorElement?.getBoundingClientRect();
          const top = transport.getBoundingClientRect().bottom + 24;
          if (rect && (rect.top < top || rect.bottom > window.innerHeight - 32)) {
            cursor.cursorElement.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
      }
      const player = window.SheetPracticePlayer.create(score, {
        audioUrl: page.dataset.renderedAudioUrl,
        timingUrl: page.dataset.timingUrl,
        onCursor: cursorAt,
      });
      window.SheetPractice = { player, score };
      transport.querySelectorAll("[disabled]").forEach((control) => {
        control.disabled = false;
      });
      transport.setAttribute("aria-busy", "false");
      ["start", "end", "measure"].forEach((name) => {
        $(name).max = score.starts.length;
      });
      const storageKey = "sheet-practice:" + location.pathname;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.version === 1) {
          player.setRate(saved.rate);
          player.setMode(saved.mode);
          player.setInstrument(saved.instrument);
          player.seek(saved.measure);
          if (saved.loop) player.setLoop(saved.loop.start, saved.loop.end, saved.loop.enabled);
          $("follow").checked = saved.follow !== false;
        }
      } catch (_) {}
      function save() {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...player.snapshot(), follow: $("follow").checked }));
        } catch (_) {}
      }
      player.subscribe((state, message) => {
        $("play").textContent = state.state === "playing" ? "Pause" : state.state === "loading" ? "Cancel loading" : "Play";
        $("position").textContent = "Measure " + state.measure + " / " + state.count;
        $("rate").value = String(state.rate);
        $("mode").value = state.mode;
        $("instrument").value = state.instrument;
        $("instrument-label").hidden = state.mode !== "live";
        $("loop").checked = state.loop.enabled;
        ["start", "end"].forEach((name) => {
          if (document.activeElement !== $(name)) $(name).value = state.loop[name];
        });
        if (document.activeElement !== $("measure")) $("measure").value = state.measure;
        if (message) status.textContent = message;
      });
      $("play").addEventListener("click", () => {
        status.textContent = "";
        player.toggle();
      });
      $("restart").addEventListener("click", () => {
        player.restart();
        save();
      });
      $("follow").addEventListener("change", save);
      ["rate", "mode", "instrument"].forEach((name) =>
        $(name).addEventListener("change", () => {
          const method = { rate: "setRate", mode: "setMode", instrument: "setInstrument" }[name];
          player[method](name === "rate" ? Number($(name).value) : $(name).value);
          status.textContent = name === "mode" ? "Sound changed. Press Play when ready." : "";
          save();
        })
      );
      ["start", "end", "loop"].forEach((name) =>
        $(name).addEventListener("change", () => {
          const valid = player.setLoop(Number($("start").value), Number($("end").value), $("loop").checked);
          status.textContent = valid
            ? $("loop").checked
              ? "Loop on, including the end measure."
              : ""
            : "Choose a start and end from 1 to " + score.starts.length + ", with the start first.";
          $("loop").checked = player.snapshot().loop.enabled;
          save();
        })
      );
      $("jump").addEventListener("submit", (event) => {
        event.preventDefault();
        if (player.seek(Number($("measure").value))) {
          status.textContent = "Ready at measure " + player.snapshot().measure + ".";
          const cursor = bridge.osmd.cursor?.cursorElement;
          cursor?.scrollIntoView({ block: "center", behavior: "auto" });
          save();
        }
      });
      bridge.container.addEventListener("sheet-render", () => {
        lastMeasure = 0;
        cursorAt(player.snapshot().measure);
      });
      document.addEventListener("keydown", (event) => {
        if (
          event.defaultPrevented ||
          event.code !== "Space" ||
          event.target.closest("button, input, select, textarea, summary, a, dialog, [role=button]")
        )
          return;
        event.preventDefault();
        player.toggle();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          player.pause();
          save();
        }
      });
      window.addEventListener("pagehide", () => {
        save();
        player.dispose();
      });
      status.textContent = "";
      page.dispatchEvent(new CustomEvent("practice-ready"));
    } catch (error) {
      status.textContent = "Playback unavailable: " + error.message;
      transport.setAttribute("aria-busy", "false");
    }
  });
})();
