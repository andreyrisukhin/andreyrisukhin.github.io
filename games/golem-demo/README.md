# Golem Demo

Rust + Bevy wasm demo that renders into the canvas on `/golem-demo/`.

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

## Edit

Main entry: `games/golem-demo/src/lib.rs`.
Static assets: `assets/wasm/golem-demo/` and `assets/js/golem-demo/main.js`.
