#!/usr/bin/env python3
"""Compare the local Prison Blues data against the supplied MusicXML, not a retyped fixture."""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "_scripts" / "fixtures" / "prison-blues-bassline.mxl"
with zipfile.ZipFile(source) as archive:
    container = ET.fromstring(archive.read("META-INF/container.xml"))
    score_path = next(e.attrib["full-path"] for e in container.iter() if e.tag.endswith("rootfile"))
    score = ET.fromstring(archive.read(score_path))
measures = score.findall("part/measure")
attributes = measures[0].find("attributes")
divisions = int(attributes.findtext("divisions"))
steps = []
for measure in measures:
    ticks = 0
    chord = None
    for element in measure:
        if element.tag == "harmony":
            name = element.findtext("root/root-step")
            alt = int(element.findtext("root/root-alter", "0"))
            chord = name + ("b" if alt == -1 else "#" if alt == 1 else "") + ("m" if element.findtext("kind") == "minor" else "")
        if element.tag != "note" or element.findtext("staff") != "2":
            continue
        assert element.findtext("voice") == "5"
        duration = int(element.findtext("duration")) * 12 / divisions
        assert duration.is_integer()
        note = []
        pitch = element.find("pitch")
        if pitch is not None:
            letter = pitch.findtext("step")
            alt = int(pitch.findtext("alter", "0"))
            octave = int(pitch.findtext("octave"))
            note = [{"midi": (octave + 1) * 12 + dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)[letter] + alt,
                     "name": letter + ("b" if alt == -1 else "#" if alt == 1 else "")}]
        if element.find("chord") is not None:
            assert steps[-1]["ticks"] == duration
            steps[-1]["notes"].extend(note)
        else:
            step = {"ticks": int(duration), "presses": [], "notes": note}
            if chord:
                step["chord"] = chord
                chord = None
            steps.append(step)
            ticks += duration
    assert ticks == 36, f"Measure {measure.attrib['number']} is not six eighths"
data = json.loads((root / "_data/bass_patterns/prison_blues.json").read_text())
assert data["steps"] == steps, "Notes, octaves, rests, durations, or chord labels differ from MusicXML"
assert data["meter"] == [int(attributes.findtext("time/beats")), int(attributes.findtext("time/beat-type"))]
assert data["keyFifths"] == int(attributes.findtext("key/fifths"))
assert data["repeat"] == (measures[-1].find("barline/repeat").attrib["direction"] == "backward")
assert all(n.find("rest") is not None for n in score.findall(".//note") if n.findtext("staff") == "1")
print(f"PASS MusicXML fidelity: {len(measures)} bars, {len(steps)} steps, exact pitches/rests/rhythm/chords/key/repeat")
