"""Generate CPU-only schematics, not historical LEGO render captures.

Run with --check to verify that the checked-in SVGs match this source.
Only the Python standard library is required.
"""

import argparse
import html
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "assets/img/posts/2026-lego-rendering"
INK = "#343331"
RED = (196, 0, 38)
BLUE = (0, 85, 191)


def text(x, y, value, size=28, bold=False):
    return (
        f'<text x="{x}" y="{y}" font-size="{size}" '
        f'font-weight="{700 if bold else 400}" fill="{INK}">'
        f"{html.escape(value)}</text>"
    )


def polygon(points, fill):
    coords = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    return (
        f'<polygon points="{coords}" fill="{fill}" '
        f'stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'
    )


def color(rgb, shade=1):
    return "#" + "".join(f"{round(c * shade):02x}" for c in rgb)


def project(x, y, z):
    return 42 * (x - y), 22 * (x + y) - 34 * z


def block(x, y, z, width, depth, height, rgb):
    a, b, c, d = [
        project(*p)
        for p in [
            (x, y, z + height),
            (x + width, y, z + height),
            (x + width, y + depth, z + height),
            (x, y + depth, z + height),
        ]
    ]
    bottom = [
        project(*p)
        for p in [
            (x + width, y, z),
            (x + width, y + depth, z),
            (x, y + depth, z),
        ]
    ]
    return (
        polygon([b, bottom[0], bottom[1], c], color(rgb, 0.65))
        + polygon([d, c, bottom[1], bottom[2]], color(rgb, 0.82))
        + polygon([a, b, c, d], color(rgb))
    )


def studs(x, y, z, width, depth, rgb):
    result = []
    for j in range(depth):
        for i in range(width):
            cx, cy = project(x + i + 0.5, y + j + 0.5, z)
            result.append(
                f'<path d="M {cx - 12} {cy - 5} v 6 '
                f'a 12 6 0 0 0 24 0 v -6" fill="{color(rgb, 0.82)}" '
                f'stroke="{INK}" stroke-width="1.5"/>'
                f'<ellipse cx="{cx}" cy="{cy - 5}" rx="12" ry="6" '
                f'fill="{color(rgb)}" stroke="{INK}" stroke-width="1.5"/>'
            )
    return "".join(result)


def assembly(with_studs):
    # The blue 1×3 brick occupies the back row of the red 2×3 plate.
    return (
        block(0, 0, 0, 3, 2, 0.4, RED)
        + (studs(0, 1, 0.4, 3, 1, RED) if with_studs else "")
        + block(0, 0, 0.4, 3, 1, 1.2, BLUE)
        + (studs(0, 0, 1.6, 3, 1, BLUE) if with_studs else "")
    )


def svg(height, title, description, elements):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="960" '
        f'height="{height}" viewBox="0 0 960 {height}" '
        'font-family="Nunito Sans, DejaVu Sans, sans-serif">\n'
        f"<title>{html.escape(title)}</title>\n"
        f"<desc>{html.escape(description)}</desc>\n"
        f'<rect width="960" height="{height}" rx="12" fill="#FFFCF0"/>\n'
        + "\n".join(elements)
        + "\n</svg>\n"
    )


def boxes_figure():
    return svg(
        350,
        "Boxes omit the studs",
        "Schematic matched views of a blue 1×3 brick on a red 2×3 plate. "
        "Not archived images or an extracted Studio mesh.",
        [
            text(32, 44, "BOX APPROXIMATION", bold=True),
            text(512, 44, "WITH STUDS", bold=True),
            f'<g transform="translate(212 155)">{assembly(False)}</g>',
            f'<g transform="translate(692 155)">{assembly(True)}</g>',
            text(32, 322, "Schematic · same assembly, scale, and view", size=25),
        ],
    )


def linear_to_srgb(channel):
    return (
        12.92 * channel
        if channel <= 0.0031308
        else 1.055 * channel ** (1 / 2.4) - 0.055
    )


def wrong_color(rgb):
    return tuple(round(255 * linear_to_srgb(c / 255)) for c in rgb)


def swatches(x, y, wrong):
    elements = []
    for index, rgb in enumerate([RED, BLUE]):
        fill = color(wrong_color(rgb) if wrong else rgb)
        elements.append(
            f'<rect x="{x + index * 122}" y="{y}" width="104" height="66" '
            f'rx="8" fill="{fill}" stroke="{INK}" stroke-width="1.5"/>'
        )
    return "".join(elements)


def asymmetric_shape():
    # A marked, asymmetric top view makes a left/right reflection legible.
    return (
        polygon([(0, 0), (72, 0), (72, 72), (144, 72), (144, 144), (0, 144)], color(BLUE))
        + f'<circle cx="112" cy="112" r="18" fill="#FFC857" stroke="{INK}" stroke-width="2"/>'
    )


def bugs_figure():
    return svg(
        660,
        "Color encoding and reflection are separate bugs",
        "Schematic before-and-after comparisons. Swatches illustrate only "
        "the sRGB encoding error, without lighting or tone mapping. A yellow "
        "marker changes sides on a reflected L-shaped assembly.",
        [
            text(32, 44, "BEFORE", bold=True),
            text(512, 44, "AFTER", bold=True),
            text(32, 102, "Color encoding", bold=True),
            text(32, 142, "sRGB used as linear", size=26),
            text(512, 142, "Converted to linear", size=26),
            swatches(32, 170, wrong=True),
            swatches(512, 170, wrong=False),
            text(32, 282, "Palette swatches only; no lighting or tone mapping", size=25),
            '<path d="M 32 316 H 928" stroke="#DAD8CE" stroke-width="2"/>',
            text(32, 366, "Coordinate conversion", bold=True),
            text(32, 406, "Reflection", size=26),
            text(512, 406, "No reflection", size=26),
            f'<g transform="translate(192 430) scale(-1 1)">{asymmetric_shape()}</g>',
            f'<g transform="translate(528 430)">{asymmetric_shape()}</g>',
            text(32, 626, "Schematic · the yellow marker makes the reflection visible", size=25),
        ],
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    figures = {
        "boxes-and-studs.svg": boxes_figure(),
        "color-and-reflection.svg": bugs_figure(),
    }
    if not args.check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, body in figures.items():
        path = OUTPUT / name
        if args.check:
            if path.read_text(encoding="utf-8") != body:
                raise SystemExit(f"Figure differs from generator: {path}")
            print(f"OK: {name}")
        else:
            path.write_text(body, encoding="utf-8")
            print(path)


if __name__ == "__main__":
    main()
