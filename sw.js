// GLV Services — Service Worker v1.0
// Caches ONLY public static assets. NEVER caches auth, GOS, API, or private routes.

const CACHE_NAME = 'glv-services-static-v1';

// Routes that MUST NEVER be cached
const BLOCKED_PREFIXES = [
  '/glv-connect/',
  '/api/',
  '/gos',
  '/login',
  '/admin',
  '/session',
  '/auth',
  '/services/glv-forms/',
];

// Static asset extensions safe to cache
const CACHEABLE_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'];

function isBlockedPath(url) {
  const pathname = new URL(url).pathname;
  return BLOCKED_PREFIXES.some(p => pathname.startsWith(p));
}

function isCacheableAsset(url) {
  const pathname = new URL(url).pathname;
  return CACHEABLE_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

// Install: no pre-caching to avoid any risk of caching dynamic content
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML; cache-first only for static assets
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = req.url;

  // Block: not same-origin
  if (!isSameOrigin(url)) return;

  // Block: private/GOS/API routes — always go to network, never intercept
  if (isBlockedPath(url)) return;

  // Only cache static assets; HTML always goes to network
  if (!isCacheableAsset(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        if (cached) return cached;

        return fetch(req).then(response => {
          // Only cache: GET + same-origin + 200 + no Set-Cookie
          if (
            response.ok &&
            response.status === 200 &&
            response.type === 'basic' &&
            !response.headers.has('set-cookie') &&
            isSameOrigin(url) &&
            !isBlockedPath(url)
          ) {
            cache.put(req, response.clone());
          }
          return response;
        }).catch(() => cached || Response.error());
      })
    )
  );
});
