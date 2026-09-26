// A synthesized tone, not a recording of a bayan.
// Context creation only happens after an explicit play action.
window.WorkbenchPlayer = (function () {
  "use strict";
  var active = [];
  var timers = [];
  var generation = 0;
  var muted = false;
  var running = false;
  var onStop = function () {};
  var stopListeners = new Set();

  function stop() {
    generation++;
    running = false;
    timers.forEach(clearTimeout);
    timers = [];
    active.forEach(function (voice) {
      try {
        voice.stop();
      } catch (_) {
        /* already ended */
      }
    });
    active = [];
    onStop();
    stopListeners.forEach(function (listener) {
      listener();
    });
  }

  function note(ctx, midi, time, duration) {
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.035, time + 0.025);
    gain.gain.setValueAtTime(0.035, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(window.Tactus.audio.output("synth"));
    var oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    oscillator.connect(gain);
    active.push(oscillator);
    oscillator.onended = function () {
      oscillator.disconnect();
      gain.disconnect();
      active = active.filter(function (v) {
        return v !== oscillator;
      });
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  async function play(chords, options) {
    stop();
    if (muted || !chords.length) return false;
    options = options || {};
    var ticket = generation;
    try {
      var ctx = await window.Tactus.audio.resume();
      if (ticket !== generation || muted) return false;
      running = true;
      var beat = 60 / (options.bpm || 96);
      var stepDuration = options.progression ? beat * 4 : 1.1;
      var start = ctx.currentTime + 0.04;
      var total = 0;
      chords.forEach(function (chord, index) {
        var when = start + index * stepDuration;
        chord.forEach(function (midi, i) {
          var offset = options.roll ? i * 0.11 : 0;
          note(ctx, midi, when + offset, options.progression ? stepDuration * 0.9 : 0.9);
          total = Math.max(total, index * stepDuration + offset + (options.progression ? stepDuration : 1.1));
        });
        timers.push(
          setTimeout(
            function () {
              if (ticket === generation && options.onStep) options.onStep(index);
            },
            40 + index * stepDuration * 1000
          )
        );
      });
      timers.push(
        setTimeout(
          function () {
            if (ticket !== generation) return;
            if (options.loop) play(chords, options);
            else stop();
          },
          total * 1000 + 60
        )
      );
      return true;
    } catch (_) {
      stop();
      if (options.onError) options.onError("Audio is unavailable. You can still explore the notes and buttons.");
      return false;
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", stop);
  return {
    play: play,
    stop: stop,
    isPlaying: function () {
      return running;
    },
    isMuted: function () {
      return muted;
    },
    mute: function () {
      muted = !muted;
      stop();
      return muted;
    },
    onStop: function (fn) {
      onStop = fn;
    },
    subscribeStop: function (fn) {
      stopListeners.add(fn);
      return function () {
        stopListeners.delete(fn);
      };
    },
  };
})();
