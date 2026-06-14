/* Music Assistant service worker.
 * Scope: /music/. Other routes pass through to the network.
 * Cache key embeds the Jekyll build time so each rebuild invalidates the
 * precache; the browser refetches sw.js on every PWA launch and the new
 * SW takes over after the user closes all open windows or accepts the
 * "new version available" prompt surfaced by pwa.liquid.
 */

const VERSION = '1781413961';
const CACHE_STATIC = 'music-pwa-static-' + VERSION;
const CACHE_RUNTIME = 'music-pwa-runtime-' + VERSION;

const PRECACHE_URLS = [
  '/music/',
  '/music/build/',
  '/music/blues/',
  '/music/chord-recognizer/',
  '/music/stradella/',
  '/music/exercises/',
  '/music/chords/',
  '/music/intervals/',
  '/music/songs/',
  '/music/sheet/cogwork-dancers/',

  '/manifest.webmanifest',
  '/assets/img/pwa/icon-192.png',
  '/assets/img/pwa/icon-512.png',
  '/assets/img/pwa/apple-touch-icon-180.png',

  '/assets/js/vendor/tonal.min.js',
  '/assets/js/vendor/soundfont-player.min.js',
  '/assets/js/vendor/opensheetmusicdisplay.min.js',

  '/assets/js/music/common.js',
  '/assets/js/music/chord-name.js',
  '/assets/js/music/stradella-data.js',
  '/assets/js/music/stradella-recipe.js',

  '/assets/js/blues/main.js',
  '/assets/js/chord-recognizer/main.js',
  '/assets/js/stradella/main.js',
  '/assets/js/music-build/main.js',
  '/assets/js/music-exercises/main.js',
  '/assets/js/music-songs/main.js',
  '/assets/js/music-songs/sync.js',

  '/assets/js/sheet-music/osmd-bridge.js',
  '/assets/js/sheet-music/chord-inspector.js',
  '/assets/js/sheet-music/stradella-overlay.js',
  '/assets/js/sheet-music/dev-annotator.css',

  '/assets/css/main.css',
];

const RUNTIME_CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'gleitz.github.io',
];

const ANALYTICS_HOSTS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'rum.cronitor.io',
  'api.pirsch.io',
  'openpanel.dev',
  'd1bxh8uas1mnw7.cloudfront.net',
  'badge.dimensions.ai',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache
            .add(new Request(url, { cache: 'reload' }))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('music-pwa-') && k !== CACHE_STATIC && k !== CACHE_RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isMusicScope(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/music/');
}

function isPrecached(url) {
  return url.origin === self.location.origin && PRECACHE_URLS.includes(url.pathname);
}

function isMusicAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/assets/js/music/') ||
    url.pathname.startsWith('/assets/js/blues/') ||
    url.pathname.startsWith('/assets/js/chord-recognizer/') ||
    url.pathname.startsWith('/assets/js/stradella/') ||
    url.pathname.startsWith('/assets/js/music-build/') ||
    url.pathname.startsWith('/assets/js/music-exercises/') ||
    url.pathname.startsWith('/assets/js/sheet-music/') ||
    url.pathname.startsWith('/assets/js/vendor/') ||
    url.pathname.startsWith('/assets/music/') ||
    url.pathname.startsWith('/assets/img/pwa/')
  );
}

function isRuntimeCdn(url) {
  return RUNTIME_CDN_HOSTS.includes(url.host);
}

function isAnalytics(url) {
  return ANALYTICS_HOSTS.includes(url.host);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/music/');
      if (fallback) return fallback;
    }
    throw _;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    cache.put(request, fresh.clone()).catch(() => undefined);
  }
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (isAnalytics(url)) return;

  if (req.mode === 'navigate') {
    if (isMusicScope(url)) {
      event.respondWith(networkFirst(req));
    }
    return;
  }

  if (isPrecached(url) || url.pathname === '/assets/css/main.css') {
    event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
    return;
  }

  if (isMusicAsset(url)) {
    if (url.pathname.startsWith('/assets/js/vendor/') || url.pathname.startsWith('/assets/img/pwa/')) {
      event.respondWith(cacheFirst(req, CACHE_STATIC));
    } else {
      event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
    }
    return;
  }

  if (isRuntimeCdn(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
    return;
  }
});
