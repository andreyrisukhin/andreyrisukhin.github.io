#!/usr/bin/env node
// Measure page load and theme-switch KPIs for the built site and log them per commit.
//
// Usage: node bin/site-kpi.mjs [--runs 5] [--site _site] [--log FILE] [--label TEXT] [path ...]
//
// Serves the built site on an ephemeral loopback port, opens each page in a
// fresh agent-browser session (cold cache) at 1440 x 900, and records:
//   load_ms    load event end
//   ready_ms   the page's "ready" mark (sheet pages: first score render), else load
//   lcp_ms     largest contentful paint
//   theme_ms   light -> dark until every theme transition has finished
//   theme_max_frame_ms  longest frame during that switch (jank)
// Medians over --runs go to stdout and append to the log as JSON lines with the
// commit, so results can be compared across commits. Build the site first.
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const runs = Number(opt("--runs", 5));
const site = resolve(opt("--site", "_site"));
const log = opt("--log", process.env.SITE_KPI_LOG || join(homedir(), "data/site-kpi/kpi.jsonl"));
const label = opt("--label", "");
const pages = args.length ? args : ["/music/", "/music/sheet/senorita/", "/"];

if (!existsSync(join(site, "index.html"))) {
  console.error(`No built site at ${site}. Run the production Jekyll build first.`);
  process.exit(2);
}

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".musicxml": "application/xml",
  ".mxl": "application/octet-stream",
  ".mp3": "audio/mpeg",
};
const server = createServer((req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(site, path);
  if (!file.startsWith(site)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

// Runs in the page. Waits for load and the ready signal, then times a theme switch.
const probe = String.raw`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  while (document.readyState !== "complete") await sleep(10);
  const nav = performance.getEntriesByType("navigation")[0];
  let ready = performance.getEntriesByName("site:ready")[0]?.startTime;
  if (ready === undefined && document.getElementById("osmd-container")) {
    for (let i = 0; i < 1500 && !document.querySelector("#osmd-container svg"); i++) await sleep(10);
    ready = performance.now();
  }
  const lcp = await new Promise((done) => {
    let last = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => (last = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => done(last), 50);
  });
  const resources = performance.getEntriesByType("resource");
  const bytes = resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0);
  const external = resources.filter((r) => !r.name.startsWith(location.origin)).length;

  const frame = () => new Promise((r) => requestAnimationFrame(r));
  setThemeSetting("light", false);
  await frame(); await frame(); await sleep(300);
  // A view transition's animations only exist after its update callback runs, so
  // capture the transition itself and wait on its finished promise.
  let transition;
  const startViewTransition = document.startViewTransition;
  if (startViewTransition) document.startViewTransition = (cb) => (transition = startViewTransition.call(document, cb));
  const start = performance.now();
  let previous = start, maxFrame = 0;
  setThemeSetting("dark");
  let settled = !transition;
  transition?.finished.finally(() => (settled = true));
  // Covers both the old per-element transitions and view-transition cross-fades.
  const busy = () => !settled || document.documentElement.classList.contains("transition") ||
    document.getAnimations().some((a) => a.playState !== "finished" && (a instanceof CSSTransition || String(a.effect?.pseudoElement).startsWith("::view-transition")));
  do {
    const now = await frame();
    maxFrame = Math.max(maxFrame, now - previous);
    previous = now;
  } while (busy() && performance.now() - start < 5000);
  const themeMs = performance.now() - start;
  setThemeSetting("system", false);
  return JSON.stringify({
    load_ms: nav.loadEventEnd, ready_ms: ready ?? nav.loadEventEnd, lcp_ms: lcp,
    theme_ms: themeMs, theme_max_frame_ms: maxFrame,
    requests: resources.length, external_requests: external, kb: bytes / 1024,
    elements: document.getElementsByTagName("*").length,
  });
})()`;

// Async on purpose: a synchronous child would block this process's own server.
const ab = (session, ...cmd) =>
  new Promise((ok, fail) => {
    const child = spawn("agent-browser", ["--session", session, ...cmd]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(`agent-browser ${cmd[0]} failed: ${err || out}`))));
    child.stdin.end(cmd[0] === "eval" ? probe : undefined);
  });

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const git = (...a) => {
  try {
    return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
const commit = git("rev-parse", "--short", "HEAD");
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";

const results = [];
try {
  for (const path of pages) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const session = `site-kpi-${process.pid}-${i}`;
      try {
        await ab(session, "set", "viewport", "1440", "900");
        await ab(session, "open", base + path);
        const out = (await ab(session, "eval", "--stdin")).trim();
        samples.push(JSON.parse(JSON.parse(out)));
      } finally {
        try {
          await ab(session, "close");
        } catch {}
      }
    }
    const row = { page: path };
    for (const key of Object.keys(samples[0])) row[key] = Math.round(median(samples.map((s) => s[key])));
    results.push(row);
  }
} finally {
  server.close();
}

const stamp = new Date().toISOString();
mkdirSync(dirname(log), { recursive: true });
for (const row of results) {
  appendFileSync(log, JSON.stringify({ at: stamp, commit, dirty, subject, label, runs, ...row }) + "\n");
}

// Compare with the most recent earlier entry for each page from another commit or label.
const history = readFileSync(log, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const keys = ["load_ms", "ready_ms", "lcp_ms", "theme_ms", "theme_max_frame_ms", "requests", "kb"];
console.log(`commit ${commit}${dirty ? " (dirty)" : ""}${label ? ` [${label}]` : ""}, median of ${runs}, log ${log}`);
for (const row of results) {
  const prior = history
    .filter((h) => h.page === row.page && h.at !== stamp && (h.commit !== commit || h.label !== label || h.dirty !== dirty))
    .at(-1);
  const cells = keys.map((k) => {
    const delta = prior && prior[k] !== undefined ? row[k] - prior[k] : null;
    return `${k}=${row[k]}${delta === null || delta === 0 ? "" : ` (${delta > 0 ? "+" : ""}${delta})`}`;
  });
  console.log(`${row.page}\n  ${cells.join("  ")}${prior ? `\n  vs ${prior.commit}${prior.label ? ` [${prior.label}]` : ""}` : ""}`);
}
