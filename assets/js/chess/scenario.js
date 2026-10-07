// Move tree for a chess scenario, plus its URL-hash and PGN encodings.
// Kept free of DOM code so _scripts/chess-scenario-test.js can run it in Node.

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// One letter per annotation color in the URL; the values match cm-chessboard's RightClickAnnotator keys.
export const ANNOTATION_COLORS = { g: "success", b: "info", r: "danger", o: "warning" };

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_ORDER = "pnbrq";
const FULL_SET = { p: 8, n: 2, b: 2, r: 2, q: 1 };
// Variations are wrapped in "_" ... "~" in links. Messaging apps end a link at "(" or ")", which the
// first version of the format used, so those are still read but no longer written.
const OPEN = "_";
const CLOSE = "~";
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
  // `move` is a UCI string ("e2e4"), {from, to, promotion}, or {san: "Nf3"}.
  addMove(parent, move) {
    const game = new this.Chess(parent.fen);
    let result;
    try {
      if (move.san) {
        result = game.move(move.san, { strict: false });
      } else {
        const uci = typeof move === "string" ? move : move.from + move.to + (move.promotion || "");
        result = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      }
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
      const marker = (t) => t === OPEN || t === CLOSE;
      const needsDot = text && !marker(token) && !marker(text[text.length - 1]);
      text += (needsDot ? "." : "") + token;
    };
    const walk = (position) => {
      let n = position;
      while (n.children.length) {
        const [main, ...variations] = n.children;
        emit(main.uci);
        for (const variation of variations) {
          emit(OPEN);
          emit(variation.uci);
          walk(variation);
          emit(CLOSE);
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

  // With `lenient`, a damaged move list (usually a link cut short by a messaging app) loads as far
  // as it reads cleanly and the problem is left in `loadWarning` instead of throwing.
  static fromHash(Chess, hash, { lenient = false } = {}) {
    const params = parseHash(hash);
    const fen = params.fen ? params.fen.replace(/_/g, " ") : START_FEN;
    const scenario = new Scenario(Chess, fen);
    scenario.title = params.t || "";
    scenario.orientation = params.o === "b" ? "b" : "w";
    scenario.loadWarning = null;
    if (params.m) {
      try {
        scenario.decodeMoves(params.m);
      } catch (error) {
        if (!lenient) throw error;
        scenario.loadWarning = error.message;
      }
    }
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

  // Builds a scenario from one PGN game: header tags, SAN moves, ( ) variations, { } and ; comments,
  // NAGs, and Lichess [%cal]/[%csl] arrows and circles inside comments. Comment text, clocks, and
  // engine scores are dropped. Throws with the move number on an illegal or unreadable move.
  static fromPgn(Chess, text) {
    const headers = {};
    const movetext = text.replace(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm, (line, key, value) => {
      headers[key] = value.replace(/\\(.)/g, "$1");
      return "";
    });
    let scenario;
    try {
      scenario = new Scenario(Chess, headers.FEN || START_FEN);
    } catch {
      throw new Error(`The game's starting position (FEN tag) is not valid: ${headers.FEN}`);
    }
    scenario.title = pgnTitle(headers);
    const stack = [];
    let last = scenario.root;
    let position = scenario.root;
    for (const [token] of movetext.matchAll(PGN_TOKEN)) {
      if (token[0] === "{" || token[0] === ";") {
        last.annotations.push(...pgnAnnotations(token));
      } else if (token === "(") {
        if (!last.parent) throw new Error("A variation starts before any move.");
        stack.push(last);
        position = last.parent;
      } else if (token === ")") {
        if (!stack.length) throw new Error("A variation ends that never started.");
        last = stack.pop();
        position = last;
      } else if (/^\$\d+$|^\d+\.+$|^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
        continue;
      } else {
        const san = token
          .replace(/^\d+\.+/, "")
          .replace(/0/g, "O")
          .replace(/e\.p\.$/, "")
          .replace(/[!?]+$/, "");
        if (!san) continue;
        const node = scenario.addMove(position, { san });
        if (!node) {
          const [, turn, , , , fullmove] = position.fen.split(" ");
          throw new Error(`Move ${fullmove}${turn === "w" ? "." : "..."} ${token} is not legal in that position.`);
        }
        last = node;
        position = node;
      }
    }
    if (stack.length) throw new Error("A variation never ends; the PGN may be cut off.");
    return scenario;
  }

  // Moves read before an error stay in the tree, so a lenient caller keeps everything up to it.
  decodeMoves(text) {
    const tokens = text.replace(/[(_]/g, ".(.").replace(/[)~]/g, ".).").split(".").filter(Boolean);
    const stack = [];
    let last = this.root;
    let position = this.root;
    for (const token of tokens) {
      if (token === "(") {
        if (!last.parent) throw new Error("Variation has no move to replace");
        stack.push(last);
        position = last.parent;
      } else if (token === ")") {
        if (!stack.length) throw new Error("Unbalanced variation end in moves");
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
    if (stack.length) throw new Error("Unbalanced variation start in moves");
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

// Comments, parentheses, NAGs, move numbers (possibly glued to the move, as in "1.e4"), then words.
const PGN_TOKEN = /\{[^}]*\}?|;[^\n]*|[()]|\$\d+|\d+\.+|[^\s(){};]+/g;
const PGN_COLORS = { G: "g", R: "r", B: "b", Y: "o" };

// Splits a PGN file into one string per game. A tag line after some movetext starts the next game.
export function splitPgnGames(text) {
  const games = [];
  let lines = [];
  let sawMoves = false;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const isTag = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isTag && sawMoves) {
      games.push(lines.join("\n"));
      lines = [];
      sawMoves = false;
    }
    if (!isTag && line.trim()) sawMoves = true;
    lines.push(line);
  }
  if (lines.some((line) => line.trim())) games.push(lines.join("\n"));
  return games;
}

// Header tags of one PGN game, for listing games before choosing one.
export function pgnHeaders(text) {
  const headers = {};
  for (const [, key, value] of text.matchAll(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
    headers[key] = value.replace(/\\(.)/g, "$1");
  }
  return headers;
}

export function pgnTitle(headers) {
  const known = (value) => value && value !== "?" && !/^\?+$/.test(value);
  if (known(headers.White) && known(headers.Black)) return `${headers.White} vs ${headers.Black}`;
  return known(headers.Event) ? headers.Event : "";
}

function pgnAnnotations(comment) {
  const out = [];
  for (const [, list] of comment.matchAll(/\[%cal\s+([^\]]*)\]/g)) {
    for (const item of list.split(",")) {
      const match = /^([GRBY])([a-h][1-8])([a-h][1-8])$/.exec(item.trim());
      if (match) out.push({ color: PGN_COLORS[match[1]], from: match[2], to: match[3] });
    }
  }
  for (const [, list] of comment.matchAll(/\[%csl\s+([^\]]*)\]/g)) {
    for (const item of list.split(",")) {
      const match = /^([GRBY])([a-h][1-8])$/.exec(item.trim());
      if (match) out.push({ color: PGN_COLORS[match[1]], from: match[2] });
    }
  }
  return out;
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
