/**
 * Workbox runtime with app-shell augmentation.
 * Generated manually to keep Workbox handling of Next assets.
 */
importScripts('/sw-augment.js');
importScripts('/workbox-2fa00e89.js');

if (!self.workbox) {
  console.warn('[sw] Workbox failed to load');
} else {
  const { workbox } = self;
  const { core, routing, strategies, expiration, precaching } = workbox;

  core.setCacheNameDetails({ prefix: 'pwa-purp', suffix: 'v2024-07-14' });
  core.skipWaiting();
  core.clientsClaim();

  precaching.precacheAndRoute(self.__WB_MANIFEST || [], {
    cleanURLs: true,
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  });

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'),
    new strategies.CacheFirst({
      cacheName: 'pwa-purp-next-static',
      plugins: [new expiration.ExpirationPlugin({ maxEntries: 80, purgeOnQuotaError: true })],
    }),
  );

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/_next/data/'),
    new strategies.NetworkFirst({
      cacheName: 'pwa-purp-next-data',
      networkTimeoutSeconds: 4,
      plugins: [new expiration.ExpirationPlugin({ maxEntries: 50, purgeOnQuotaError: true })],
    }),
  );

  routing.registerRoute(
    ({ request, url }) => url.origin === self.location.origin && request.destination === 'image',
    new strategies.StaleWhileRevalidate({
      cacheName: 'pwa-purp-images',
      plugins: [new expiration.ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
    }),
  );

  routing.registerRoute(
    ({ request, url }) => url.origin === self.location.origin && (request.destination === 'script' || request.destination === 'style'),
    new strategies.StaleWhileRevalidate({
      cacheName: 'pwa-purp-assets',
      plugins: [new expiration.ExpirationPlugin({ maxEntries: 80, purgeOnQuotaError: true })],
    }),
  );

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
    new strategies.NetworkFirst({
      cacheName: 'pwa-purp-api',
      networkTimeoutSeconds: 4,
      plugins: [new expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 5, purgeOnQuotaError: true })],
    }),
    'GET',
  );
}
