import { Chess } from "../vendor/chess.js/chess.js";

const day = 86400000;
const intervals = [1, 3, 7, 14, 30, 60];

export function schedule(old, clean, now) {
  const streak = clean ? Math.min((old?.streak || 0) + 1, intervals.length) : 0;
  return { solved: clean || Boolean(old?.solved), streak, due: now + (clean ? intervals[streak - 1] * day : 10 * 60000) };
}

export function nextPuzzle(deck, records, now) {
  const due = deck.filter((p) => records[p.id]?.due <= now);
  return due.sort((a, b) => records[a.id].due - records[b.id].due)[0] || deck.find((p) => !records[p.id]);
}

export class Attempt {
  constructor(puzzle, saved) {
    this.game = new Chess(puzzle.fen);
    this.line = puzzle.moves.split(" ");
    this.game.move(this.line[0]); // Opponent's last move, not the first answer.
    this.side = this.game.turn();
    this.index = 1;
    this.helped = Boolean(saved?.helped);
    while (this.index + 1 < this.line.length && this.index < (saved?.index || 1)) {
      this.game.move(this.line[this.index++]);
      this.game.move(this.line[this.index++]);
    }
  }

  play(input) {
    let move;
    try {
      move = this.game.move(input);
    } catch {
      return "illegal";
    }
    if (!this.game.isCheckmate() && move.lan !== this.line[this.index]) {
      this.game.undo();
      this.helped = true;
      return "retry";
    }
    this.index++;
    if (this.game.isCheckmate() || this.index === this.line.length) return "complete";
    this.game.move(this.line[this.index++]);
    return "continue";
  }
}
