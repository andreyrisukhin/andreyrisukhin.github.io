// assets/js/terrarium/core/scene-registry.js
const scenes = new Map();

export function registerScenes(list) {
  for (const scene of list) {
    if (!scene?.id) {
      throw new Error("Scene must have an id.");
    }
    scenes.set(scene.id, scene);
  }
}

export function getScene(id) {
  if (!id) return null;
  return scenes.get(id) || null;
}
