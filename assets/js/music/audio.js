window.MusicAudio = (function () {
  function ensureContext(holder, key) {
    key = key || "audioCtx";
    if (!holder[key]) {
      holder[key] = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (holder[key].state === "suspended") {
      var resumed = holder[key].resume();
      if (resumed && typeof resumed.catch === "function") {
        resumed.catch(function (err) {
          console.warn("[music-audio] resume failed", err);
        });
      }
    }
    return holder[key];
  }

  function closeContext(holder, key) {
    key = key || "audioCtx";
    var ctx = holder[key];
    if (!ctx) return;
    if (ctx.state !== "closed") {
      ctx.close().catch(function () {});
    }
    holder[key] = null;
  }

  function stopInstrument(instrument) {
    try {
      if (instrument && typeof instrument.stop === "function") instrument.stop();
    } catch (_) {}
  }

  function loadSoundfont(holder, opts) {
    if (holder[opts.instrumentKey]) return Promise.resolve(holder[opts.instrumentKey]);
    if (holder[opts.failedKey]) return Promise.resolve(null);
    if (holder[opts.loadingKey]) return holder[opts.loadingKey];
    if (!window.Soundfont) {
      holder[opts.failedKey] = true;
      return Promise.resolve(null);
    }

    var ctx = ensureContext(holder, opts.contextKey);
    holder[opts.loadingKey] = window.Soundfont.instrument(ctx, opts.name, {
      soundfont: opts.soundfont || "MusyngKite",
    })
      .then(function (instrument) {
        holder[opts.instrumentKey] = instrument;
        holder[opts.loadingKey] = null;
        return instrument;
      })
      .catch(function (err) {
        holder[opts.failedKey] = true;
        holder[opts.loadingKey] = null;
        console.warn("[music-audio] soundfont load failed", err);
        return null;
      });
    return holder[opts.loadingKey];
  }

  return {
    ensureContext: ensureContext,
    closeContext: closeContext,
    stopInstrument: stopInstrument,
    loadSoundfont: loadSoundfont,
  };
})();
