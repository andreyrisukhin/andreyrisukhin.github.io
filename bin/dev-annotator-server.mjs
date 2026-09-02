#!/usr/bin/env node
/*
 * Sidecar HTTP server for the sheet-music dev annotator.
 *
 * Receives pin writes from the annotator in the browser and persists
 * them to `<repo>/.dev-annotations/<slug>.json`. No external deps;
 * Node 18+ built-ins only.
 *
 * Endpoints:
 *   GET  /health
 *   POST /save               body: {pathname, pins}
 *   GET  /load?pathname=/music/sheet/cogwork-dancers/
 *   POST /save-trail         body: {slug, name, center, zoom, pins, segments}
 *                            -> commits to _data/zion-paths/<slug>.json
 *   GET  /load-trail?slug=dry-river-walk
 *                            -> reads from _data/zion-paths/<slug>.json
 *
 * CORS: allows http://localhost:4000 and http://127.0.0.1:4000.
 *
 * Usage:
 *   node bin/dev-annotator-server.mjs
 *   ANNOTATOR_PORT=4001 ANNOTATOR_ROOT=/path/to/repo node bin/dev-annotator-server.mjs
 */

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.ANNOTATOR_ROOT
  ? path.resolve(process.env.ANNOTATOR_ROOT)
  : path.resolve(__dirname, '..');
const STORE_DIR = path.join(REPO_ROOT, '.dev-annotations');
const TRAILS_DIR = path.join(REPO_ROOT, '_data', 'zion-paths');
const TRAIL_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const PORT = Number(process.env.ANNOTATOR_PORT || 4001);
const ALLOWED_ORIGINS = new Set([
  'http://localhost:4000',
  'http://127.0.0.1:4000',
]);
const MAX_BODY_BYTES = 25 * 1024 * 1024;

function slugForPathname(pathname) {
  const trimmed = String(pathname || '').replace(/^\/+|\/+$/g, '');
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return safe || 'root';
}

function pathFor(pathname) {
  return path.join(STORE_DIR, slugForPathname(pathname) + '.json');
}

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:4000';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function send(res, status, body, extra = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extra,
  });
  res.end(payload);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleSave(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return send(res, 400, { ok: false, error: 'invalid JSON: ' + err.message }, corsHeaders(req));
  }
  const { pathname, pins } = body || {};
  if (typeof pathname !== 'string' || !Array.isArray(pins)) {
    return send(res, 400, { ok: false, error: 'expected { pathname: string, pins: array }' }, corsHeaders(req));
  }
  await fs.mkdir(STORE_DIR, { recursive: true });
  const outPath = pathFor(pathname);
  const record = {
    pathname,
    updatedAt: new Date().toISOString(),
    pinCount: pins.length,
    pins,
  };
  await fs.writeFile(outPath, JSON.stringify(record, null, 2), 'utf8');
  console.log('[annotator] saved', pins.length, 'pin(s) for', pathname, '→', path.relative(REPO_ROOT, outPath));
  send(res, 200, { ok: true, path: path.relative(REPO_ROOT, outPath) }, corsHeaders(req));
}

async function handleLoad(req, res, url) {
  const pathname = url.searchParams.get('pathname');
  if (!pathname) {
    return send(res, 400, { ok: false, error: 'missing ?pathname=' }, corsHeaders(req));
  }
  const filePath = pathFor(pathname);
  try {
    const text = await fs.readFile(filePath, 'utf8');
    send(res, 200, JSON.parse(text), corsHeaders(req));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return send(res, 200, { pathname, pins: [] }, corsHeaders(req));
    }
    send(res, 500, { ok: false, error: err.message }, corsHeaders(req));
  }
}

async function handleSaveTrail(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch (err) { return send(res, 400, { ok: false, error: 'invalid JSON: ' + err.message }, corsHeaders(req)); }
  const { slug, name, center, zoom, pins, segments } = body || {};
  if (typeof slug !== 'string' || !TRAIL_SLUG_RE.test(slug)) {
    return send(res, 400, { ok: false, error: 'invalid slug (lowercase a-z, 0-9, -)' }, corsHeaders(req));
  }
  if (!Array.isArray(pins) || !Array.isArray(segments)) {
    return send(res, 400, { ok: false, error: 'expected pins[] and segments[]' }, corsHeaders(req));
  }
  await fs.mkdir(TRAILS_DIR, { recursive: true });
  const outPath = path.join(TRAILS_DIR, slug + '.json');
  const record = {
    slug,
    name: typeof name === 'string' ? name : slug,
    updatedAt: new Date().toISOString(),
    center: center && typeof center === 'object' ? center : null,
    zoom: typeof zoom === 'number' ? zoom : null,
    pins,
    segments,
  };
  await fs.writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log('[trail] saved', pins.length, 'pin(s)', segments.length, 'segment(s) for', slug, '->', path.relative(REPO_ROOT, outPath));
  send(res, 200, { ok: true, path: path.relative(REPO_ROOT, outPath) }, corsHeaders(req));
}

async function handleLoadTrail(req, res, url) {
  const slug = url.searchParams.get('slug');
  if (!slug || !TRAIL_SLUG_RE.test(slug)) {
    return send(res, 400, { ok: false, error: 'missing or invalid ?slug=' }, corsHeaders(req));
  }
  const filePath = path.join(TRAILS_DIR, slug + '.json');
  try {
    const text = await fs.readFile(filePath, 'utf8');
    send(res, 200, JSON.parse(text), corsHeaders(req));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return send(res, 200, { slug, name: slug, pins: [], segments: [], center: null, zoom: null }, corsHeaders(req));
    }
    send(res, 500, { ok: false, error: err.message }, corsHeaders(req));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, root: STORE_DIR, trails: TRAILS_DIR }, corsHeaders(req));
    }
    if (req.method === 'POST' && url.pathname === '/save') return handleSave(req, res);
    if (req.method === 'GET' && url.pathname === '/load') return handleLoad(req, res, url);
    if (req.method === 'POST' && url.pathname === '/save-trail') return handleSaveTrail(req, res);
    if (req.method === 'GET' && url.pathname === '/load-trail') return handleLoadTrail(req, res, url);
    send(res, 404, { ok: false, error: 'not found' }, corsHeaders(req));
  } catch (err) {
    console.error('[annotator] error', err);
    send(res, 500, { ok: false, error: err.message }, corsHeaders(req));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[annotator] listening on http://127.0.0.1:' + PORT);
  console.log('[annotator] store:', STORE_DIR);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
