/* eslint-disable no-restricted-globals */
// App-shell augmentation for Workbox-generated service worker.

const APP_SHELL_VERSION = "2024-07-20";
const APP_SHELL_CACHE_NAME = `app-shell-html-${APP_SHELL_VERSION}`;
const APP_SHELL_URLS = [
  '/',
  '/auth/login',
  '/principal',
  '/users',
  '/mod-a',
  '/mod-b',
  '/mod-c',
  '/mod-d',
  '/offline.html',
];
const APP_SHELL_FALLBACKS = ['/principal', '/'];
const OFFLINE_FALLBACK_URL = '/offline.html';
const NAVIGATION_TIMEOUT_MS = 4000;
const CACHE_PREFIX = 'app-shell-html-';

const toRequest = (path, init = {}) => new Request(path, { credentials: 'same-origin', ...init });

const networkWithTimeout = (request, timeout = NAVIGATION_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    let timeoutId;
    if (timeout) {
      timeoutId = setTimeout(() => reject(new Error('navigation-timeout')), timeout);
    }
    fetch(request)
      .then((response) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
  });
};

const cacheResponse = async (cache, request, response) => {
  try {
    await cache.put(request, response);
  } catch (error) {
    console.warn('[sw-augment] Failed to cache response for', request.url, error);
  }
};

const precacheAppShell = async () => {
  const cache = await caches.open(APP_SHELL_CACHE_NAME);
  await Promise.all(
    APP_SHELL_URLS.map(async (path) => {
      const request = toRequest(path, { cache: 'reload' });
      try {
        const response = await fetch(request);
        if (!response) return;
        if (!response.ok && response.type !== 'opaqueredirect' && response.type !== 'opaque') {
          return;
        }
        await cacheResponse(cache, request, response.clone());
      } catch (error) {
        console.warn('[sw-augment] Failed to precache', path, error);
      }
    }),
  );
};

const cleanOldAppShellCaches = async () => {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      if (key.startsWith(CACHE_PREFIX) && key !== APP_SHELL_CACHE_NAME) {
        return caches.delete(key);
      }
      return undefined;
    }),
  );
};

const matchNavigationFallback = async (cache, request) => {
  const url = new URL(request.url);
  const candidates = [request, toRequest(url.pathname)];
  if (!url.pathname.endsWith('/')) {
    candidates.push(toRequest(`${url.pathname}/`));
  }

  for (const candidate of candidates) {
    const cached = await cache.match(candidate);
    if (cached) return cached;
  }

  for (const fallbackPath of APP_SHELL_FALLBACKS) {
    const cached = await cache.match(toRequest(fallbackPath));
    if (cached) return cached;
  }

  const offline = await cache.match(toRequest(OFFLINE_FALLBACK_URL));
  if (offline) return offline;

  return Response.error();
};

const handleNavigationRequest = async (event) => {
  const { request } = event;
  const cache = await caches.open(APP_SHELL_CACHE_NAME);
  const url = new URL(request.url);

  try {
    const preloadResponse = event.preloadResponse ? await event.preloadResponse : null;
    if (preloadResponse) {
      await cacheResponse(cache, request, preloadResponse.clone());
      if (url.search) {
        await cacheResponse(cache, toRequest(url.pathname), preloadResponse.clone());
      }
      return preloadResponse;
    }

    const networkResponse = await networkWithTimeout(request);
    if (networkResponse) {
      const cacheable = networkResponse.clone();
      if (cacheable.ok || cacheable.type === 'opaqueredirect' || cacheable.type === 'opaque') {
        await cacheResponse(cache, request, cacheable.clone());
        if (url.search) {
          await cacheResponse(cache, toRequest(url.pathname), cacheable.clone());
        }
      }
      return networkResponse;
    }
  } catch (error) {
    console.warn('[sw-augment] Navigation fell back to cache for', url.pathname, error);
  }

  return matchNavigationFallback(cache, request);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheAppShell();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanOldAppShellCaches();
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (error) {
          console.warn('[sw-augment] navigationPreload.enable failed', error);
        }
      }
      await self.clients.claim();
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'APP_SHELL_READY' }));
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(handleNavigationRequest(event));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

