#!/usr/bin/env node
// Quick CLI chord checker using the repo's Tonal.js
// Usage: node chord-check.js B F# B C# D# F#

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/assets/js/vendor/tonal.min.js', 'utf8');
var Tonal = new Function(code + '; return Tonal;')();

var notes = process.argv.slice(2);
if (notes.length === 0) {
  console.log('Usage: node chord-check.js <notes...>');
  console.log('Example: node chord-check.js B F# B C# D# F#');
  process.exit(0);
}

// Deduplicate pitch classes, preserve order
var seen = {};
var unique = [];
notes.forEach(function (n) {
  var chroma = Tonal.Note.chroma(n);
  if (chroma !== undefined && !seen[chroma]) {
    seen[chroma] = true;
    unique.push(n);
  }
});

console.log('Notes: ' + notes.join(' '));
console.log('Unique: ' + unique.join(' '));

var detected = Tonal.Chord.detect(unique);
if (detected.length > 0) {
  console.log('Chord: ' + detected[0]);
  if (detected.length > 1) console.log('Also:  ' + detected.slice(1).join(', '));
} else {
  console.log('Chord: ?');
  // Try subsets
  if (unique.length >= 3) {
    var found = false;
    var seenChords = {};
    for (var i = 0; i < unique.length; i++) {
      var subset = unique.filter(function (_, j) { return j !== i; });
      var sub = Tonal.Chord.detect(subset);
      var novel = sub.filter(function (c) { return !seenChords[c]; });
      novel.forEach(function (c) { seenChords[c] = true; });
      if (novel.length > 0) {
        if (!found) { console.log('Subsets:'); found = true; }
        console.log('  ' + novel.join(', ') + '  (without ' + unique[i] + ')');
      }
    }
  }
}
