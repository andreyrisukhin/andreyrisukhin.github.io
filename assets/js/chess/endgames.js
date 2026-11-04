import { Attempt, nextPuzzle, schedule } from "./endgame-session.js";
import { Chessboard, INPUT_EVENT_TYPE } from "../vendor/cm-chessboard/src/Chessboard.js";
import { Markers, MARKER_TYPE } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { PromotionDialog, PROMOTION_DIALOG_RESULT_TYPE } from "../vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js";

const el = (name) => document.getElementById("eg-" + name);
const key = "chess-endgames:v1";
const lessons = {
  advancedPawn: "A pawn near promotion can tie down a whole piece. Count the moves to the last rank.",
  underPromotion: "Before taking a queen, check what a knight can attack and whether a queen would stalemate.",
  promotion: "Count the pawn’s steps to promotion against the defender’s checks and captures.",
  skewer: "Line up two targets. When the more valuable one moves, take the piece behind it.",
  fork: "Look for two targets one piece can attack at once. A check makes the other threat hard to answer.",
  pin: "Look through the defender to the piece behind it. Can the defender afford to move?",
  discoveredAttack: "Trace the line behind the moving piece. Uncovering a second attack can create two threats at once.",
  deflection: "Find the piece holding the position together. Force it away from its defensive job.",
  attraction: "Look for a forcing move that draws a defender onto a vulnerable square.",
  sacrifice: "Count the forcing replies before counting material. What does giving up the piece make possible?",
  zugzwang: "Picture the same position with the opponent to move. Which duty must they abandon?",
  clearance: "Look for a useful square or line occupied by your own piece. Move it with tempo.",
  interference: "Trace the line between a defender and its target. Can you put a piece between them?",
  backRankMate: "Check the king’s escape squares first. Its own pawns can turn the back rank into a trap.",
  smotheredMate: "A boxed-in king cannot run from a knight check, and no piece can interpose.",
  mateIn1: "Count the king’s flights, then find a check that cannot be captured or blocked.",
  mateIn2: "Picture the mating square. Which first move forces the king or a defender out of place?",
  mateIn3: "Work backward from the mating net. Count escape squares after each forced reply.",
};

async function init() {
  const response = await fetch(new URL("./endgames.json", import.meta.url));
  if (!response.ok) throw new Error("Puzzle bank unavailable");
  const deck = await response.json();
  let state = { records: {}, active: null };
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored?.records && typeof stored.records === "object") state = stored;
  } catch {
    // A missing or unreadable save must not prevent practice.
  }
  const board = new Chessboard(el("board"), {
    assetsUrl: document.querySelector("#endgames").dataset.assets,
    extensions: [{ class: Markers }, { class: PromotionDialog }],
  });
  let puzzle, attempt, pending;
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      el("save").textContent = "Storage is unavailable. You can practice, but this session won’t be saved.";
    }
  };
  function checkpoint() {
    state.active = { id: puzzle.id, index: attempt.index, helped: attempt.helped };
    save();
  }
  function position() {
    board.setPosition(attempt.game.fen(), false);
    const history = attempt.game.history({ verbose: true });
    const last = history.at(-1);
    board.removeMarkers();
    board.addMarker(MARKER_TYPE.square, last.from);
    board.addMarker(MARKER_TYPE.square, last.to);
    el("line").textContent = history.map((m) => m.san).join("  ");
  }
  function counts() {
    const records = Object.values(state.records);
    el("count").textContent = `${records.filter((r) => r.solved).length} / ${deck.length} solved without help · ${
      records.filter((r) => r.due <= Date.now()).length
    } due for review`;
  }
  function controls(playing) {
    for (const id of ["form", "hint", "show"]) el(id).hidden = !playing;
    el("next").hidden = playing;
    el("analyze").hidden = true;
  }
  function start() {
    const saved = state.active;
    puzzle = deck.find((p) => p.id === saved?.id) || nextPuzzle(deck, state.records, Date.now());
    counts();
    el("lesson").textContent = "";
    controls(Boolean(puzzle));
    if (!puzzle) {
      const next = Math.min(...Object.values(state.records).map((r) => r.due));
      el("heading").textContent = "Caught up";
      el("status").textContent = `Next review: ${new Date(next).toLocaleString()}.`;
      return;
    }
    attempt = new Attempt(puzzle, saved?.id === puzzle.id ? saved : null);
    el("heading").textContent = `${state.records[puzzle.id] ? "Review" : "New position"} · ${attempt.side === "w" ? "White" : "Black"} to play`;
    el("status").textContent = "Find the winning continuation.";
    board.setOrientation(attempt.side, false);
    position();
    checkpoint();
  }
  function finish(revealed) {
    const clean = !revealed && !attempt.helped;
    const result = schedule(state.records[puzzle.id], clean, Date.now());
    state.records[puzzle.id] = result;
    state.active = null;
    save();
    controls(false);
    counts();
    el("status").textContent = `${revealed ? "Line shown" : clean ? "Solved" : "Line completed with help"}. Review ${
      clean ? "on " + new Date(result.due).toLocaleDateString() : "in 10 minutes"
    }.`;
    el("lesson").textContent = lessons[puzzle.motif];
    const link = el("analyze");
    link.hash = `fen=${puzzle.fen.replaceAll(" ", "_")}&m=${attempt.game
      .history({ verbose: true })
      .map((m) => m.lan)
      .join(".")}&at=1&o=${attempt.side}`;
    link.hidden = false;
  }
  function play(move) {
    if (!state.active) return;
    const outcome = attempt.play(move);
    position();
    if (outcome === "complete") return finish(false);
    el("status").textContent = {
      illegal: "That move isn’t legal here. Try again.",
      retry: "That isn’t the winning line. Look again.",
      continue: "Correct. The opponent has replied. What comes next?",
    }[outcome];
    checkpoint();
  }
  board.enableMoveInput((event) => {
    if (!state.active) return false;
    const { squareFrom: from, squareTo: to } = event;
    if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
      const moves = attempt.game.moves({ square: from, verbose: true });
      for (const move of moves) board.addMarker(MARKER_TYPE.dot, move.to);
      return moves.length > 0;
    }
    if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
      const legal = attempt.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
      if (legal[0]?.promotion) {
        board.showPromotionDialog(to, attempt.side, (result) => {
          if (result?.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) play({ from, to, promotion: result.piece[1] });
          else position();
        });
      } else if (legal.length) pending = { from, to };
      return Boolean(legal.length);
    }
    if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
      board.removeMarkers(MARKER_TYPE.dot);
      if (pending) play(pending);
      pending = null;
    }
  });
  el("form").onsubmit = (event) => {
    event.preventDefault();
    play(el("input").value.trim());
    el("input").value = "";
  };
  el("hint").onclick = () => {
    attempt.helped = true;
    el("lesson").textContent = lessons[puzzle.motif];
    el("status").textContent = `Look at the piece on ${attempt.line[attempt.index].slice(0, 2)}.`;
    checkpoint();
  };
  el("show").onclick = () => {
    while (attempt.index < attempt.line.length) attempt.game.move(attempt.line[attempt.index++]);
    position();
    finish(true);
  };
  el("next").onclick = start;
  start();
}

init().catch(() => {
  el("status").textContent = "Couldn’t load practice. Reload the page to try again.";
});
