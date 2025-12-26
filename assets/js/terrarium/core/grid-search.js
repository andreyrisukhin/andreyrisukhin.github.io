// assets/js/terrarium/core/grid-search.js
export function expandGrid(paramGrid) {
  const entries = Object.entries(paramGrid);
  if (entries.length === 0) return [];
  const results = [];

  function walk(index, acc) {
    if (index === entries.length) {
      results.push({ ...acc });
      return;
    }
    const [key, values] = entries[index];
    for (const value of values) {
      acc[key] = value;
      walk(index + 1, acc);
    }
  }

  walk(0, {});
  return results;
}

export function summarizePopulation(samples) {
  const n = samples.length;
  if (!n) {
    return { mean: 0, stddev: 0, min: 0, max: 0, final: 0, cv: 0, trend: 0 };
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of samples) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let variance = 0;
  for (const v of samples) {
    variance += (v - mean) * (v - mean);
  }
  variance /= n;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 0;
  const final = samples[n - 1];
  const trend = n > 1 ? (samples[n - 1] - samples[0]) / (n - 1) : 0;
  return { mean, stddev, min, max, final, cv, trend };
}

export function runGridSearch({
  createSimulation,
  paramGrid,
  steps = 6000,
  dt = 1 / 60,
  sampleEvery = 60,
  minPopulation = 2,
  stableCv = 0.2,
  variableCv = 0.45,
  scoreFn,
  captureSeries = false,
}) {
  const combos = expandGrid(paramGrid);
  const results = [];

  for (const params of combos) {
    const sim = createSimulation(params);
    const samples = [];
    const foodSamples = captureSeries ? [] : null;
    for (let i = 0; i < steps; i++) {
      sim.step(dt);
      if (i % sampleEvery === 0) {
        samples.push(sim.getPopulation());
        if (captureSeries && typeof sim.getFoodCount === "function") {
          foodSamples.push(sim.getFoodCount());
        }
      }
    }
    const metrics = summarizePopulation(samples);
    const survives = metrics.final >= minPopulation;
    const stable = survives && metrics.cv <= stableCv;
    const variable = survives && metrics.cv >= variableCv;
    const score = scoreFn ? scoreFn({ params, metrics }) : metrics.mean;
    const entry = { params, metrics, survives, stable, variable, score };
    if (captureSeries) {
      entry.series = { herb: samples, food: foodSamples || [] };
    }
    results.push(entry);
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
