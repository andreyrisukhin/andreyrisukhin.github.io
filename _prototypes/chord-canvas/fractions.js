window.ChordFractions = (function () {
  "use strict";
  function make(n, d) {
    n = BigInt(n);
    d = BigInt(d);
    if (d === 0n) throw new RangeError("Zero denominator");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    var a = n < 0n ? -n : n,
      b = d;
    while (b) {
      var r = a % b;
      a = b;
      b = r;
    }
    return { n: String(n / a), d: String(d / a) };
  }
  function add(a, b) {
    return make(BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d));
  }
  function sub(a, b) {
    return add(a, make(-BigInt(b.n), b.d));
  }
  function mul(a, b) {
    return make(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
  }
  function div(a, b) {
    return make(BigInt(a.n) * BigInt(b.d), BigInt(a.d) * BigInt(b.n));
  }
  function compare(a, b) {
    var delta = BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d);
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  }
  function text(a) {
    return a.d === "1" ? a.n : a.n + "/" + a.d;
  }
  function number(a) {
    var sign = a.n[0] === "-" ? -1 : 1,
      n = a.n.replace("-", ""),
      d = a.d;
    var first = n.slice(0, 15),
      second = d.slice(0, 15);
    return ((sign * Number(first)) / Number(second)) * Math.pow(10, n.length - first.length - d.length + second.length);
  }
  function parse(value) {
    var match = String(value)
      .trim()
      .match(/^(\d{1,9})(?:\/(\d{1,9}))?$/);
    if (!match || BigInt(match[1]) === 0n || (match[2] && BigInt(match[2]) === 0n)) return null;
    return make(match[1], match[2] || 1);
  }
  function weights(value) {
    var parts = String(value).trim().split(":");
    if (parts.length === 1) {
      if (!/^\d+$/.test(parts[0])) return null;
      var count = Number(parts[0]);
      if (count < 2 || count > 64) return null;
      return Array.from({ length: count }, function () {
        return make(1, count);
      });
    }
    if (parts.length > 64) return null;
    var values = parts.map(parse);
    if (
      values.some(function (v) {
        return !v;
      })
    )
      return null;
    var sum = values.reduce(add, make(0, 1));
    return values.map(function (v) {
      return div(v, sum);
    });
  }
  function snap(value) {
    value = Math.max(1 / 64, Math.min(63 / 64, value));
    var best = make(1, 2),
      distance = Infinity;
    [2, 3, 4, 5, 6, 7, 8, 12, 16, 24, 32, 64].forEach(function (denominator) {
      var numerator = Math.max(1, Math.min(denominator - 1, Math.round(value * denominator)));
      var delta = Math.abs(value - numerator / denominator);
      if (delta < distance - 1e-10) {
        distance = delta;
        best = make(numerator, denominator);
      }
    });
    return best;
  }
  return {
    make: make,
    add: add,
    sub: sub,
    mul: mul,
    div: div,
    compare: compare,
    text: text,
    number: number,
    parse: parse,
    weights: weights,
    snap: snap,
  };
})();
