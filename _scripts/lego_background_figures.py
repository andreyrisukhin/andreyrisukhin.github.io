"""Create CPU-only illustrations for the retrospective LEGO recognition post.

The transform illustration runs the supplied evaluation function on current
renders. It does not load a model or recreate historical predictions. Chart
values are read from the supplied project logbook, not entered independently.
"""

import argparse
import ast
import base64
import hashlib
import html
import io
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def label(x, y, text, size=22, anchor="start", bold=False, color="#222222"):
    return (
        f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" '
        f'font-weight="{700 if bold else 400}" fill="{color}">'
        f"{html.escape(text)}</text>"
    )


def svg(width, height, title, description, elements):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" font-family="Arial, Helvetica, sans-serif">'
        f"<title>{html.escape(title)}</title><desc>{html.escape(description)}</desc>"
        f'<rect width="{width}" height="{height}" fill="#FFFFFF"/>'
        + "".join(elements)
        + "</svg>"
    )


def embedded_image(array, x, y, size=300):
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG")
    data = base64.b64encode(buffer.getvalue()).decode()
    return (
        f'<image x="{x}" y="{y}" width="{size}" height="{size}" '
        f'href="data:image/png;base64,{data}"/>'
    )


def logbook_values(text):
    section = text.split("## 2026-04-14 (late)", 1)[1].split("\n## ", 1)[0]
    values = {}
    for line in section.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip().replace("**", "") for c in line.strip("|").split("|")]
        if cells[0] in {"clean", "white_bg", "blue_bg", "edge_overlay"}:
            values[cells[0]] = [float(c.strip("%")) for c in cells[1:]]
    assert len(values) == 4 and all(len(row) == 4 for row in values.values())
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render-dir", type=Path, required=True)
    parser.add_argument("--evaluation-script", type=Path, required=True)
    parser.add_argument("--logbook", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "assets/img/posts/lego-background",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    source = args.evaluation_script.read_text()
    function = next(
        node for node in ast.parse(source).body
        if isinstance(node, ast.FunctionDef) and node.name == "replace_bg_with_white"
    )
    # Compile only this CPU image transform, not the evaluator's model imports.
    namespace = {"np": np, "cv2": cv2}
    exec(compile(ast.Module(body=[function], type_ignores=[]), "<transform>", "exec"), namespace)
    transform = namespace["replace_bg_with_white"]

    elements = [
        label(245, 35, "Rendered view", 24, "middle", True),
        label(755, 35, "White-background transform", 24, "middle", True),
    ]
    evidence = []
    for filename, y, name in [("c4_v0.png", 65, "Red"), ("c71_v0.png", 430, "Gray")]:
        path = args.render_dir / filename
        original = np.array(Image.open(path).convert("RGB"))
        result = transform(original)
        assert result.shape == original.shape and result.dtype == original.dtype
        assert not np.shares_memory(original, result)
        gray = cv2.cvtColor(original, cv2.COLOR_RGB2GRAY)
        background = int(np.median([gray[0, 0], gray[0, -1], gray[-1, 0], gray[-1, -1]]))
        mask = np.abs(gray.astype(int) - background) < 35
        assert np.array_equal(result[~mask], original[~mask])
        assert np.all(result[mask] == 255)
        elements += [
            embedded_image(original, 95, y),
            embedded_image(result, 605, y),
            f'<path d="M455,{y+150} H540 m-9,-6 l9,6 -9,6" fill="none" stroke="#555555" stroke-width="2"/>',
            label(500, y + 326, f"{name} 2×4 brick · part 3001", 20, "middle"),
        ]
        evidence.append(
            {
                "source_image": f"3001/{filename}",
                "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "changed_pixels": int(np.any(original != result, axis=2).sum()),
                "total_pixels": int(mask.size),
            }
        )
    elements.append(label(500, 800, "Recreated transformation; no model predictions shown.", 19, "middle", color="#555555"))
    (args.output_dir / "background-transform.svg").write_text(
        svg(1000, 820, "What the white-background transform changes",
            "Current red and gray 2×4 brick renders before and after the evaluation function. "
            "The threshold can replace foreground pixels as well as background pixels. No predictions are shown.",
            elements)
    )

    values = logbook_values(args.logbook.read_text())
    chart = [
        label(20, 35, "Targeted augmentation helps on synthetic transforms", 26, bold=True),
        label(20, 73, "Top-1 accuracy (%)", 20, color="#555555"),
        '<rect x="588" y="57" width="20" height="16" fill="#777777"/>',
        label(618, 72, "Baseline (v2)", 19),
        '<rect x="788" y="57" width="20" height="16" fill="#146C94"/>',
        label(818, 72, "Targeted (v5)", 19),
    ]
    for tick in range(0, 101, 20):
        x = 285 + 6.2*tick
        chart.append(f'<path d="M{x},115 V520" stroke="#DDDDDD" stroke-width="1"/>')
        chart.append(label(x, 551, str(tick), 18, "middle", color="#555555"))
    for index, (key, name) in enumerate([
        ("clean", "Clean render"), ("white_bg", "White background"),
        ("blue_bg", "Light-blue background"), ("edge_overlay", "Edge overlay"),
    ]):
        y = 140 + index*105
        chart.append(label(20, y+28, name, 21))
        for value, offset, color in [(values[key][0], 0, "#777777"), (values[key][3], 29, "#146C94")]:
            width = 6.2*value
            chart.append(f'<rect x="285" y="{y+offset}" width="{width}" height="22" fill="{color}"/>')
            chart.append(label(285+width+8, y+offset+18, f"{value:g}%", 20))
    chart.append(label(20, 587, "Replotted from the April 14, 2026 logbook. These are not real-photo results.", 18, color="#555555"))
    (args.output_dir / "augmentation-results.svg").write_text(
        svg(1000, 610, "Baseline and targeted-augmentation recognition scores",
            "Top-1 accuracies: clean renders 95 versus 92 percent; white background 2 versus 61; "
            "light-blue background 1 versus 59; edge overlay 8 versus 87. Values come from the April 14 logbook.",
            chart)
    )
    (args.output_dir / "figure-provenance.json").write_text(
        json.dumps({
            "figure_kind": "recreated CPU transform illustration and replot, not model inference",
            "transform_source_sha256": hashlib.sha256(source.encode()).hexdigest(),
            "logbook_sha256": hashlib.sha256(args.logbook.read_bytes()).hexdigest(),
            "opencv_version": cv2.__version__,
            "numpy_version": np.__version__,
            "source_images": evidence,
            "logbook_values": values,
        }, indent=2) + "\n"
    )
    print(json.dumps({"output_dir": str(args.output_dir), "illustration_sources": evidence, "chart_values": values}, indent=2))


if __name__ == "__main__":
    main()
