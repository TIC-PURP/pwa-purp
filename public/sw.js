/* eslint-disable no-restricted-globals */
// Lightweight service worker tailored for the PWA experience of this project.
// The worker precaches the core screens so they remain accessible offline and
// keeps a small runtime cache for static assets such as the Next.js chunks,
// styles and icons. Navigation requests try the network first with a timeout
// and transparently fall back to the cached app-shell or to the offline page.

const VERSION = '2024-12-12';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const APP_SHELL_FALLBACKS = ['/principal', '/'];
const SHELL_ROUTES = [
  '/',
  '/auth/login',
  '/principal',
  '/users',
  '/mod-a',
  '/mod-b',
  '/mod-c',
  '/mod-d',
  '/account',
];
const PRECACHE_URLS = [
  ...SHELL_ROUTES,
  OFFLINE_URL,
  '/manifest.json',
  '/theme-init.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const NETWORK_TIMEOUT_MS = 4000;
const RUNTIME_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheCore();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await removeLegacyCaches();
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (error) {
        console.warn('[sw] navigationPreload enable failed', error);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (shouldCacheAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/data/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

async function precacheCore() {
  const cache = await caches.open(STATIC_CACHE);
  const precachePromises = [];

  for (const path of PRECACHE_URLS) {
    const isDocument = SHELL_ROUTES.includes(path);
    const requestInit = isDocument
      ? { cache: 'reload', credentials: 'same-origin', mode: 'same-origin' }
      : { cache: 'reload', credentials: 'same-origin' };
    precachePromises.push(cacheUrl(cache, path, requestInit, { navigation: isDocument }));
  }

  const nextAssets = await discoverNextBuildAssets();
  for (const asset of nextAssets) {
    precachePromises.push(cacheUrl(cache, asset, { cache: 'reload', credentials: 'same-origin' }));
  }

  await Promise.all(precachePromises);
}

async function removeLegacyCaches() {
  const names = await caches.keys();
  await Promise.all(
    names.map((name) => {
      if (name !== STATIC_CACHE && name !== RUNTIME_CACHE) {
        return caches.delete(name);
      }
      return undefined;
    }),
  );
}

async function handleNavigationRequest(event) {
  const { request } = event;
  const cache = await caches.open(STATIC_CACHE);
  const normalized = navigationCacheKey(request);

  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    if (preload) {
      await storeNavigationResponse(cache, request, preload.clone());
      return preload;
    }

    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    await storeNavigationResponse(cache, request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.warn('[sw] navigation fallback', request.url, error);
    const cached = await matchNavigationFallback(cache, request, normalized);
    if (cached) return cached;
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  let cached = await cache.match(request);
  if (!cached) {
    try {
      cached = await cache.match(request.url);
    } catch {}
  }

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        const duplicate = response.clone();
        await cache.put(request, duplicate);
        await cache.put(request.url, response);
      }
      return response;
    })
    .catch((error) => {
      console.warn('[sw] runtime fetch failed', request.url, error);
      return undefined;
    });

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return Response.error();
}

function shouldCacheAssetRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/_next/static/')) return true;
  return RUNTIME_DESTINATIONS.has(request.destination);
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isCacheableResponse(response) {
  if (!response) return false;
  if (response.type === 'opaqueredirect' || response.type === 'opaque') return true;
  return response.ok;
}

function navigationCacheKey(request) {
  const url = new URL(request.url);
  url.hash = '';
  return url.toString();
}

async function matchNavigationFallback(cache, request, normalized) {
  const byRequest = await cache.match(request, { ignoreSearch: true });
  if (byRequest) return byRequest;

  const byNormalized = await cache.match(normalized, { ignoreSearch: true });
  if (byNormalized) return byNormalized;

  for (const fallbackPath of APP_SHELL_FALLBACKS) {
    const absolute = new URL(fallbackPath, self.location.origin).toString();
    const fallback = await cache.match(new Request(absolute, { credentials: 'same-origin' }));
    if (fallback) return fallback;
  }

  const offlineUrl = new URL(OFFLINE_URL, self.location.origin).toString();
  const offline = await cache.match(new Request(offlineUrl, { credentials: 'same-origin' }));
  if (offline) return offline;

  return null;
}

async function cacheUrl(cache, path, requestInit, { navigation = false } = {}) {
  const absoluteUrl = typeof path === 'string' ? new URL(path, self.location.origin).toString() : path;
  const request = typeof absoluteUrl === 'string' ? new Request(absoluteUrl, requestInit) : absoluteUrl;
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      if (navigation && request instanceof Request) {
        await storeNavigationResponse(cache, request, response);
      } else if (request instanceof Request) {
        const duplicate = response.clone();
        await cache.put(request, duplicate);
        await cache.put(request.url, response);
      } else {
        await cache.put(request, response.clone());
      }
    }
  } catch (error) {
    console.warn('[sw] precache skip', absoluteUrl, error);
  }
}

async function storeNavigationResponse(cache, request, response) {
  if (!isCacheableResponse(response)) return;
  const normalizedKey = navigationCacheKey(request);
  const duplicate = response.clone();
  await cache.put(request, response);
  await cache.put(normalizedKey, duplicate);
}

async function discoverNextBuildAssets() {
  const assets = new Set();
  const manifestSpecs = [
    {
      url: '/_next/app-build-manifest.json',
      collect: (json) => Object.values(json.pages || {}),
    },
    {
      url: '/_next/build-manifest.json',
      collect: (json) => [
        json.polyfillFiles || [],
        json.lowPriorityFiles || [],
        json.rootMainFiles || [],
        ...(json.pages ? Object.values(json.pages) : []),
      ],
    },
  ];

  for (const spec of manifestSpecs) {
    try {
      const response = await fetch(new Request(spec.url, { cache: 'no-store', credentials: 'same-origin' }));
      if (!isCacheableResponse(response)) continue;
      const data = await response.clone().json();
      const groups = spec.collect(data) || [];
      for (const group of groups) {
        if (!group) continue;
        for (const asset of group) {
          if (typeof asset === 'string') {
            const normalized = asset.startsWith('/') ? asset : `/_next/${asset.replace(/^\/?/, '')}`;
            assets.add(normalized);
          }
        }
      }
    } catch (error) {
      console.warn('[sw] manifest parse failed', spec.url, error);
    }
  }

  return Array.from(assets);
}
