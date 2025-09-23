/* Offline-first Service Worker (vanilla) - App Shell Navigation Fallback
 * Drop this file into: /public/sw.js
 * Notes:
 * - No external Workbox dependency.
 * - Guarantees cold-start offline for navigations via app-shell fallback.
 * - Adjust CORE_ROUTES to include your key pages (they'll be precached).
 */

const SW_VERSION = 'v3.1.0-offline-appshell';
const HTML_CACHE = 'html-pages-' + SW_VERSION;
const ASSET_CACHE = 'assets-' + SW_VERSION;
const API_CACHE = 'api-' + SW_VERSION;

// Add/adjust your critical routes here. They will be precached at install.
const CORE_ROUTES = [
  '/',                // app shell
  '/auth/login',
  '/principal',
  // add your sections/modules here to be safe for cold start:
  '/users',
  '/account',
  '/mod-a',
  '/mod-b',
  '/mod-c',
  '/mod-d',
  '/offline.html',
];

// Regexes for request classification
const ASSET_EXT = /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|json|txt|xml|map)$/i;
const NEXT_INTERNAL = /^\/_next\//;
const API_PATH = /^\/api\//;

// network with timeout helper
const networkWithTimeout = (request, timeoutMs = 3000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network-timeout')), timeoutMs);
    fetch(request).then(resp => {
      clearTimeout(timer);
      resolve(resp);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(HTML_CACHE);
    try {
      // Precache core HTML routes
      await cache.addAll(CORE_ROUTES.map(p => new Request(p, { credentials: 'same-origin' })));
    } catch (e) {
      // Some routes may fail (e.g., auth-protected); continue.
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![HTML_CACHE, ASSET_CACHE, API_CACHE].includes(k)) {
        return caches.delete(k);
      }
    }));
    await self.clients.claim();
  })());
});

// Generic asset strategy: Stale-While-Revalidate
const handleAsset = async (request) => {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  // Return cached immediately if exists, otherwise wait for network
  return cached || fetchPromise || Response.error();
};

// API strategy: Network-First (cache GETs as fallback)
const handleApi = async (request) => {
  if (request.method !== 'GET') {
    // Non-GET API calls should hit network; offline will fail fast
    try {
      return await fetch(request);
    } catch (e) {
      return new Response(JSON.stringify({ ok:false, offline:true, message:'No network and request is non-GET' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  const cache = await caches.open(API_CACHE);
  try {
    const net = await fetch(request);
    if (net && net.status === 200) {
      cache.put(request, net.clone());
    }
    return net;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ ok:false, offline:true }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Navigation strategy: Network-First with App-Shell fallback
const handleNavigation = async (request) => {
  try {
    // Try network quickly; if slow/offline, fall back to cache
    const net = await networkWithTimeout(request, 3000);
    // If we got a non-OK opaque/no-cors or redirect HTML, still cache it for future
    if (net && (net.ok || net.type === 'opaqueredirect' || net.type === 'opaque')) {
      const cache = await caches.open(HTML_CACHE);
      cache.put(request, net.clone());
    }
    return net;
  } catch (e) {
    // Try exact match from HTML cache
    const cache = await caches.open(HTML_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    // Try match by path without query
    try {
      const url = new URL(request.url);
      const pathReq = new Request(url.pathname, { credentials: 'same-origin' });
      const pathCached = await cache.match(pathReq);
      if (pathCached) return pathCached;
    } catch {}

    // App-shell fallback ('/'), then offline page
    const appShell = await cache.match('/');
    if (appShell) return appShell;

    const offline = await cache.match('/offline.html');
    if (offline) return offline;

    return Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests for HTML/Assets/API. Let cross-origin go default.
  if (url.origin !== self.location.origin) return;

  // Navigations (documents) with exclusions
  if (request.mode === 'navigate') {
    // Exclude Next.js internals or direct static assets
    if (NEXT_INTERNAL.test(url.pathname) || ASSET_EXT.test(url.pathname)) {
      return; // let default go (or asset handler will take it)
    }
    // Exclude explicit APIs
    if (API_PATH.test(url.pathname)) {
      event.respondWith(handleApi(request));
      return;
    }
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets
  if (ASSET_EXT.test(url.pathname) || NEXT_INTERNAL.test(url.pathname)) {
    event.respondWith(handleAsset(request));
    return;
  }

  // API routes
  if (API_PATH.test(url.pathname)) {
    event.respondWith(handleApi(request));
    return;
  }

  // Default: try fetch, else cache
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (e) {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      return cached || Response.error();
    }
  })());
});