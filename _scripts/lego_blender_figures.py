"""Assemble unmodified Blender PNGs into labeled comparisons, or verify them.

Render first with lego_rendering_blender.py inside CPU-only Blender.
Requires Pillow for composition/checking, not for the Blender render itself.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/img/posts/2026-lego-rendering"
PAIRS = {
    "boxes-and-studs.png": [("boxes", "Per-piece bounding boxes"), ("detailed", "LDraw part geometry")],
    "color-comparison.png": [("wrong-color", "sRGB used as linear"), ("detailed", "Converted to linear")],
    "reflection-comparison.png": [("reflected", "Reflection"), ("detailed", "Rotation without reflection")],
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compare_images(name, pairs, check):
    canvas = Image.new("RGB", (1600, 664), "#fffcf0")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    for index, (source, label) in enumerate(pairs):
        with Image.open(OUTPUT / "blender" / f"{source}.png") as raw:
            if raw.size != (800, 600):
                raise ValueError(f"Unexpected render dimensions: {source}")
            canvas.paste(raw.convert("RGB"), (index * 800, 64))
        draw.text((index * 800 + 24, 14), label, font=font, fill="#343331")
    path = OUTPUT / name
    if check:
        with Image.open(path) as saved:
            if ImageChops.difference(canvas, saved.convert("RGB")).getbbox():
                raise ValueError(f"Composite differs from raw Blender pixels: {name}")
    else:
        canvas.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    manifest_path = OUTPUT / "blender/provenance.json"
    manifest = json.loads(manifest_path.read_text())
    for name, digest in manifest["raw_images"].items():
        if sha256(manifest_path.parent / name) != digest:
            raise ValueError(f"Raw render hash differs: {name}")
    if sha256(ROOT / "_scripts/fixtures/lego-rendering/two-piece.ldr") != manifest["assembly_sha256"]:
        raise ValueError("Assembly differs from rendered input")
    if sha256(ROOT / "_scripts/lego_rendering_blender.py") != manifest["renderer_script_sha256"]:
        raise ValueError("Renderer differs from rendered source")
    for name, pairs in PAIRS.items():
        compare_images(name, pairs, args.check)
        print(f"{'Verified' if args.check else 'Wrote'} {name}")


if __name__ == "__main__":
    main()
