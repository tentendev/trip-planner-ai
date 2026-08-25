/*
 * Trip OS service worker - versioned runtime cache (bump CACHE_NAME on deploy).
 *
 * Strategy:
 *  - install: precache nothing. Asset filenames are content-hashed at build
 *    time and unknowable here, so everything is runtime-cached instead.
 *  - navigation requests: network-first with a ~3s timeout, falling back to
 *    the last cached index.html when the network is slow or absent.
 *  - same-origin GETs under /assets/: stale-while-revalidate (cache first,
 *    refresh in the background for next time).
 *  - /api/*: never intercepted or cached - always live network, fails as such.
 *  - activate: delete caches left by older versions, then take control.
 */

const CACHE_NAME = 'trip-os-v1';
const NAVIGATION_TIMEOUT_MS = 3000;

const OFFLINE_HTML = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<title>Trip OS - Offline</title>',
  '<style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;',
  'background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
  'text-align:center;padding:24px}main{max-width:320px}h1{font-size:20px;font-weight:600;margin:0 0 8px}',
  'p{font-size:14px;line-height:1.6;color:#475569;margin:0}</style></head>',
  '<body><main><h1>You are offline</h1>',
  '<p>Trip OS could not reach the network and has no cached copy of this page yet. ',
  'Your saved itinerary is still available once a cached version exists.</p></main></body></html>'
].join('');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      } catch (err) {
        console.warn('[SW] Cache cleanup failed:', err);
      }
      try {
        await self.clients.claim();
      } catch (err) {
        console.warn('[SW] clients.claim failed:', err);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only same-origin GETs participate in caching strategies.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // API traffic is always live: never served from cache, never stored.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** Network-first with timeout; falls back to the cached app shell offline. */
async function handleNavigation(request) {
  try {
    const fresh = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    try {
      const cache = await caches.open(CACHE_NAME);
      // Best-effort: keep the shell fresh under its canonical key.
      await cache.put('/', fresh.clone());
    } catch {
      /* caching the shell is best-effort */
    }
    return fresh;
  } catch {
    try {
      const cache = await caches.open(CACHE_NAME);
      const shell =
        (await cache.match('/')) ||
        (await cache.match('/index.html')) ||
        (await cache.match(request));
      if (shell) return shell;
    } catch {
      /* fall through to the inline offline page */
    }
    return new Response(OFFLINE_HTML, {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/** fetch() that rejects after `ms` so slow networks lose to cache fallback. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('navigation timeout')), ms);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Serve cached assets instantly, refresh them in the background. */
async function staleWhileRevalidate(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch {
    return fetch(request).catch(() => offlineResponse());
  }

  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await refresh;
  if (response) return response;
  return offlineResponse();
}

function offlineResponse() {
  return new Response(null, { status: 504, statusText: 'Offline' });
}
