const assert = require("node:assert/strict");
const deck = require("../assets/js/chess/endgames.json");

(async () => {
  const { Attempt, schedule, nextPuzzle } = await import("../assets/js/chess/endgame-session.js");
  assert.equal(deck.length, 1000);
  assert.equal(new Set(deck.map((p) => p.id)).size, deck.length);
  const starts = new Set();
  for (const puzzle of deck) {
    const a = new Attempt(puzzle);
    starts.add(a.game.fen().split(" ").slice(0, 4).join(" "));
    while (a.index < a.line.length) {
      const resumed = new Attempt(puzzle, { index: a.index, helped: true });
      assert.equal(resumed.game.fen(), a.game.fen());
      assert.equal(resumed.helped, true);
      const result = a.play(a.line[a.index]);
      assert.equal(result, a.index === a.line.length ? "complete" : "continue", puzzle.id);
    }
  }
  assert.equal(starts.size, deck.length);

  const a = new Attempt(deck[0]);
  const before = a.game.fen();
  assert.equal(a.play("not a move"), "illegal");
  const other = a.game.moves({ verbose: true }).find((m) => m.lan !== a.line[1] && !m.san.endsWith("#"));
  assert.equal(a.play(other.lan), "retry");
  assert.equal(a.game.fen(), before);
  assert.equal(a.helped, true);

  const first = deck[0].id;
  const records = { [first]: schedule(null, false, 0) };
  assert.equal(records[first].solved, false);
  assert.equal(nextPuzzle(deck, records, 599999), deck[1]);
  assert.equal(nextPuzzle(deck, records, 600000), deck[0]);
  const clean = schedule(records[first], true, 0);
  assert.equal(clean.solved, true);
  assert.equal(clean.due, 86400000);
  assert.equal(schedule(clean, true, 0).due, 3 * 86400000);
  assert.equal(schedule(clean, false, 0).streak, 0);
  assert.equal(nextPuzzle([deck[0]], records, 0), undefined);
  console.log("Verified 1,000 distinct positions, every move and resume point, retries, and spaced reviews.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
