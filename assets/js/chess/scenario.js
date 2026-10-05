// Move tree for a chess scenario, plus its URL-hash and PGN encodings.
// Kept free of DOM code so _scripts/chess-scenario-test.js can run it in Node.

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// One letter per annotation color in the URL; the values match cm-chessboard's RightClickAnnotator keys.
export const ANNOTATION_COLORS = { g: "success", b: "info", r: "danger", o: "warning" };

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_ORDER = "pnbrq";
const FULL_SET = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const MOVE_TOKEN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const SQUARE = /^[a-h][1-8]$/;

function makeNode(parent, move, fen) {
  return {
    parent,
    uci: move ? move.lan : null,
    san: move ? move.san : null,
    from: move ? move.from : null,
    to: move ? move.to : null,
    color: move ? move.color : null,
    captured: move ? move.captured || null : null,
    fen,
    children: [],
    selected: null,
    annotations: [],
  };
}

export class Scenario {
  constructor(Chess, startFen = START_FEN) {
    this.Chess = Chess;
    this.startFen = new Chess(startFen).fen();
    this.root = makeNode(null, null, this.startFen);
    this.current = this.root;
    this.title = "";
    this.orientation = "w";
  }

  // Adds a child of `parent` (or returns the existing one) without moving `current`.
  addMove(parent, move) {
    const uci = typeof move === "string" ? move : move.from + move.to + (move.promotion || "");
    const game = new this.Chess(parent.fen);
    let result;
    try {
      result = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      return null;
    }
    const existing = parent.children.find((child) => child.uci === result.lan);
    if (existing) return existing;
    const node = makeNode(parent, result, game.fen());
    parent.children.push(node);
    return node;
  }

  // Plays from the current position. A move that differs from the existing continuation becomes a new branch.
  play(move) {
    const node = this.addMove(this.current, move);
    if (node) this.goTo(node);
    return node;
  }

  goTo(node) {
    this.current = node;
    // Remember the route so stepping back and then forward returns along the same branch.
    for (let n = node; n.parent; n = n.parent) n.parent.selected = n;
    return node;
  }

  nextOf(node) {
    return node.children.includes(node.selected) ? node.selected : node.children[0] || null;
  }

  back() {
    if (!this.current.parent) return false;
    this.current = this.current.parent;
    return true;
  }

  forward() {
    const next = this.nextOf(this.current);
    if (!next) return false;
    this.current = next;
    return true;
  }

  toStart() {
    const moved = this.current !== this.root;
    this.current = this.root;
    return moved;
  }

  toEnd() {
    let moved = false;
    while (this.forward()) moved = true;
    return moved;
  }

  ply(node = this.current) {
    let depth = 0;
    for (let n = node; n.parent; n = n.parent) depth++;
    return depth;
  }

  isMainLine(node) {
    for (let n = node; n.parent; n = n.parent) {
      if (n.parent.children[0] !== n) return false;
    }
    return true;
  }

  // For each side, the opponent's pieces already off the board in the start position (`offAtStart`)
  // and those it captured between the start and `node` (`captures`), plus the material balance on
  // the board (positive favors White).
  material(node = this.current) {
    const captures = { w: [], b: [] };
    for (let n = node; n.parent; n = n.parent) {
      if (n.captured) captures[n.color].push(n.captured);
    }
    const offAtStart = { w: missingPieces(this.startFen, "b"), b: missingPieces(this.startFen, "w") };
    for (const side of ["w", "b"]) captures[side].sort(byPieceOrder);
    let advantage = 0;
    for (const char of node.fen.split(" ")[0]) {
      const value = PIECE_VALUES[char.toLowerCase()];
      if (value) advantage += char === char.toUpperCase() ? value : -value;
    }
    return { offAtStart, captures, advantage };
  }

  // Removes `node` and everything after it.
  deleteNode(node) {
    if (!node.parent) return false;
    const siblings = node.parent.children;
    siblings.splice(siblings.indexOf(node), 1);
    if (node.parent.selected === node) node.parent.selected = null;
    for (let n = this.current; n; n = n.parent) {
      if (n === node) {
        this.current = node.parent;
        break;
      }
    }
    return true;
  }

  // Makes the line through `node` the main line at every branch point above it.
  promote(node) {
    let changed = false;
    for (let n = node; n.parent; n = n.parent) {
      const siblings = n.parent.children;
      const index = siblings.indexOf(n);
      if (index > 0) {
        siblings.splice(index, 1);
        siblings.unshift(n);
        changed = true;
      }
    }
    return changed;
  }

  // A fresh scenario whose starting position is the current one.
  branchFromCurrent() {
    const next = new Scenario(this.Chess, this.current.fen);
    next.title = this.title;
    next.orientation = this.orientation;
    next.root.annotations = this.current.annotations.slice();
    return next;
  }

  // Nodes in the order their moves appear in the encoded move string (PGN order).
  orderedNodes() {
    const out = [];
    const walk = (position) => {
      let n = position;
      while (n.children.length) {
        const [main, ...variations] = n.children;
        out.push(main);
        for (const variation of variations) {
          out.push(variation);
          walk(variation);
        }
        n = main;
      }
    };
    walk(this.root);
    return out;
  }

  encodeMoves() {
    let text = "";
    const emit = (token) => {
      const needsDot = text && token !== "(" && token !== ")" && !text.endsWith("(") && !text.endsWith(")");
      text += (needsDot ? "." : "") + token;
    };
    const walk = (position) => {
      let n = position;
      while (n.children.length) {
        const [main, ...variations] = n.children;
        emit(main.uci);
        for (const variation of variations) {
          emit("(");
          emit(variation.uci);
          walk(variation);
          emit(")");
        }
        n = main;
      }
    };
    walk(this.root);
    return text;
  }

  toHash() {
    const nodes = this.orderedNodes();
    const indexOf = new Map(nodes.map((node, i) => [node, i + 1]));
    indexOf.set(this.root, 0);
    const parts = [];
    if (this.title) parts.push("t=" + encodeURIComponent(this.title));
    if (this.orientation === "b") parts.push("o=b");
    if (this.startFen !== START_FEN) parts.push("fen=" + this.startFen.replace(/ /g, "_"));
    const moves = this.encodeMoves();
    if (moves) parts.push("m=" + moves);
    const at = indexOf.get(this.current);
    if (at) parts.push("at=" + at);
    const annotations = [this.root, ...nodes]
      .filter((node) => node.annotations.length)
      .map((node) => indexOf.get(node) + ":" + node.annotations.map(encodeAnnotation).join(","));
    if (annotations.length) parts.push("a=" + annotations.join(";"));
    return parts.length ? "#" + parts.join("&") : "";
  }

  static fromHash(Chess, hash) {
    const params = parseHash(hash);
    const fen = params.fen ? params.fen.replace(/_/g, " ") : START_FEN;
    const scenario = new Scenario(Chess, fen);
    scenario.title = params.t || "";
    scenario.orientation = params.o === "b" ? "b" : "w";
    if (params.m) scenario.decodeMoves(params.m);
    const nodes = [scenario.root, ...scenario.orderedNodes()];
    if (params.a) {
      for (const group of params.a.split(";")) {
        const [index, list = ""] = group.split(":");
        const node = nodes[Number(index)];
        if (!node) continue;
        node.annotations = list.split(",").map(decodeAnnotation).filter(Boolean);
      }
    }
    const at = nodes[Number(params.at) || 0];
    scenario.goTo(at || scenario.root);
    return scenario;
  }

  decodeMoves(text) {
    const tokens = text.replace(/\(/g, ".(.").replace(/\)/g, ".).").split(".").filter(Boolean);
    const stack = [];
    let last = this.root;
    let position = this.root;
    for (const token of tokens) {
      if (token === "(") {
        if (!last.parent) throw new Error("Variation has no move to replace");
        stack.push(last);
        position = last.parent;
      } else if (token === ")") {
        if (!stack.length) throw new Error("Unbalanced ')' in moves");
        last = stack.pop();
        position = last;
      } else {
        if (!MOVE_TOKEN.test(token)) throw new Error(`Bad move "${token}"`);
        const node = this.addMove(position, token);
        if (!node) throw new Error(`Illegal move "${token}"`);
        last = node;
        position = node;
      }
    }
    if (stack.length) throw new Error("Unbalanced '(' in moves");
  }

  toPgn() {
    const headers = [];
    if (this.title) headers.push(`[Event "${this.title.replace(/"/g, "'")}"]`);
    if (this.startFen !== START_FEN) headers.push(`[SetUp "1"]`, `[FEN "${this.startFen}"]`);
    const tokens = [];
    const label = (node, forceNumber) => {
      const [, turn, , , , fullmove] = node.parent.fen.split(" ");
      if (turn === "w") return `${fullmove}. ${node.san}`;
      return forceNumber ? `${fullmove}... ${node.san}` : node.san;
    };
    const walk = (position, forceFirst) => {
      let n = position;
      let force = forceFirst;
      while (n.children.length) {
        const [main, ...variations] = n.children;
        tokens.push(label(main, force));
        force = false;
        for (const variation of variations) {
          tokens.push("(" + label(variation, true));
          walk(variation, false);
          tokens[tokens.length - 1] += ")";
          force = true;
        }
        n = main;
      }
    };
    walk(this.root, true);
    tokens.push("*");
    return (headers.length ? headers.join("\n") + "\n\n" : "") + tokens.join(" ");
  }
}

function byPieceOrder(x, y) {
  return PIECE_ORDER.indexOf(x) - PIECE_ORDER.indexOf(y);
}

// Pieces of `color` missing from a full set in `fen`. Extra queens, rooks, and so on are promoted
// pawns, so each one counts against the pawns instead.
function missingPieces(fen, color) {
  const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const char of fen.split(" ")[0]) {
    const type = char.toLowerCase();
    const isColor = color === "w" ? char !== type : char === type;
    if (isColor && type in counts) counts[type]++;
  }
  const missing = [];
  let promoted = 0;
  for (const type of "nbrq") {
    promoted += Math.max(0, counts[type] - FULL_SET[type]);
    for (let i = counts[type]; i < FULL_SET[type]; i++) missing.push(type);
  }
  for (let i = counts.p + promoted; i < FULL_SET.p; i++) missing.push("p");
  return missing.sort(byPieceOrder);
}

function encodeAnnotation(annotation) {
  return annotation.color + annotation.from + (annotation.to || "");
}

function decodeAnnotation(text) {
  const color = text[0];
  const from = text.slice(1, 3);
  const to = text.slice(3, 5);
  if (!ANNOTATION_COLORS[color] || !SQUARE.test(from)) return null;
  if (!to) return { color, from };
  return SQUARE.test(to) ? { color, from, to } : null;
}

export function parseHash(hash) {
  const params = {};
  for (const part of hash.replace(/^#/, "").split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? "" : part.slice(eq + 1);
    try {
      params[key] = decodeURIComponent(value);
    } catch {
      params[key] = value;
    }
  }
  return params;
}
