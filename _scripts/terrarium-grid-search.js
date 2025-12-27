#!/usr/bin/env node
import { runGridSearch } from "../assets/js/terrarium/core/grid-search.js";
import { createHerbavoresSimulation } from "../assets/js/terrarium/scenes/herbavores.js";

function parseList(value, parser = Number) {
  if (!value) return null;
  return value
    .split(",")
    .map((v) => parser(v.trim()))
    .filter((v) => !Number.isNaN(v));
}

const args = Object.fromEntries(
  process.argv.slice(2).map((pair) => {
    const [key, val] = pair.split("=");
    return [key.replace(/^--/, ""), val ?? true];
  })
);

const paramGrid = {
  hungerRate: parseList(args.hungerRate) || [0.03, 0.04, 0.05],
  vision: parseList(args.vision) || [200, 240, 280],
  foodSpawnChance: parseList(args.foodSpawnChance) || [0.06, 0.08, 0.1],
  reproCooldown: parseList(args.reproCooldown) || [16, 20, 24],
  lifespan: parseList(args.lifespan) || [120, 160, 200],
  maxSpeed: parseList(args.maxSpeed) || [100, 120, 140],
};

const steps = Number(args.steps || 12000);
const sampleEvery = Number(args.sampleEvery || 60);
const minPopulation = Number(args.minPopulation || 1);

const results = runGridSearch({
  createSimulation: (params) => createHerbavoresSimulation({ params }),
  paramGrid,
  steps,
  sampleEvery,
  minPopulation,
});

const survivors = results.filter((r) => r.metrics.final > 0);
const top = Number(args.top || 10);

console.log(`Total combos: ${results.length}`);
console.log(`Survivors: ${survivors.length}`);
console.log("");
console.log(
  survivors.slice(0, top).map((r) => ({
    params: r.params,
    final: r.metrics.final,
    mean: Number(r.metrics.mean.toFixed(2)),
    cv: Number(r.metrics.cv.toFixed(2)),
  }))
);
