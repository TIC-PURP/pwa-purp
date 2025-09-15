// Stable offline fallback used by the generated Workbox SW
// Prefer a cached page (same path) or an app shell before offline.html
(() => {
  "use strict";
  self.fallback = async (req) => {
    try {
      const isDoc = req?.destination === 'document' || req?.mode === 'navigate';
      if (!isDoc) return Response.error();
      const url = new URL(req.url, self.location.origin);
      const samePath = await caches.match(url.pathname, { ignoreSearch: true });
      if (samePath) return samePath;
      const shell = (await caches.match('/principal')) || (await caches.match('/'));
      if (shell) return shell;
      return (await caches.match('/offline.html', { ignoreSearch: true })) || Response.error();
    } catch {
      return Response.error();
    }
  };
})();

