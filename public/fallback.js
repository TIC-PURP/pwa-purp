// Stable offline fallback used by the generated Workbox SW
// Prefer a cached page (same path) or an app shell before offline.html
(() => {
  "use strict";
  self.fallback = async (req) => {
    try {
      const isDoc = req?.destination === "document" || req?.mode === "navigate";
      if (!isDoc) return Response.error();

      // Intentamos usar exactamente la misma request para maximizar los aciertos
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;

      const url = req?.url ? new URL(req.url, self.location.origin) : null;
      if (url) {
        const byHref = await caches.match(url.href, { ignoreSearch: true });
        if (byHref) return byHref;
        const byPath = await caches.match(url.pathname, { ignoreSearch: true });
        if (byPath) return byPath;
      }

      const shell = (await caches.match("/principal")) || (await caches.match("/"));
      if (shell) return shell;

      return (await caches.match("/offline.html", { ignoreSearch: true })) || Response.error();
    } catch {
      return Response.error();
    }
  };
})();

