import { Chess } from "../vendor/chess.js/chess.js";
import { Chessboard, COLOR, FEN, INPUT_EVENT_TYPE } from "../vendor/cm-chessboard/src/Chessboard.js";
import { Markers, MARKER_TYPE } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { PromotionDialog, PROMOTION_DIALOG_RESULT_TYPE } from "../vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js";
import {
  RightClickAnnotator,
  ARROW_TYPE as NOTE_ARROW,
  MARKER_TYPE as NOTE_MARKER,
} from "../vendor/cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ANNOTATION_COLORS, Scenario } from "./scenario.js";

const STORAGE_KEY = "chess-scenarios:v1";
const WHEEL_STEP = 60;
const GLYPHS = {
  w: { p: "\u2659", n: "\u2658", b: "\u2657", r: "\u2656", q: "\u2655" },
  b: { p: "\u265F", n: "\u265E", b: "\u265D", r: "\u265C", q: "\u265B" },
};
const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

const app = document.querySelector("[data-chess-app]");
if (app) init(app);

function init(app) {
  const $ = (selector) => app.querySelector(selector);
  const boardEl = $("[data-chess-board]");
  const movesEl = $("[data-chess-moves]");
  const statusEl = $("[data-chess-status]");
  const titleEl = $("[data-chess-title]");
  const toastEl = $("[data-chess-toast]");
  const setupEl = $("[data-chess-setup]");
  const turnEl = $("[data-chess-turn]");
  const savedEl = $("[data-chess-saved]");
  const materialEls = { top: $('[data-chess-material="top"]'), bottom: $('[data-chess-material="bottom"]') };
  const action = (name) => app.querySelector(`[data-chess-action="${name}"]`);

  const colorByClass = {};
  for (const [letter, key] of Object.entries(ANNOTATION_COLORS)) {
    colorByClass[NOTE_ARROW[key].class] = letter;
    colorByClass[NOTE_MARKER[key].class] = letter;
  }

  const board = new Chessboard(boardEl, {
    position: FEN.start,
    assetsUrl: app.dataset.assets,
    style: { animationDuration: 200 },
    extensions: [{ class: Markers }, { class: PromotionDialog }, { class: RightClickAnnotator }],
  });

  let scenario = loadFromHash() || new Scenario(Chess);
  let mode = "play";
  let pendingMove = null;
  let savedId = null;
  let setupTool = "move";
  let toastTimer = 0;

  // ---- Rendering ----

  function render({ animate = false } = {}) {
    const node = scenario.current;
    board.setPosition(node.fen, animate);
    if (board.getOrientation() !== scenario.orientation) board.setOrientation(scenario.orientation, animate);
    board.removeMarkers(MARKER_TYPE.square);
    board.removeMarkers(MARKER_TYPE.dot);
    if (node.from) {
      board.addMarker(MARKER_TYPE.square, node.from);
      board.addMarker(MARKER_TYPE.square, node.to);
    }
    board.setAnnotations(toBoardAnnotations(node.annotations));
    if (document.activeElement !== titleEl) titleEl.value = scenario.title;
    renderMoves();
    renderMaterial();
    renderStatus();
    renderButtons();
    writeHash();
  }

  function renderMoves() {
    movesEl.replaceChildren();
    if (!scenario.root.children.length) {
      const empty = document.createElement("p");
      empty.className = "chess-moves__empty";
      empty.textContent = "No moves yet. Drag a piece to start a line.";
      movesEl.append(empty);
      return;
    }
    const line = (container, position, forceNumber) => {
      let n = position;
      let force = forceNumber;
      while (n.children.length) {
        const [main, ...variations] = n.children;
        container.append(moveButton(main, force));
        force = false;
        if (variations.length) {
          // Each alternative gets its own bracketed line so sibling lines never read as one sequence.
          const group = document.createElement("div");
          group.className = "chess-variations";
          for (const variation of variations) {
            const box = document.createElement("div");
            box.className = "chess-variation";
            box.append(moveButton(variation, true));
            line(box, variation, false);
            group.append(box);
          }
          container.append(group);
          force = true;
        }
        n = main;
      }
    };
    line(movesEl, scenario.root, true);
    const current = movesEl.querySelector(".chess-move--current");
    if (current) {
      const top = current.offsetTop - movesEl.offsetTop;
      if (top < movesEl.scrollTop || top + current.offsetHeight > movesEl.scrollTop + movesEl.clientHeight) {
        movesEl.scrollTop = top - movesEl.clientHeight / 2;
      }
    }
  }

  function moveButton(node, forceNumber) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chess-move";
    if (node === scenario.current) button.classList.add("chess-move--current");
    const [, turn, , , , fullmove] = node.parent.fen.split(" ");
    if (turn === "w" || forceNumber) {
      const number = document.createElement("span");
      number.className = "chess-move__number";
      number.textContent = turn === "w" ? `${fullmove}.` : `${fullmove}...`;
      button.append(number);
    }
    button.append(node.san);
    if (node.annotations.length) button.classList.add("chess-move--noted");
    button.addEventListener("click", () => {
      scenario.goTo(node);
      render({ animate: true });
    });
    return button;
  }

  function renderMaterial() {
    const { captures, advantage } = scenario.material();
    const bottom = scenario.orientation;
    const top = bottom === "w" ? "b" : "w";
    fillMaterial(materialEls.top, top, captures[top], advantage);
    fillMaterial(materialEls.bottom, bottom, captures[bottom], advantage);
  }

  function fillMaterial(el, side, pieces, advantage) {
    const opponent = side === "w" ? "b" : "w";
    const name = side === "w" ? "White" : "Black";
    const lead = side === "w" ? advantage : -advantage;
    el.replaceChildren();
    const label = document.createElement("span");
    label.className = "chess-material__side";
    label.textContent = name;
    el.append(label);
    let group = null;
    pieces.forEach((type, i) => {
      if (type !== pieces[i - 1]) {
        group = document.createElement("span");
        group.className = "chess-material__group";
        el.append(group);
      }
      const piece = document.createElement("span");
      piece.className = "chess-material__piece";
      piece.textContent = GLYPHS[opponent][type];
      group.append(piece);
    });
    if (lead > 0) {
      const score = document.createElement("span");
      score.className = "chess-material__score";
      score.textContent = `+${lead}`;
      el.append(score);
    }
    const counts = {};
    for (const type of pieces) counts[type] = (counts[type] || 0) + 1;
    const list = Object.entries(counts).map(([type, n]) => `${n} ${PIECE_NAMES[type]}${n > 1 ? "s" : ""}`);
    el.setAttribute(
      "aria-label",
      `${name} captured ${list.length ? list.join(", ") : "nothing"}${lead > 0 ? `, up ${lead} point${lead > 1 ? "s" : ""}` : ""}`
    );
  }

  function renderStatus() {
    const game = new Chess(scenario.current.fen);
    const side = game.turn() === "w" ? "White" : "Black";
    let text;
    if (game.isCheckmate()) text = `Checkmate. ${side === "White" ? "Black" : "White"} wins.`;
    else if (game.isStalemate()) text = "Stalemate.";
    else if (game.isDraw()) text = "Draw.";
    else text = `Move ${game.moveNumber()}, ${side.toLowerCase()} to play${game.inCheck() ? ", in check" : ""}.`;
    statusEl.textContent = text;
  }

  function renderButtons() {
    const node = scenario.current;
    const atStart = !node.parent;
    const atEnd = !scenario.nextOf(node);
    action("start").disabled = atStart;
    action("back").disabled = atStart;
    action("forward").disabled = atEnd;
    action("end").disabled = atEnd;
    action("promote").disabled = atStart || scenario.isMainLine(node);
    action("delete").disabled = atStart;
    action("branch").disabled = atStart;
  }

  function toBoardAnnotations(annotations) {
    return {
      arrows: annotations.filter((a) => a.to).map((a) => ({ type: NOTE_ARROW[ANNOTATION_COLORS[a.color]], from: a.from, to: a.to })),
      markers: annotations.filter((a) => !a.to).map((a) => ({ type: NOTE_MARKER[ANNOTATION_COLORS[a.color]], square: a.from })),
    };
  }

  function readBoardAnnotations() {
    const { arrows, markers } = board.getAnnotations();
    const out = [];
    for (const arrow of arrows) {
      const color = colorByClass[arrow.type && arrow.type.class];
      if (color) out.push({ color, from: arrow.from, to: arrow.to });
    }
    for (const marker of markers) {
      const color = colorByClass[marker.type && marker.type.class];
      if (color) out.push({ color, from: marker.square });
    }
    return out;
  }

  // ---- URL ----

  function writeHash({ push = false } = {}) {
    const url = location.pathname + location.search + scenario.toHash();
    if (url === location.pathname + location.search + location.hash) return;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  }

  function loadFromHash() {
    if (location.hash.length < 2) return null;
    try {
      return Scenario.fromHash(Chess, location.hash);
    } catch (error) {
      showToast(`Could not read this link: ${error.message}`);
      return null;
    }
  }

  // Structural changes push a history entry so the browser's Back button can undo them.
  function replaceScenario(next, message) {
    writeHash();
    scenario = next;
    savedId = null;
    writeHash({ push: true });
    render();
    if (message) showToast(message);
  }

  window.addEventListener("popstate", () => {
    scenario = loadFromHash() || new Scenario(Chess);
    savedId = null;
    if (mode === "setup") exitSetup();
    render();
  });

  // ---- Play mode input ----

  function legalFrom(square) {
    return new Chess(scenario.current.fen).moves({ square, verbose: true });
  }

  function commit(move) {
    const node = scenario.play(move);
    render({ animate: Boolean(node) });
  }

  function onPlayInput(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted: {
        const moves = legalFrom(event.squareFrom);
        for (const move of moves) board.addMarker(MARKER_TYPE.dot, move.to);
        return moves.length > 0;
      }
      case INPUT_EVENT_TYPE.validateMoveInput: {
        board.removeMarkers(MARKER_TYPE.dot);
        const { squareFrom: from, squareTo: to } = event;
        const moves = legalFrom(from).filter((move) => move.to === to);
        if (!moves.length) return false;
        if (moves.some((move) => move.promotion)) {
          const color = new Chess(scenario.current.fen).turn() === "w" ? COLOR.white : COLOR.black;
          board.showPromotionDialog(to, color, (result) => {
            if (result && result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
              commit({ from, to, promotion: result.piece.charAt(1) });
            } else {
              render();
            }
          });
          return true;
        }
        pendingMove = { from, to };
        return true;
      }
      case INPUT_EVENT_TYPE.moveInputCanceled:
        board.removeMarkers(MARKER_TYPE.dot);
        break;
      case INPUT_EVENT_TYPE.moveInputFinished:
        if (pendingMove) {
          const move = pendingMove;
          pendingMove = null;
          commit(move);
        }
        break;
    }
  }

  board.enableMoveInput(onPlayInput);

  // RightClickAnnotator registered its mouseup listener first, so the board already holds the new drawing here.
  boardEl.addEventListener("mouseup", (event) => {
    if (event.button !== 2 || mode !== "play") return;
    scenario.current.annotations = readBoardAnnotations();
    writeHash();
    renderMoves();
  });

  // ---- Navigation ----

  function step(direction) {
    const moved = {
      start: () => scenario.toStart(),
      back: () => scenario.back(),
      forward: () => scenario.forward(),
      end: () => scenario.toEnd(),
    }[direction]();
    if (moved) render({ animate: true });
  }

  let wheelTotal = 0;
  let wheelTimer = 0;
  boardEl.addEventListener(
    "wheel",
    (event) => {
      if (mode !== "play") return;
      event.preventDefault();
      wheelTotal += event.deltaY;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => (wheelTotal = 0), 250);
      while (Math.abs(wheelTotal) >= WHEEL_STEP) {
        step(wheelTotal > 0 ? "forward" : "back");
        wheelTotal -= Math.sign(wheelTotal) * WHEEL_STEP;
      }
    },
    { passive: false }
  );

  document.addEventListener("keydown", (event) => {
    if (mode !== "play" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;
    const keys = { ArrowLeft: "back", ArrowRight: "forward", ArrowUp: "start", Home: "start", ArrowDown: "end", End: "end" };
    if (keys[event.key]) {
      event.preventDefault();
      step(keys[event.key]);
    } else if (event.key === "f") {
      flip();
    }
  });

  function flip() {
    scenario.orientation = scenario.orientation === "w" ? "b" : "w";
    board.setOrientation(scenario.orientation, true);
    renderMaterial();
    writeHash();
  }

  // ---- Actions ----

  const actions = {
    start: () => step("start"),
    back: () => step("back"),
    forward: () => step("forward"),
    end: () => step("end"),
    flip,
    "copy-link": () => copy(location.href, "Link copied."),
    "copy-pgn": () => copy(scenario.toPgn(), "PGN copied."),
    save: () => save(false),
    "save-new": () => save(true),
    branch: () => replaceScenario(scenario.branchFromCurrent(), "New scenario starts from this position. Back returns to the old one."),
    promote: () => {
      scenario.promote(scenario.current);
      render();
    },
    delete: () => {
      writeHash();
      scenario.deleteNode(scenario.current);
      writeHash({ push: true });
      render({ animate: true });
    },
    "clear-notes": () => {
      scenario.current.annotations = [];
      render();
    },
    reset: () => replaceScenario(new Scenario(Chess)),
    setup: enterSetup,
    "setup-start": () => board.setPosition(FEN.start),
    "setup-clear": () => board.setPosition(FEN.empty),
    "setup-done": finishSetup,
    "setup-cancel": () => {
      exitSetup();
      render();
    },
  };

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chess-action]");
    if (button && actions[button.dataset.chessAction]) actions[button.dataset.chessAction]();
    const tool = event.target.closest("[data-chess-tool]");
    if (tool) setTool(tool.dataset.chessTool);
  });

  titleEl.addEventListener("input", () => {
    scenario.title = titleEl.value.trim();
    writeHash();
  });

  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  function showToast(message) {
    toastEl.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.textContent = ""), 4000);
  }

  // ---- Setup mode ----

  function enterSetup() {
    mode = "setup";
    app.classList.add("chess-app--setup");
    setupEl.hidden = false;
    board.removeMarkers();
    board.setAnnotations({ arrows: [], markers: [] });
    turnEl.value = new Chess(scenario.current.fen).turn();
    setTool("move");
  }

  function exitSetup() {
    mode = "play";
    app.classList.remove("chess-app--setup");
    setupEl.hidden = true;
    board.disableMoveInput();
    board.enableMoveInput(onPlayInput);
  }

  function setTool(tool) {
    setupTool = tool;
    for (const button of app.querySelectorAll("[data-chess-tool]")) {
      button.setAttribute("aria-pressed", String(button.dataset.chessTool === tool));
    }
    board.disableMoveInput();
    if (tool === "move") board.enableMoveInput(onSetupInput);
  }

  function onSetupInput(event) {
    if (event.type === INPUT_EVENT_TYPE.moveInputStarted) return Boolean(event.piece);
    if (event.type === INPUT_EVENT_TYPE.validateMoveInput) return true;
    if (event.type === INPUT_EVENT_TYPE.moveInputCanceled && event.reason === "movedOutOfBoard") {
      board.setPiece(event.squareFrom, null);
    }
  }

  boardEl.addEventListener("pointerdown", (event) => {
    if (mode !== "setup" || setupTool === "move" || event.button !== 0) return;
    const squareEl = event.target.closest("[data-square]");
    if (!squareEl) return;
    const square = squareEl.getAttribute("data-square");
    const piece = setupTool === "erase" || board.getPiece(square) === setupTool ? null : setupTool;
    board.setPiece(square, piece);
  });

  function finishSetup() {
    const placement = board.getPosition();
    const at = (square) => board.getPiece(square);
    let castling = "";
    if (at("e1") === "wk" && at("h1") === "wr") castling += "K";
    if (at("e1") === "wk" && at("a1") === "wr") castling += "Q";
    if (at("e8") === "bk" && at("h8") === "br") castling += "k";
    if (at("e8") === "bk" && at("a8") === "br") castling += "q";
    const fen = `${placement} ${turnEl.value} ${castling || "-"} - 0 1`;
    let next;
    try {
      next = new Scenario(Chess, fen);
    } catch (error) {
      showToast(`That position is not legal: ${error.message.replace(/^Invalid FEN: /, "")}`);
      return;
    }
    next.title = scenario.title;
    next.orientation = scenario.orientation;
    exitSetup();
    replaceScenario(next, "Position set. Moves now start from here.");
  }

  // ---- Saved scenarios (this browser only) ----

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeSaved(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      showToast("This browser would not save the scenario.");
    }
    renderSaved();
  }

  function save(asNew) {
    const list = readSaved();
    const entry = {
      id: !asNew && savedId ? savedId : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: scenario.title || "Untitled scenario",
      hash: scenario.toHash(),
      moves: scenario.orderedNodes().length,
      savedAt: new Date().toISOString(),
    };
    const index = list.findIndex((item) => item.id === entry.id);
    if (index === -1) list.unshift(entry);
    else list[index] = entry;
    savedId = entry.id;
    writeSaved(list);
    showToast(index === -1 ? `Saved "${entry.title}".` : `Updated "${entry.title}".`);
  }

  function renderSaved() {
    const list = readSaved();
    savedEl.replaceChildren();
    if (!list.length) {
      const empty = document.createElement("li");
      empty.className = "chess-saved__empty";
      empty.textContent = "Nothing saved in this browser yet.";
      savedEl.append(empty);
      return;
    }
    for (const item of list) {
      const li = document.createElement("li");
      li.className = "chess-saved__item";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "chess-saved__open";
      open.textContent = item.title;
      const meta = document.createElement("span");
      meta.className = "chess-saved__meta";
      meta.textContent = `${item.moves} move${item.moves === 1 ? "" : "s"} · ${new Date(item.savedAt).toLocaleDateString()}`;
      open.append(meta);
      open.addEventListener("click", () => {
        try {
          const next = Scenario.fromHash(Chess, item.hash);
          if (mode === "setup") exitSetup();
          replaceScenario(next);
          savedId = item.id;
        } catch (error) {
          showToast(`Could not open it: ${error.message}`);
        }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chess-saved__remove";
      remove.setAttribute("aria-label", `Delete ${item.title}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        writeSaved(readSaved().filter((other) => other.id !== item.id));
        if (savedId === item.id) savedId = null;
      });
      li.append(open, remove);
      savedEl.append(li);
    }
  }

  renderSaved();
  render();
}
