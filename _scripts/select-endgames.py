"""Read the Lichess CC0 puzzle CSV on stdin; emit the static trainer bank."""
import csv
import json
import sys
from collections import defaultdict

motifs = (
    "underPromotion advancedPawn promotion skewer fork pin discoveredAttack "
    "deflection attraction sacrifice zugzwang clearance interference "
    "backRankMate smotheredMate mateIn2 mateIn3 mateIn1"
).split()
groups = defaultdict(list)
seen = set()
for row in csv.DictReader(sys.stdin):
    themes = (row["Themes"] or "").split()
    if "endgame" not in themes or not {"mate", "crushing"}.intersection(themes):
        continue
    fen, line = row["FEN"], row["Moves"].split()
    if sum(c.isalpha() for c in fen.split()[0]) > 9 or len(line) > 8 or int(row["Popularity"]) < 85:
        continue
    key = (fen.split()[0], line[0])
    motif = next((m for m in motifs if m in themes), None)
    if motif and key not in seen:
        groups[motif].append(dict(id=row["PuzzleId"], fen=fen, moves=row["Moves"], motif=motif, rating=int(row["Rating"])))
        seen.add(key)

# Round-robin across motifs so that common tactics don't crowd out rare ones.
deck = []
for index in range(max(map(len, groups.values()))):
    deck.extend(group[index] for group in groups.values() if index < len(group))
    if len(deck) >= 1000:
        break
assert len(deck) >= 1000, "Need a larger CSV sample"
json.dump(sorted(deck[:1000], key=lambda p: p["rating"] // 150), sys.stdout, separators=(",", ":"))
