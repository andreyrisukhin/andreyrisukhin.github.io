// node _scripts/chess-scenario-test.js
// The chess modules are ES modules in a package without "type": "module", so copy them into a temp package to import them.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chess-scenario-"));
fs.mkdirSync(path.join(tmp, "vendor/chess.js"), { recursive: true });
fs.mkdirSync(path.join(tmp, "chess"));
fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
fs.copyFileSync(path.join(root, "assets/js/vendor/chess.js/chess.js"), path.join(tmp, "vendor/chess.js/chess.js"));
fs.copyFileSync(path.join(root, "assets/js/chess/scenario.js"), path.join(tmp, "chess/scenario.js"));

(async () => {
  const { Chess } = await import(path.join(tmp, "vendor/chess.js/chess.js"));
  const { Scenario, START_FEN } = await import(path.join(tmp, "chess/scenario.js"));
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed++;
    console.log("ok -", name);
  };

  check("plays legal moves and rejects illegal ones", () => {
    const s = new Scenario(Chess);
    assert.equal(s.play("e2e4").san, "e4");
    assert.equal(s.play({ from: "e7", to: "e5" }).san, "e5");
    assert.equal(s.play("e1e3"), null);
    assert.equal(s.ply(), 2);
  });

  check("a different move after stepping back becomes a branch, and forward follows the last route", () => {
    const s = new Scenario(Chess);
    s.play("e2e4");
    s.play("e7e5");
    s.play("g1f3");
    s.back();
    s.back();
    s.play("c7c5");
    const e4 = s.root.children[0];
    assert.deepEqual(
      e4.children.map((n) => n.san),
      ["e5", "c5"]
    );
    s.back();
    s.forward();
    assert.equal(s.current.san, "c5");
    assert.equal(s.isMainLine(s.current), false);
    s.play("g1f3");
    s.toStart();
    s.toEnd();
    assert.equal(s.current.san, "Nf3");
    assert.equal(s.current.parent.san, "c5");
  });

  check("replaying an existing move reuses its node", () => {
    const s = new Scenario(Chess);
    s.play("e2e4");
    s.back();
    s.play("e2e4");
    assert.equal(s.root.children.length, 1);
  });

  check("hash round-trips moves, variations, position, title, and annotations", () => {
    const s = new Scenario(Chess);
    s.title = "Sicilian & friends";
    s.play("e2e4");
    s.play("e7e5");
    s.play("g1f3");
    s.back();
    s.back();
    s.play("c7c5");
    s.play("g1f3");
    s.current.annotations = [
      { color: "g", from: "d7", to: "d6" },
      { color: "r", from: "d4" },
    ];
    s.root.annotations = [{ color: "b", from: "e2", to: "e4" }];
    const hash = s.toHash();
    assert.equal(hash, "#t=Sicilian%20%26%20friends&m=e2e4.e7e5(c7c5.g1f3)g1f3&at=4&a=0:be2e4;4:gd7d6,rd4");
    const copy = Scenario.fromHash(Chess, hash);
    assert.equal(copy.title, "Sicilian & friends");
    assert.equal(copy.current.san, "Nf3");
    assert.equal(copy.current.parent.san, "c5");
    assert.deepEqual(copy.current.annotations, s.current.annotations);
    assert.deepEqual(copy.root.annotations, s.root.annotations);
    assert.equal(copy.toHash(), hash);
  });

  check("nested variations survive encoding", () => {
    const moves = "e2e4.e7e5(c7c5.g1f3(b1c3.b8c6)d7d6)g1f3.b8c6";
    const s = Scenario.fromHash(Chess, "#m=" + moves);
    assert.equal(s.encodeMoves(), moves);
    assert.equal(s.toPgn(), "1. e4 e5 (1... c5 2. Nf3 (2. Nc3 Nc6) 2... d6) 2. Nf3 Nc6 *");
  });

  check("custom start positions and promotions", () => {
    const fen = "8/P5k1/8/8/8/8/6K1/8 w - - 0 1";
    const s = new Scenario(Chess, fen);
    assert.equal(s.play({ from: "a7", to: "a8", promotion: "n" }).san, "a8=N");
    const hash = s.toHash();
    assert.equal(hash, "#fen=8/P5k1/8/8/8/8/6K1/8_w_-_-_0_1&m=a7a8n&at=1");
    const copy = Scenario.fromHash(Chess, hash);
    assert.equal(copy.startFen, fen);
    assert.equal(copy.current.uci, "a7a8n");
    assert.match(copy.toPgn(), /\[FEN "8\/P5k1\/8\/8\/8\/8\/6K1\/8 w - - 0 1"\]\n\n1\. a8=N \*/);
  });

  check("bad hashes throw instead of loading half a scenario", () => {
    assert.throws(() => Scenario.fromHash(Chess, "#m=e2e5"), /Illegal move/);
    assert.throws(() => Scenario.fromHash(Chess, "#m=e2e4("), /Unbalanced/);
    assert.throws(() => Scenario.fromHash(Chess, "#fen=not_a_fen"));
  });

  check("delete and promote keep the cursor valid", () => {
    const s = Scenario.fromHash(Chess, "#m=e2e4.e7e5(c7c5.g1f3)g1f3&at=4");
    assert.equal(s.current.san, "Nf3");
    const c5 = s.current.parent;
    s.promote(c5);
    assert.equal(s.encodeMoves(), "e2e4.c7c5(e7e5.g1f3)g1f3");
    s.deleteNode(c5);
    assert.equal(s.current.san, "e4");
    assert.equal(s.encodeMoves(), "e2e4.e7e5.g1f3");
  });

  check("branching from the current position starts a new scenario there", () => {
    const s = Scenario.fromHash(Chess, "#t=Line&m=e2e4.e7e5&at=2");
    s.orientation = "b";
    assert.match(s.toHash(), /^#t=Line&o=b&m=/);
    const next = s.branchFromCurrent();
    assert.equal(next.orientation, "b");
    assert.equal(next.startFen, s.current.fen);
    assert.equal(next.title, "Line");
    assert.equal(next.root.children.length, 0);
    assert.notEqual(next.startFen, START_FEN);
  });

  check("material tracks captures along the current line and the point balance", () => {
    const s = Scenario.fromHash(Chess, "#m=e2e4.d7d5.e4d5.d8d5.b1c3.d5a2.a1a2&at=7");
    assert.deepEqual(s.material(), { captures: { w: ["p", "q"], b: ["p", "p"] }, advantage: 8 });
    s.back();
    assert.deepEqual(s.material(), { captures: { w: ["p"], b: ["p", "p"] }, advantage: -1 });
    assert.deepEqual(new Scenario(Chess).material(), { captures: { w: [], b: [] }, advantage: 0 });
    const promoted = Scenario.fromHash(Chess, "#fen=1r4k1/P7/8/8/8/8/8/6K1_w_-_-_0_1&m=a7b8q&at=1");
    assert.deepEqual(promoted.material(), { captures: { w: ["r"], b: [] }, advantage: 9 });
    const custom = Scenario.fromHash(Chess, "#fen=r4rk1/3n1pp1/p4n1p/2pP1Q2/P1B1p3/q7/1bPB1PPP/1R3RK1_b_-_-_0_1");
    assert.equal(custom.material().advantage, -3);
  });

  check("page examples load", () => {
    const page = fs.readFileSync(path.join(root, "_pages/chess.md"), "utf8");
    const hashes = [...page.matchAll(/href="\{\{ '\/chess\/' \| relative_url \}\}(#[^"]+)"/g)].map((m) => m[1]);
    assert.ok(hashes.length >= 2, "page has example links");
    for (const hash of hashes) {
      const s = Scenario.fromHash(Chess, hash.replace(/&amp;/g, "&"));
      assert.equal(s.toHash(), hash.replace(/&amp;/g, "&"), "example hash is canonical: " + hash);
    }
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${passed} chess scenario checks passed`);
})().catch((error) => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
