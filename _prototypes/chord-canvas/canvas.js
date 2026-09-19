(function () {
  "use strict";
  var $ = function (id) {
    return document.getElementById(id);
  };
  var F = window.ChordFractions,
    board = window.ChordCanvasBoard.create();
  var canvas = $("canvas"),
    world = $("world"),
    tiles = $("tiles"),
    editor = $("editor"),
    input = $("chord-input");
  var zoom = 1,
    pan = { x: 0, y: 0 },
    draft = null,
    selected = null,
    gesture = null,
    space = false;
  var lastPoint = { x: innerWidth / 2, y: innerHeight / 2 };
  var zero = F.make(0, 1),
    one = F.make(1, 1);
  function announce(text) {
    $("status").textContent = text;
  }
  function node(id) {
    return tiles.querySelector('[data-id="' + id + '"]');
  }
  function geometry(cell) {
    var start = F.number(cell.start || zero),
      duration = F.number(cell.duration || one);
    var span = 144 * zoom * duration,
      gap = Math.min(8, span * 0.1);
    return { x: cell.x * 160 * zoom - 72 * zoom + (start + duration / 2) * 144 * zoom, y: cell.y * 120, width: Math.max(0.01, span - gap) };
  }
  function place(el, cell, fixedWidth) {
    var g = geometry(cell);
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";
    el.style.width = (fixedWidth || g.width) + "px";
    el.classList.toggle("compact", !fixedWidth && g.width < 100);
    el.classList.toggle("tiny", !fixedWidth && g.width < 52);
  }
  function view() {
    world.style.transform = "translate(" + pan.x + "px," + pan.y + "px)";
  }
  function point(x, y) {
    var rect = world.getBoundingClientRect(),
      local = x - rect.left;
    var column = Math.round(local / (160 * zoom));
    return {
      x: column,
      y: Math.round((y - rect.top) / 120),
      fraction: Math.max(0, Math.min(1, (local - column * 160 * zoom + 72 * zoom) / (144 * zoom))),
    };
  }
  function reveal(cell) {
    var g = geometry(cell),
      x = innerWidth / 2 + pan.x + g.x,
      y = innerHeight / 2 + pan.y + g.y;
    var height = window.visualViewport ? window.visualViewport.height : innerHeight;
    var side = Math.min(innerWidth / 2, Math.max($("error").hidden ? 88 : 112, draft ? 88 : g.width / 2 + 12)),
      bottom = $("error").hidden ? 130 : 180;
    pan.x += Math.max(side - x, 0) + Math.min(innerWidth - side - x, 0);
    pan.y += Math.max(100 - y, 0) + Math.min(height - bottom - y, 0);
    view();
  }
  function durationLabel(cell) {
    var meter = board.meter,
      units = F.mul(cell.duration, F.make(meter.numerator, 1));
    return meter.denominator === 4
      ? F.text(units) + " beats"
      : F.text(units) + " " + { 2: "half", 8: "eighth", 16: "sixteenth" }[meter.denominator] + "-notes";
  }
  function panels() {
    var cell = board.get(selected);
    $("selection").hidden = !cell || !!draft || !!gesture;
    if (cell) {
      $("selection-label").textContent = (cell.name || "Empty span") + " · " + F.text(cell.duration) + " measure · " + durationLabel(cell);
      $("edit").textContent = cell.name ? "Edit" : "Type chord";
      $("remove").disabled = cell.name === null;
      $("clear-measure").hidden = board.all().some(function (c) {
        return c.x === cell.x && c.y === cell.y && c.name !== null;
      });
    }
    $("undo").disabled = !board.canUndo;
    $("redo").disabled = !board.canRedo;
    $("tools").hidden = !board.all().length && !board.canRedo;
    $("zoom-fit").textContent = zoom + "×";
    $("zoom-out").disabled = zoom <= 1;
    $("zoom-in").disabled = zoom >= 64;
    $("meter-top").value = board.meter.numerator;
    $("meter-bottom").value = board.meter.denominator;
  }
  function render(overrides) {
    var all = board.all().map(function (cell) {
      return Object.assign(cell, overrides && overrides.get(cell.id));
    });
    var ids = new Set(
      all.map(function (cell) {
        return String(cell.id);
      })
    );
    Array.from(tiles.children).forEach(function (el) {
      if (!ids.has(el.dataset.id)) el.remove();
    });
    all.forEach(function (cell) {
      var el = node(cell.id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "cell tile";
        el.dataset.id = cell.id;
        var name = document.createElement("span");
        name.className = "chord-name";
        el.appendChild(name);
        tiles.appendChild(el);
      }
      var text = cell.name || "+";
      if (el.firstChild.textContent !== text) el.firstChild.textContent = text;
      el.dataset.duration = F.text(cell.duration);
      el.dataset.start = F.text(cell.start);
      el.dataset.measure = cell.x + "," + cell.y;
      el.dataset.label = durationLabel(cell);
      el.setAttribute(
        "aria-label",
        (cell.name || "Empty span") +
          ", " +
          F.text(cell.duration) +
          " measure, " +
          durationLabel(cell) +
          ", column " +
          cell.x +
          ", row " +
          cell.y +
          ". Enter to edit."
      );
      el.title = el.getAttribute("aria-label");
      el.classList.toggle("empty", cell.name === null);
      el.classList.toggle("selected", cell.id === selected);
      el.classList.toggle("long-name", !!cell.name && cell.name.length > 8);
      el.hidden = !!draft && draft.id === cell.id;
      el.style.setProperty("--fill", cell.fill || "#f5f2ec");
      place(el, cell);
    });
    renderDividers(all);
    panels();
  }
  function renderDividers(all) {
    var valid = new Set();
    all.forEach(function (right, i) {
      var left = all[i - 1];
      if (!left || left.x !== right.x || left.y !== right.y) return;
      var key = left.id + "-" + right.id;
      valid.add(key);
      var el = $("dividers").querySelector('[data-key="' + key + '"]');
      if (!el) {
        el = document.createElement("div");
        el.className = "divider";
        el.dataset.key = key;
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-orientation", "horizontal");
        $("dividers").appendChild(el);
      }
      el.dataset.left = left.id;
      el.dataset.right = right.id;
      el.style.left = right.x * 160 * zoom - 72 * zoom + F.number(right.start) * 144 * zoom + "px";
      el.style.top = right.y * 120 + "px";
      var percent = 100 * F.number(F.div(left.duration, F.add(left.duration, right.duration)));
      el.setAttribute("aria-label", "Duration divider between " + (left.name || "empty span") + " and " + (right.name || "empty span"));
      el.setAttribute("aria-valuemin", "0");
      el.setAttribute("aria-valuemax", "100");
      el.setAttribute("aria-valuenow", String(Math.round(percent)));
      el.setAttribute("aria-valuetext", durationLabel(left) + " then " + durationLabel(right));
      el.hidden =
        !!draft ||
        !!(gesture && gesture.kind === "tile") ||
        (Math.min(geometry(left).width, geometry(right).width) < 44 && el !== document.activeElement && !(gesture && gesture.capture === el));
    });
    Array.from($("dividers").children).forEach(function (el) {
      if (!valid.has(el.dataset.key)) el.remove();
    });
  }
  function hideEditor() {
    draft = null;
    editor.hidden = true;
    input.value = "";
    $("error").hidden = true;
    input.removeAttribute("aria-invalid");
  }
  function open(cell, value, focus) {
    draft = Object.assign({ start: zero, duration: one }, cell);
    selected = cell.id || null;
    editor.hidden = false;
    place(editor, draft, 144);
    input.value = value || "";
    input.removeAttribute("aria-invalid");
    $("error").hidden = true;
    editor.classList.toggle("seed", !board.all().length && !input.value);
    editor.classList.toggle("has-text", !!input.value);
    closePanels();
    render();
    reveal(draft);
    if (focus !== false) {
      input.focus({ preventScroll: true });
      input.select();
    }
  }
  function choose(cell) {
    selected = cell.id;
    closePanels();
    render();
    node(cell.id).focus({ preventScroll: true });
  }
  function commit() {
    if (!draft) return true;
    if (!input.value.trim()) {
      hideEditor();
      render();
      return true;
    }
    var cell = board.put(draft.x, draft.y, input.value, draft.id);
    if (!cell) {
      $("error").textContent = "Try a chord like Am7 or C/E.";
      $("error").hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus({ preventScroll: true });
      reveal(draft);
      return false;
    }
    hideEditor();
    choose(board.get(cell.id));
    announce(cell.name + " placed.");
    return true;
  }
  function closePanels() {
    ["help", "settings", "split-form"].forEach(function (id) {
      $(id).hidden = true;
    });
    ["help-toggle", "settings-toggle", "split-toggle"].forEach(function (id) {
      $(id).setAttribute("aria-expanded", "false");
    });
    $("split-error").hidden = true;
  }
  function cancel() {
    if (gesture) {
      finish(true);
      return;
    }
    if (draft) {
      var cell = board.get(draft.id);
      hideEditor();
      render();
      if (cell) choose(cell);
      else canvas.focus({ preventScroll: true });
      if (!board.all().length) open({ x: 0, y: 0 }, "", false);
    }
    closePanels();
  }
  function history(direction) {
    if (gesture) return;
    if (draft && input.value) {
      cancel();
      return;
    }
    hideEditor();
    closePanels();
    board[direction]();
    selected = board.get(selected) ? selected : null;
    render();
    if (selected) node(selected).focus({ preventScroll: true });
    else canvas.focus({ preventScroll: true });
    if (!board.all().length) open({ x: 0, y: 0 }, "", false);
    announce(direction === "undo" ? "Undone." : "Redone.");
  }
  editor.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!input.value.trim()) {
      cancel();
      if (!board.all().length) input.focus({ preventScroll: true });
      return;
    }
    commit();
  });
  input.addEventListener("input", function () {
    editor.classList.toggle("has-text", !!input.value);
    input.removeAttribute("aria-invalid");
    $("error").hidden = true;
  });
  tiles.addEventListener("dblclick", function (e) {
    var el = e.target.closest(".tile");
    if (!el || !commit()) return;
    var cell = board.get(Number(el.dataset.id));
    open(cell, cell.name);
  });
  tiles.addEventListener("click", function (e) {
    var el = e.target.closest(".tile");
    if (e.detail !== 0 || !el || !commit()) return;
    var cell = board.get(Number(el.dataset.id));
    open(cell, cell.name);
  });
  canvas.addEventListener("focusin", function (e) {
    var tile = e.target.closest(".tile"),
      divider = e.target.closest(".divider");
    if ((!tile && !divider) || draft || gesture) return;
    var cell = board.get(Number(tile ? tile.dataset.id : divider.dataset.left));
    if (tile && selected !== cell.id) {
      selected = cell.id;
      closePanels();
      render();
    }
    requestAnimationFrame(function () {
      if (document.activeElement !== e.target || draft || gesture) return;
      // Native Tab must not create a second, invisible scroll offset in the canvas.
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
      reveal(board.get(cell.id) || cell);
    });
  });
  function snap(value) {
    var parts = Number($("snap").value);
    return parts ? F.make(Math.max(1, Math.min(parts - 1, Math.round(value * parts))), parts) : F.snap(value);
  }
  function resizePreview(left, right, ratio) {
    var plan = board.resizePlan(left.id, right.id, ratio);
    if (!plan) return;
    var overrides = new Map();
    overrides.set(left.id, { duration: plan.left });
    overrides.set(right.id, { start: F.add(left.start, plan.left), duration: plan.right });
    render(overrides);
    announce(
      durationLabel(Object.assign({}, left, { duration: plan.left })) + " + " + durationLabel(Object.assign({}, right, { duration: plan.right }))
    );
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (gesture || e.target.closest("#editor") || (e.button !== 0 && e.button !== 1) || !commit()) return;
    e.preventDefault();
    var divider = e.target.closest(".divider"),
      el = e.target.closest(".tile"),
      cell = el && board.get(Number(el.dataset.id));
    var kind = !space && e.button !== 1 ? (divider ? "resize" : cell ? (cell.name === null ? "empty" : "tile") : "pan") : "pan";
    if (cell) choose(cell);
    else {
      selected = null;
      closePanels();
      render();
      canvas.focus({ preventScroll: true });
    }
    gesture = {
      kind: kind,
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      cell: cell,
      moved: false,
      panOnly: space || e.button === 1,
      capture: divider || el || canvas,
    };
    if (kind === "resize") {
      gesture.left = board.get(Number(divider.dataset.left));
      gesture.right = board.get(Number(divider.dataset.right));
      gesture.ratio = F.div(gesture.left.duration, F.add(gesture.left.duration, gesture.right.duration));
      divider.focus({ preventScroll: true });
    }
    gesture.capture.setPointerCapture(e.pointerId);
    panels();
  });
  function updateGesture(e) {
    if (!gesture || gesture.id !== e.pointerId) return;
    var g = gesture,
      dx = e.clientX - g.startX,
      dy = e.clientY - g.startY;
    if (Math.hypot(dx, dy) > 5) g.moved = true;
    if (!g.moved) return;
    if (g.kind === "resize") {
      var total = F.number(F.add(g.left.duration, g.right.duration));
      g.ratio = snap((F.number(g.left.duration) * 144 * zoom + dx) / (total * 144 * zoom));
      resizePreview(g.left, g.right, g.ratio);
    } else if (g.kind === "tile") {
      var cell = g.cell,
        rect = world.getBoundingClientRect(),
        geo = geometry(cell);
      var destination = point(rect.left + geo.x + dx, rect.top + geo.y + dy);
      var target = board.at(destination.x, destination.y, destination.fraction);
      var side = target && destination.fraction < F.number(F.add(target.start, F.div(target.duration, F.make(2, 1)))) ? 0 : 1;
      var plan = board.destination(cell.id, destination.x, destination.y, target && target.id, side);
      g.target = { x: destination.x, y: destination.y, id: target && target.id, side: side };
      g.plan = plan;
      var overrides = new Map();
      if (plan.kind === "squeeze")
        overrides.set(target.id, { start: side === 0 ? F.add(target.start, plan.duration) : target.start, duration: plan.duration });
      render(overrides);
      var moving = node(cell.id);
      moving.classList.add("dragging");
      if (plan.duration) moving.style.width = geometry({ x: 0, y: 0, duration: plan.duration }).width + "px";
      moving.style.left = geo.x + dx + "px";
      moving.style.top = geo.y + dy + "px";
      $("landing").hidden = plan.kind === "same";
      $("landing").classList.toggle("blocked", plan.kind === "blocked");
      $("landing").dataset.note =
        plan.kind === "squeeze"
          ? F.text(plan.duration) + " + " + F.text(plan.duration) + " measure"
          : plan.kind === "blocked"
            ? plan.message
            : plan.kind === "fill"
              ? "Fill empty span"
              : "Keep duration";
      place($("landing"), { x: destination.x, y: destination.y, start: plan.start || zero, duration: plan.duration || one });
    } else {
      pan.x = g.panX + dx;
      pan.y = g.panY + dy;
      canvas.classList.add("panning");
      view();
    }
  }
  canvas.addEventListener("pointermove", function (e) {
    lastPoint = { x: e.clientX, y: e.clientY };
    updateGesture(e);
  });
  function finish(abort, e) {
    if (!gesture) return;
    if (!abort && e) updateGesture(e);
    var g = gesture;
    gesture = null;
    if (g.capture.hasPointerCapture(g.id)) g.capture.releasePointerCapture(g.id);
    canvas.classList.remove("panning");
    $("landing").hidden = true;
    if (g.kind === "tile") {
      node(g.cell.id).classList.remove("dragging");
      if (!abort && g.moved && g.target) {
        board.move(g.cell.id, g.target.x, g.target.y, g.target.id, g.target.side);
        announce(g.plan.kind === "blocked" ? g.plan.message : "Placed. Other spans keep their timing.");
      }
      render();
    } else if (g.kind === "resize") {
      if (!abort && g.moved) board.resize(g.left.id, g.right.id, g.ratio);
      render();
    } else if (abort) {
      pan.x = g.panX;
      pan.y = g.panY;
      view();
      render();
    } else if (!g.moved && !g.panOnly && e) {
      var location = point(e.clientX, e.clientY),
        cell = board.at(location.x, location.y, location.fraction);
      if (cell) choose(cell);
      else open(location);
    } else render();
  }
  canvas.addEventListener("pointerup", function (e) {
    if (gesture && gesture.id === e.pointerId) finish(false, e);
  });
  canvas.addEventListener("pointercancel", function (e) {
    if (gesture && gesture.id === e.pointerId) finish(true);
  });
  canvas.addEventListener("lostpointercapture", function (e) {
    if (gesture && gesture.id === e.pointerId) finish(true);
  });
  canvas.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey || e.metaKey || e.target.closest("#editor")) return;
      e.preventDefault();
      if (gesture) return;
      var scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      pan.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * scale;
      pan.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * scale;
      view();
    },
    { passive: false }
  );
  function setZoom(value) {
    if (gesture) return;
    var anchor = draft || board.get(selected) || { x: 0, y: 0, start: zero, duration: one },
      previous = geometry(anchor).x;
    zoom = Math.max(1, Math.min(64, value));
    pan.x += previous - geometry(anchor).x;
    render();
    if (draft) place(editor, draft, 144);
    view();
    reveal(anchor);
  }
  document.addEventListener("keydown", function (e) {
    if (e.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (gesture) return;
    var typing = e.target.matches("input, select, textarea");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (typing && e.target.value) return;
      e.preventDefault();
      history(e.shiftKey ? "redo" : "undo");
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    var divider = e.target.closest(".divider");
    if (divider && ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(e.key) >= 0) {
      e.preventDefault();
      var left = board.get(Number(divider.dataset.left)),
        right = board.get(Number(divider.dataset.right));
      var parts = Number($("snap").value) || 16;
      var ratio = F.number(F.div(left.duration, F.add(left.duration, right.duration)));
      var step = e.key === "ArrowLeft" ? -1 : 1;
      var nextRatio = e.key === "Home" ? 1 / parts : e.key === "End" ? (parts - 1) / parts : (Math.round(ratio * parts) + step) / parts;
      board.resize(left.id, right.id, F.make(Math.max(1, Math.min(parts - 1, Math.round(nextRatio * parts))), parts));
      render();
      return;
    }
    if (e.target.closest("#tools, #selection, #help, #settings")) return;
    if (e.key === " ") {
      e.preventDefault();
      space = true;
      return;
    }
    if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      setZoom(e.key === "-" ? zoom / 2 : zoom * 2);
      return;
    }
    var focused = e.target.closest(".tile"),
      cell = board.get(focused ? Number(focused.dataset.id) : selected);
    var delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (delta) {
      e.preventDefault();
      var origin = cell || { x: 0, y: 0 },
        location = { x: origin.x + delta[0], y: origin.y + delta[1] };
      var fraction = cell ? F.number(F.add(cell.start, F.div(cell.duration, F.make(2, 1)))) : 0;
      var target = board.at(location.x, location.y, delta[0] < 0 ? 1 : delta[0] > 0 ? 0 : fraction);
      if (e.shiftKey && cell && cell.name) {
        board.move(cell.id, location.x, location.y, target && target.id, delta[0] > 0 ? 0 : 1);
        render();
        reveal(board.get(cell.id));
        return;
      }
      if (cell && delta[0]) {
        var members = board.all().filter(function (c) {
          return c.x === cell.x && c.y === cell.y;
        });
        var neighbor =
          members[
            members.findIndex(function (c) {
              return c.id === cell.id;
            }) + delta[0]
          ];
        if (neighbor) target = neighbor;
      }
      if (target) {
        choose(target);
        reveal(target);
      } else open(location);
    } else if (cell && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      board.remove(cell.id);
      render();
      announce("Chord cleared. Its duration stays empty.");
    } else if (e.key === "Enter") {
      e.preventDefault();
      var location = point(lastPoint.x, lastPoint.y),
        target = cell || board.at(location.x, location.y, location.fraction);
      open(target || location, target && target.name);
    } else if (/^[A-Ga-g]$/.test(e.key)) {
      e.preventDefault();
      var location = point(lastPoint.x, lastPoint.y),
        target = board.at(location.x, location.y, location.fraction);
      if (target && target.name) {
        location = { x: cell ? cell.x + 1 : location.x + 1, y: cell ? cell.y : location.y };
        while (board.at(location.x, location.y)) location.x++;
        target = null;
      }
      open(target || location, e.key);
      input.setSelectionRange(1, 1);
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key === " ") space = false;
  });
  window.addEventListener("blur", function () {
    space = false;
    finish(true);
  });
  $("undo").addEventListener("click", function () {
    history("undo");
  });
  $("redo").addEventListener("click", function () {
    history("redo");
  });
  $("home").addEventListener("click", function () {
    var anchor = draft || board.get(selected) || board.all()[0] || { x: 0, y: 0 },
      g = geometry(anchor);
    pan.x = -g.x;
    pan.y = -g.y;
    view();
  });
  $("zoom-in").addEventListener("click", function () {
    setZoom(zoom * 2);
  });
  $("zoom-out").addEventListener("click", function () {
    setZoom(zoom / 2);
  });
  $("zoom-fit").addEventListener("click", function () {
    var cell = board.get(selected);
    setZoom(cell ? Math.pow(2, Math.ceil(Math.log2(1 / F.number(cell.duration)))) : 1);
  });
  $("edit").addEventListener("click", function () {
    var cell = board.get(selected);
    if (cell) open(cell, cell.name);
  });
  $("remove").addEventListener("click", function () {
    board.remove(selected);
    render();
  });
  $("clear-measure").addEventListener("click", function () {
    var cell = board.get(selected);
    if (!cell) return;
    if (board.clearMeasure(cell.x, cell.y)) {
      selected = null;
      render();
      canvas.focus({ preventScroll: true });
    }
    if (!board.all().length) open({ x: 0, y: 0 }, "", false);
  });
  [
    ["help-toggle", "help"],
    ["settings-toggle", "settings"],
    ["split-toggle", "split-form"],
  ].forEach(function (pair) {
    $(pair[0]).addEventListener("click", function () {
      var show = $(pair[1]).hidden;
      closePanels();
      $(pair[1]).hidden = !show;
      this.setAttribute("aria-expanded", String(show));
      if (show && pair[1] === "split-form") {
        $("split-value").focus();
        $("split-value").select();
      }
    });
  });
  $("split-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!board.split(selected, $("split-value").value)) {
      $("split-error").textContent = "Use 2–64 equal parts or positive ratios such as 2:1. Maximum 256 spans per measure.";
      $("split-error").hidden = false;
      return;
    }
    closePanels();
    choose(board.get(selected));
    reveal(board.get(selected));
    announce("Span divided. Other timings are unchanged.");
  });
  $("meter-form").addEventListener("submit", function (e) {
    e.preventDefault();
    board.setMeter(Number($("meter-top").value), Number($("meter-bottom").value));
    render();
    announce("Meter changed. Fractions are unchanged.");
  });
  function resize() {
    var cell = draft || board.get(selected);
    if (cell) reveal(cell);
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  open({ x: 0, y: 0 }, "", matchMedia("(pointer: fine)").matches);
})();
