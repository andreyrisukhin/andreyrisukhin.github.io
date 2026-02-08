# Golem Demo

Rust + Bevy wasm demo that renders into the canvas on `/golem-demo/`.
Starter stack matches a 2D maze platformer with tile collisions and edit/play.

## Develop

Prereqs: Rust toolchain + `wasm-pack`.

From the repo root:

```bash
wasm-pack build games/golem-demo \
  --release \
  --target web \
  --out-dir ../../assets/wasm/golem-demo
```

Then serve the site (Docker or `jekyll serve`) and open `/golem-demo/`.

## Controls

- `WASD`: move player (play mode)
- `Tab`: toggle edit/play
- `Left Click`: toggle wall tile (edit mode)
- `E`: export level to console (edit mode)

## Files and responsibilities

Core runtime (Rust):
- `games/golem-demo/src/lib.rs`: wasm entry point and app setup.
- `games/golem-demo/src/constants.rs`: tile size + physics scale.
- `games/golem-demo/src/level.rs`: grid data, ASCII import/export.
- `games/golem-demo/src/world.rs`: spawns tile walls + border colliders.
- `games/golem-demo/src/player.rs`: player entity + movement (kinematic).
- `games/golem-demo/src/editor.rs`: edit mode tile toggling + export.
- `games/golem-demo/src/mode.rs`: edit/play mode switching.

Web glue:
- `_pages/golem-demo.md`: page layout + canvas.
- `assets/js/golem-demo/main.js`: JS loader for wasm.
- `assets/wasm/golem-demo/`: wasm-pack output (built files).

## Structure guidance

Keep gameplay, collisions, and world logic in `games/golem-demo/src/`.
Keep web-only bootstrapping in `assets/js/golem-demo/main.js` and layout in
`_pages/golem-demo.md`.

## Planned growth (LDtk + slopes)

- Add `assets/levels/golem.ldtk` and load it in a new `ldtk` module.
- Collisions: IntGrid layer values map to collider shapes.
  - `0`: empty
  - `1`: solid block
  - `10`: slope up-right (/)
  - `11`: slope up-left (\)
- Merge rectangles for solids, keep per-tile triangle colliders for slopes.
