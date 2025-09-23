/**
 * Optional: keep this if your code calls self.fallback(request) from sw.js
 * Place in /public/fallback.js and import in sw if needed (or inline in sw).
 */
self.fallback = async function(request) {
  try {
    const cache = await caches.open('html-pages-v3.1.0-offline-appshell');
    const direct = await cache.match(request);
    if (direct) return direct;
    const url = new URL(request.url);
    const byPath = await cache.match(new Request(url.pathname, { credentials: 'same-origin' }));
    if (byPath) return byPath;
    const shell = await cache.match('/') || await cache.match('/principal') || await cache.match('/auth/login');
    if (shell) return shell;
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
  } catch(e) {}
  return Response.error();
};