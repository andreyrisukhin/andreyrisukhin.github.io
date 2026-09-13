// Shared vertical B-system geometry and DOM rendering. No audio or music-model state.
window.BayanKeyboard = (function () {
  "use strict";
  var NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

  function escape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function label(midi) {
    return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }
  function position(midi) {
    return { column: midi % 3, row: Math.floor(midi / 3) };
  }
  function layout(low, high) {
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 127 || high < low) throw new Error("Invalid MIDI range.");
    var cells = [];
    // Align the window to the instrument, never the instrument to the window.
    for (var midi = Math.floor(low / 3) * 3; midi <= Math.min(127, Math.ceil((high + 1) / 3) * 3 - 1); midi++) {
      var p = position(midi);
      cells.push({ midi: midi, column: p.column, row: p.row, outside: midi < low || midi > high });
    }
    return cells;
  }
  function html(options) {
    var cells = layout(options.low, options.high);
    var selected = options.selected || [];
    var names = options.labels || {};
    var shortcuts = options.shortcuts || {};
    var action = options.action || "Hear";
    var html =
      '<div class="bayan-keyboard" role="group" aria-label="' + escape(options.label || "Vertical B-system keyboard, higher notes at the top") + '">';
    for (var column = 0; column < 3; column++) {
      html += '<div class="bayan-keyboard-column" style="--bayan-column:' + column + '">';
      cells
        .filter(function (cell) {
          return cell.column === column;
        })
        .reverse()
        .forEach(function (cell) {
          var midi = cell.midi;
          var disabled = cell.outside || midi < (options.playableLow ?? options.low) || midi > (options.playableHigh ?? options.high);
          var name = names[midi] || label(midi);
          html +=
            '<button type="button" class="bayan-key' +
            (selected.indexOf(midi) >= 0 ? " is-selected" : "") +
            (midi === options.root ? " is-root" : "") +
            '" data-midi="' +
            midi +
            '" data-pc="' +
            (midi % 12) +
            '" aria-label="' +
            escape(action + " " + name) +
            '"' +
            (options.toggle ? ' aria-pressed="' + (selected.indexOf(midi) >= 0) + '"' : "") +
            (midi === options.root ? ' aria-description="Root note"' : "") +
            (disabled ? " disabled" : "") +
            "><span>" +
            escape(name) +
            "</span>" +
            (shortcuts[midi] ? "<kbd>" + escape(shortcuts[midi]) + "</kbd>" : "") +
            "</button>";
        });
      html += "</div>";
    }
    return html + "</div>";
  }
  function mount(container, options) {
    container.innerHTML = html(options);
  }
  function update(container, options) {
    container.querySelectorAll(".bayan-key").forEach(function (button) {
      var midi = Number(button.dataset.midi);
      var selected = (options.selected || []).indexOf(midi) >= 0;
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-root", midi === options.root);
      if (midi === options.root) button.setAttribute("aria-description", "Root note");
      else button.removeAttribute("aria-description");
      if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(selected));
    });
  }
  function bind(container, handlers) {
    function click(event) {
      var button = event.target.closest(".bayan-key");
      if (button && container.contains(button) && !button.disabled && handlers.onActivate) handlers.onActivate(Number(button.dataset.midi));
    }
    function keydown(event) {
      var button = event.target.closest(".bayan-key");
      if (!button) return;
      var delta = { ArrowUp: 3, ArrowDown: -3, ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      var target = container.querySelector('.bayan-key[data-midi="' + (Number(button.dataset.midi) + delta) + '"]:not(:disabled)');
      if (target) target.focus();
    }
    container.addEventListener("click", click);
    container.addEventListener("keydown", keydown);
    return function () {
      container.removeEventListener("click", click);
      container.removeEventListener("keydown", keydown);
    };
  }
  return { position: position, layout: layout, html: html, mount: mount, update: update, bind: bind, label: label };
})();
