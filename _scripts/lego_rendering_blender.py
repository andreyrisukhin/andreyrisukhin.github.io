"""Run inside Blender to reproduce rendering failure modes, not historical runs.

Uses the saved two-piece assembly and actual LDraw library surfaces. CPU only.
The four outputs differ only in per-piece boxes, color encoding, or reflection.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import itertools
import json
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


PALETTE = {4: (196, 0, 38), 1: (0, 85, 191)}
VARIANTS = {
    "detailed": {"boxes": False, "wrong_color": False, "reflected": False},
    "boxes": {"boxes": True, "wrong_color": False, "reflected": False},
    "wrong-color": {"boxes": False, "wrong_color": True, "reflected": False},
    "reflected": {"boxes": False, "wrong_color": False, "reflected": True},
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def records(path):
    return [line.split() for line in path.read_text(encoding="latin-1").splitlines()]


def reference(fields):
    numbers = list(map(float, fields[2:14]))
    matrix = Matrix((
        (*numbers[3:6], numbers[0]),
        (*numbers[6:9], numbers[1]),
        (*numbers[9:12], numbers[2]),
        (0, 0, 0, 1),
    ))
    return " ".join(fields[14:]).replace("\\", "/").lower(), matrix


def library_path(root, name):
    for directory in ["parts", "p"]:
        candidate = root / directory / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Unresolved LDraw reference: {name}")


def resolve(root, name, transform, inherited, sources, depth=0):
    if depth > 30:
        raise ValueError(f"LDraw recursion too deep: {name}")
    path = library_path(root, name)
    sources.add(path)
    faces = []
    for fields in records(path):
        if not fields or fields[0] not in {"1", "3", "4"}:
            continue
        color = int(fields[1])
        if color in {16, -1}:
            color = inherited
        if fields[0] == "1":
            child, matrix = reference(fields)
            faces.extend(resolve(root, child, transform @ matrix, color, sources, depth + 1))
        else:
            values = list(map(float, fields[2:]))
            vertices = [
                transform @ Vector(values[i:i + 3])
                for i in range(0, len(values), 3)
            ]
            faces.append((color, vertices))
    # Edge-only primitives legitimately contain no renderable surfaces.
    if not faces and depth == 0:
        raise ValueError(f"No surfaces resolved for {name}")
    return faces


def srgb_to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def material(code, wrong_color):
    rgb = [channel / 255 for channel in PALETTE[code]]
    if not wrong_color:
        rgb = [srgb_to_linear(channel) for channel in rgb]
    mat = bpy.data.materials.new(f"LDraw_{code}")
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = 0.3
    shader.inputs["Specular IOR Level"].default_value = 0.5
    shader.inputs["Coat Weight"].default_value = 0.1
    return mat


def geometry(pieces, variant, center):
    materials = {code: material(code, variant["wrong_color"]) for code in PALETTE}
    for index, (code, source_faces) in enumerate(pieces):
        vertices, faces = [], []
        for face_code, points in source_faces:
            if face_code != code:
                raise ValueError("Unexpected fixed-color surface in these plain parts")
            start = len(vertices)
            for point in points:
                x, y, z = Vector((point.x, point.z, -point.y)) - center
                vertices.append((x * 0.02, (-y if variant["reflected"] else y) * 0.02, z * 0.02))
            faces.append(tuple(range(start, len(vertices))))
        if variant["boxes"]:
            low = [min(v[axis] for v in vertices) for axis in range(3)]
            high = [max(v[axis] for v in vertices) for axis in range(3)]
            vertices = list(itertools.product(*zip(low, high)))
            faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                     (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        mesh = bpy.data.meshes.new(f"part_{index}")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(f"part_{index}", mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[code])


def scene_setup():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 128
    scene.cycles.seed = 0
    # This system Blender build has no CPU OpenImageDenoise support.
    scene.cycles.use_denoising = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.7, 0.7, 0.7, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    bpy.ops.object.light_add(type="AREA", location=(2, -3, 4))
    light = bpy.context.object
    light.data.energy = 180
    light.data.shape = "DISK"
    light.data.size = 4
    light.rotation_euler = (Vector((0, 0, 0.2)) - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(3.2, -4.5, 3))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 0.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.1
    scene.camera = camera
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--assembly", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    sources = set()
    pieces = []
    for fields in records(args.assembly):
        if fields and fields[0] == "1":
            name, transform = reference(fields)
            code = int(fields[1])
            pieces.append((code, resolve(args.library, name, transform, code, sources)))
    if len(pieces) != 2:
        raise ValueError("Expected the saved two-piece assembly")
    all_points = [
        Vector((point.x, point.z, -point.y))
        for _, faces in pieces for _, points in faces for point in points
    ]
    center = Vector((
        (min(p.x for p in all_points) + max(p.x for p in all_points)) / 2,
        (min(p.y for p in all_points) + max(p.y for p in all_points)) / 2,
        0,
    ))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}
    for name, variant in VARIANTS.items():
        scene = scene_setup()
        geometry(pieces, variant, center)
        path = args.output_dir / f"{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs[path.name] = sha256(path)
    dependencies = {}
    for path in sorted(sources):
        headers = path.read_text(encoding="latin-1").splitlines()
        dependencies[path.relative_to(args.library).as_posix()] = {
            "sha256": sha256(path),
            "credits": [line for line in headers if line.startswith(("0 Author:", "0 !LICENSE"))],
        }
    manifest = {
        "kind": "New Blender reproductions, not archived March 31 experiment images",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "renderer": "Cycles",
        "device": "CPU",
        "threads": 4,
        "samples": 128,
        "denoising": False,
        "seed": 0,
        "resolution": [800, 600],
        "view_transform": "Standard",
        "palette_srgb": PALETTE,
        "assembly_source": "lego commit 35e2284:artifacts/overfit_real/gt.ldr",
        "assembly_sha256": sha256(args.assembly),
        "renderer_script_sha256": sha256(Path(__file__)),
        "variants": VARIANTS,
        "controls": "Same camera, lighting, palette, sample seed, exposure, and display transform in all four renders",
        "geometry_note": "Current LDraw library geometry, not the original Studio-embedded mesh; box variant uses each resolved part's bounding box",
        "surface_counts": [len(faces) for _, faces in pieces],
        "ldraw_sources": dependencies,
        "raw_images": outputs,
    }
    (args.output_dir / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
