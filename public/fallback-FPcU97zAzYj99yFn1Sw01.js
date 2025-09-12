// Improved offline fallback for navigation.
// Prefer a cached page (same path) or an app shell
// before falling back to offline.html.
(() => {
  "use strict";
  self.fallback = async (req) => {
    try {
      const isDoc = req?.destination === 'document' || req?.mode === 'navigate';
      if (!isDoc) return Response.error();

      const url = new URL(req.url, self.location.origin);

      // 1) Try cached HTML for same path, ignore query
      const samePath = await caches.match(url.pathname, { ignoreSearch: true });
      if (samePath) return samePath;

      // 2) Try a cached app shell
      const shell = (await caches.match('/principal')) || (await caches.match('/'));
      if (shell) return shell;

      // 3) Final fallback to offline screen
      return (await caches.match('/offline.html', { ignoreSearch: true })) || Response.error();
    } catch {
      return Response.error();
    }
  };
})();
