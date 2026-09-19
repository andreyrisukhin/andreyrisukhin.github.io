(function () {
  "use strict";
  var $ = function (id) {
    return document.getElementById(id);
  };
  var canvas = $("canvas"),
    world = $("world"),
    tiles = $("tiles"),
    editor = $("editor"),
    input = $("chord-input");
  var board = window.ChordCanvasBoard.create();
  var pitchX = 160,
    pitchY = 120;
  var pan = { x: 0, y: 0 },
    draft = { x: 0, y: 0 },
    selected = null,
    gesture = null,
    space = false;
  var lastPoint = { x: innerWidth / 2, y: innerHeight / 2 };
  function announce(text) {
    $("status").textContent = text;
  }
  function position(node, x, y) {
    node.style.left = x + "px";
    node.style.top = y + "px";
  }
  function place(node, cell) {
    var offset = cell.slot === 0 ? -38 : cell.slot === 1 ? 38 : 0;
    position(node, cell.x * pitchX + offset, cell.y * pitchY);
  }
  function byId(id) {
    return board.all().find(function (cell) {
      return cell.id === id;
    });
  }
  function view() {
    world.style.transform = "translate(" + pan.x + "px," + pan.y + "px)";
  }
  function point(x, y) {
    var rect = world.getBoundingClientRect();
    var column = Math.round((x - rect.left) / pitchX);
    return { x: column, y: Math.round((y - rect.top) / pitchY), side: x - rect.left < column * pitchX ? 0 : 1 };
  }
  function reveal(cell) {
    var x = innerWidth / 2 + pan.x + cell.x * pitchX;
    var y = innerHeight / 2 + pan.y + cell.y * pitchY;
    var height = window.visualViewport ? window.visualViewport.height : innerHeight;
    var side = $("error").hidden ? 88 : 112;
    var bottom = $("error").hidden ? 88 : 156;
    pan.x += Math.max(side - x, 0) + Math.min(innerWidth - side - x, 0);
    pan.y += Math.max(72 - y, 0) + Math.min(height - bottom - y, 0);
    view();
  }
  function tileNode(id) {
    return tiles.querySelector('[data-id="' + id + '"]');
  }
  function render() {
    var all = board.all();
    var ids = new Set(
      all.map(function (c) {
        return String(c.id);
      })
    );
    Array.from(tiles.children).forEach(function (el) {
      if (!ids.has(el.dataset.id)) el.remove();
    });
    all.forEach(function (cell) {
      var el = tileNode(cell.id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "cell tile";
        el.dataset.id = cell.id;
        tiles.appendChild(el);
      }
      if (el.textContent !== cell.name) el.textContent = cell.name;
      el.dataset.beats = cell.slot === null ? "4" : "2";
      el.dataset.slot = cell.slot === null ? "full" : String(cell.slot);
      el.title = cell.name + " · " + el.dataset.beats + " beats";
      el.setAttribute(
        "aria-label",
        cell.name +
          ", " +
          el.dataset.beats +
          " beats, column " +
          cell.x +
          ", row " +
          cell.y +
          (cell.slot === null ? "" : cell.slot === 0 ? ", first half" : ", second half") +
          ". Double-click or Enter to edit."
      );
      el.classList.toggle("selected", cell.id === selected);
      el.classList.toggle("long-name", cell.name.length > 8);
      el.classList.toggle("half", cell.slot !== null);
      el.classList.remove("merge-preview");
      el.hidden = !!draft && draft.id === cell.id;
      el.style.setProperty("--fill", cell.fill);
      place(el, cell);
    });
    $("undo").disabled = !board.canUndo;
    $("redo").disabled = !board.canRedo;
    $("tools").hidden = !all.length && !board.canRedo;
  }
  function hideEditor() {
    draft = null;
    editor.hidden = true;
    input.value = "";
    $("error").hidden = true;
    input.removeAttribute("aria-invalid");
  }
  function open(cell, value, focus) {
    draft = { x: cell.x, y: cell.y, id: cell.id };
    selected = null;
    editor.hidden = false;
    place(editor, draft);
    input.value = value || "";
    input.removeAttribute("aria-invalid");
    $("error").hidden = true;
    editor.classList.toggle("seed", !board.all().length && !input.value);
    editor.classList.toggle("has-text", !!input.value);
    render();
    reveal(draft);
    if (focus !== false) {
      input.focus({ preventScroll: true });
      input.select();
    }
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
    selected = cell.id;
    render();
    tileNode(cell.id).focus({ preventScroll: true });
    announce(cell.name + " placed. Click anywhere to add another.");
    return true;
  }
  function choose(cell) {
    selected = cell.id;
    render();
    tileNode(cell.id).focus({ preventScroll: true });
  }
  function cancel() {
    if (gesture) {
      finishGesture(true);
      return;
    }
    if (draft) {
      var cell = byId(draft.id);
      hideEditor();
      render();
      if (cell) choose(cell);
      else canvas.focus({ preventScroll: true });
      if (!board.all().length) open({ x: 0, y: 0 }, "", false);
    }
    $("help").hidden = true;
    $("help-toggle").setAttribute("aria-expanded", "false");
  }
  function history(direction) {
    if (draft && input.value) {
      cancel();
      return;
    }
    hideEditor();
    board[direction]();
    selected = null;
    render();
    canvas.focus({ preventScroll: true });
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
    var cell = board.all().find(function (c) {
      return c.id === Number(el.dataset.id);
    });
    open(cell, cell.name);
  });
  tiles.addEventListener("click", function (e) {
    var el = e.target.closest(".tile");
    if (e.detail !== 0 || !el || !commit()) return;
    var cell = board.all().find(function (c) {
      return c.id === Number(el.dataset.id);
    });
    open(cell, cell.name);
  });
  canvas.addEventListener("pointerdown", function (e) {
    if (gesture || e.target.closest("#editor") || (e.button !== 0 && e.button !== 1)) return;
    var el = e.target.closest(".tile");
    if (!commit()) return;
    e.preventDefault();
    var cell =
      el && !space && e.button !== 1
        ? board.all().find(function (c) {
            return c.id === Number(el.dataset.id);
          })
        : null;
    if (cell) choose(cell);
    else {
      selected = null;
      render();
      canvas.focus({ preventScroll: true });
    }
    gesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      cell: cell,
      moved: false,
      panOnly: space || e.button === 1,
    };
    gesture.capture = cell ? tileNode(cell.id) : canvas;
    gesture.capture.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    lastPoint = { x: e.clientX, y: e.clientY };
    if (!gesture || gesture.id !== e.pointerId) return;
    var dx = e.clientX - gesture.startX,
      dy = e.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > 5) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.cell) {
      var cell = gesture.cell,
        el = tileNode(cell.id);
      render();
      el.classList.add("dragging");
      var offset = cell.slot === 0 ? -38 : cell.slot === 1 ? 38 : 0;
      var x = cell.x * pitchX + offset + dx;
      var column = Math.round(x / pitchX);
      gesture.target = { x: column, y: Math.round(cell.y + dy / pitchY), side: x < column * pitchX ? 0 : 1 };
      var target = gesture.target;
      var plan = board.destination(cell.id, target.x, target.y, target.side);
      var merging = plan.kind === "merge";
      el.classList.toggle("half", cell.slot !== null || merging);
      position(el, x, cell.y * pitchY + dy);
      if (merging) {
        var other = board.at(target.x, target.y),
          otherNode = tileNode(other.id);
        otherNode.classList.add("half", "merge-preview");
        place(otherNode, { x: target.x, y: target.y, slot: 1 - plan.side });
      }
      $("landing").classList.toggle("blocked", plan.kind === "blocked");
      $("landing").classList.toggle("half", merging || plan.kind === "reorder");
      $("landing").dataset.note = plan.kind === "blocked" ? "Already two halves" : merging ? "2 beats + 2 beats" : "";
      place($("landing"), { x: target.x, y: target.y, slot: merging || plan.kind === "reorder" ? plan.side : null });
      $("landing").hidden = false;
    } else {
      pan.x = gesture.panX + dx;
      pan.y = gesture.panY + dy;
      canvas.classList.add("panning");
      view();
    }
  });
  function finishGesture(abort, e) {
    if (!gesture) return;
    var g = gesture;
    gesture = null;
    if (g.capture.hasPointerCapture(g.id)) g.capture.releasePointerCapture(g.id);
    canvas.classList.remove("panning");
    $("landing").hidden = true;
    if (g.cell) {
      tileNode(g.cell.id).classList.remove("dragging");
      if (!abort && g.moved && g.target) {
        move(g.cell, g.target);
      }
      render();
    } else if (abort) {
      pan.x = g.panX;
      pan.y = g.panY;
      view();
    } else if (!g.moved && !g.panOnly && e) {
      var cell = point(e.clientX, e.clientY),
        existing = board.at(cell.x, cell.y, cell.side);
      if (existing) choose(existing);
      else open(cell);
    }
  }
  canvas.addEventListener("pointerup", function (e) {
    if (gesture && e.pointerId === gesture.id) finishGesture(false, e);
  });
  function move(cell, target) {
    var plan = board.destination(cell.id, target.x, target.y, target.side);
    board.move(cell.id, target.x, target.y, target.side);
    if (plan.kind === "blocked") announce("This space already has two halves. Move to another space.");
    else if (plan.kind === "merge") announce("Squeezed together. Two chords, two beats each.");
    else announce("Moved " + cell.name + ".");
  }
  canvas.addEventListener("pointercancel", function () {
    finishGesture(true);
  });
  canvas.addEventListener("lostpointercapture", function () {
    finishGesture(true);
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
  document.addEventListener("keydown", function (e) {
    if (e.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (gesture) return;
    var editing = e.target === input;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (editing && input.value) return;
      e.preventDefault();
      history(e.shiftKey ? "redo" : "undo");
      return;
    }
    if (editing || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("#tools, #help")) return;
    if (e.key === " ") {
      e.preventDefault();
      space = true;
      return;
    }
    var focused = e.target.closest(".tile");
    var cell = board.all().find(function (c) {
      return c.id === (focused ? Number(focused.dataset.id) : selected);
    });
    var delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (delta) {
      e.preventDefault();
      var origin = cell || { x: 0, y: 0 };
      var next = { x: origin.x + delta[0], y: origin.y + delta[1] };
      if (cell && e.shiftKey) {
        next.side = delta[0] > 0 ? 0 : 1;
        move(cell, next);
        render();
        reveal(next);
      } else {
        if (cell && cell.slot !== null && ((delta[0] === 1 && cell.slot === 0) || (delta[0] === -1 && cell.slot === 1))) {
          next = { x: cell.x, y: cell.y, side: 1 - cell.slot };
        } else next.side = delta[0] < 0 ? 1 : delta[0] > 0 ? 0 : cell && cell.slot;
        var neighbor = board.at(next.x, next.y, next.side);
        if (neighbor) {
          choose(neighbor);
          reveal(neighbor);
        } else open(next);
      }
    } else if (cell && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      board.remove(cell.id);
      selected = null;
      render();
      canvas.focus({ preventScroll: true });
      if (!board.all().length) open({ x: 0, y: 0 }, "", false);
      announce("Chord removed.");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cell) open(cell, cell.name);
      else {
        var location = point(lastPoint.x, lastPoint.y);
        var existing = board.at(location.x, location.y, location.side);
        if (existing) open(existing, existing.name);
        else open(location);
      }
    } else if (/^[A-Ga-g]$/.test(e.key)) {
      e.preventDefault();
      var target = point(lastPoint.x, lastPoint.y);
      if (board.at(target.x, target.y)) {
        target = cell ? { x: cell.x + 1, y: cell.y } : target;
        while (board.at(target.x, target.y)) target.x++;
      }
      open(target, e.key);
      input.setSelectionRange(1, 1);
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key === " ") space = false;
  });
  window.addEventListener("blur", function () {
    space = false;
    finishGesture(true);
  });
  $("undo").addEventListener("click", function () {
    history("undo");
  });
  $("redo").addEventListener("click", function () {
    history("redo");
  });
  $("home").addEventListener("click", function () {
    var all = board.all();
    var anchor = draft ||
      all.find(function (c) {
        return c.id === selected;
      }) ||
      all[0] || { x: 0, y: 0 };
    pan.x = -anchor.x * pitchX;
    pan.y = -anchor.y * pitchY;
    view();
  });
  $("help-toggle").addEventListener("click", function () {
    $("help").hidden = !$("help").hidden;
    this.setAttribute("aria-expanded", String(!$("help").hidden));
  });
  function resize() {
    var cell =
      draft ||
      board.all().find(function (c) {
        return c.id === selected;
      });
    if (cell) reveal(cell);
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  open({ x: 0, y: 0 }, "", matchMedia("(pointer: fine)").matches);
})();
