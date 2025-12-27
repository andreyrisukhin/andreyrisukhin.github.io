# Terrarium

This page hosts interactive 2D simulations (particles, creatures, etc.) with a simple scene
registry and a shared render loop. Scenes are plain ES modules under `assets/js/terrarium/`.

## Run locally

1. Start the Jekyll dev server (per the repo README).
2. Visit `/terrarium/` or `/terrarium/?scene=particles`.

## Add a new scene

1. Create a scene module in `assets/js/terrarium/scenes/`.
2. Export a scene object with the lifecycle methods below.
3. Register the scene in `assets/js/terrarium/main.js`.
4. Add a button in `/_pages/terrarium.md` (optional but recommended).

### Scene contract

```js
export const myScene = {
  id: "my-scene",
  init({ canvas, ctx, size, dpr }) {},
  update(dt, { w, h }) {},
  render({ w, h }) {},
  destroy() {},
};
```

Notes:

- `init` is called when the scene becomes active.
- `update` runs at a fixed timestep (currently 120 Hz).
- `render` is called every frame.
- `destroy` should remove event listeners or release resources.

## Add a new simulation type

Use the same scene contract for different simulation styles (particles, boids, fluids, etc.).
If the simulation requires shared utilities, place them in `assets/js/terrarium/core/` or
create a local helper module in `assets/js/terrarium/scenes/`.

## Scene registry

Register scenes in `assets/js/terrarium/main.js`:

```js
import { myScene } from "./scenes/my-scene.js";

registerScenes([particlesScene, creaturesScene, myScene]);
```

## URL selection

You can link directly to a scene:

```
/terrarium/?scene=my-scene
```

## Parameter grid search (terminal)

Run grid search from the terminal using the Node script:

```bash
node _scripts/terrarium-grid-search.js
```

Optional flags:

```bash
node _scripts/terrarium-grid-search.js \
  --hungerRate=0.03,0.04,0.05 \
  --vision=200,240,280 \
  --foodSpawnChance=0.06,0.08,0.1 \
  --reproCooldown=16,20,24 \
  --lifespan=120,160,200 \
  --maxSpeed=100,120,140 \
  --steps=12000 \
  --sampleEvery=60 \
  --minPopulation=1 \
  --top=10
```

## Contributing guidelines

- Keep scenes self-contained and stateless outside their module.
- Cap particle counts or entity counts to avoid unbounded performance degradation.
- Prefer deterministic or seedable randomness for reproducible results.
- Clean up listeners and timers in `destroy()`.
