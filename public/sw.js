if (!self.define) {
  let e,
    a = {};
  const s = (s, c) => (
    (s = new URL(s + ".js", c).href),
    a[s] ||
      new Promise((a) => {
        if ("document" in self) {
          const e = document.createElement("script");
          ((e.src = s), (e.onload = a), document.head.appendChild(e));
        } else ((e = s), importScripts(s), a());
      }).then(() => {
        let e = a[s];
        if (!e) throw new Error(`Module ${s} didn’t register its module`);
        return e;
      })
  );
  self.define = (c, n) => {
    const i =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (a[i]) return;
    let t = {};
    const r = (e) => s(e, i),
      f = { module: { uri: i }, exports: t, require: r };
    a[i] = Promise.all(c.map((e) => f[e] || r(e))).then((e) => (n(...e), t));
  };
}
define(["./workbox-bb54ffba"], function (e) {
  "use strict";
  (importScripts("fallback-FPcU97zAzYj99yFn1Sw01.js"),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: "/_next/app-build-manifest.json",
          revision: "53e948882c70116521c5149ab18d2663",
        },
        {
          url: "/_next/static/FPcU97zAzYj99yFn1Sw01/_buildManifest.js",
          revision: "447bc0517048391f643c00fd45a78b9a",
        },
        {
          url: "/_next/static/FPcU97zAzYj99yFn1Sw01/_ssgManifest.js",
          revision: "b6652df95db52feb4daf4eca35380933",
        },
        {
          url: "/_next/static/chunks/19.13f449ce806926df.js",
          revision: "13f449ce806926df",
        },
        {
          url: "/_next/static/chunks/19.13f449ce806926df.js.map",
          revision: "4117b4c24e9e1d4c8a0c799729bdeea5",
        },
        {
          url: "/_next/static/chunks/352-07366c432607ff65.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/352-07366c432607ff65.js.map",
          revision: "e18340a3a72f30496bca504314f1cc05",
        },
        {
          url: "/_next/static/chunks/364.563a2f68ff4ba492.js",
          revision: "563a2f68ff4ba492",
        },
        {
          url: "/_next/static/chunks/364.563a2f68ff4ba492.js.map",
          revision: "beeaa4916cd3500888ed0563dac5b310",
        },
        {
          url: "/_next/static/chunks/367a3e88.1ec1b3fa1a3a0b3d.js",
          revision: "1ec1b3fa1a3a0b3d",
        },
        {
          url: "/_next/static/chunks/367a3e88.1ec1b3fa1a3a0b3d.js.map",
          revision: "806901e0b86114cba8a8edaf95f0bdd7",
        },
        {
          url: "/_next/static/chunks/387-4ed890a0ff55fa7e.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/387-4ed890a0ff55fa7e.js.map",
          revision: "da0276f3718ba74b6a53a1a726a4f740",
        },
        {
          url: "/_next/static/chunks/438-5ec59152b85dc588.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/438-5ec59152b85dc588.js.map",
          revision: "ac685cd7ba5f3724a409c61c83bb8d06",
        },
        {
          url: "/_next/static/chunks/455-a906b8eb2648b129.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/455-a906b8eb2648b129.js.map",
          revision: "695979daef68ca17a3e849a2723b06b5",
        },
        {
          url: "/_next/static/chunks/483-6a3904bec872920d.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/483-6a3904bec872920d.js.map",
          revision: "bc2268864b1729fb1fb365861f0ac178",
        },
        {
          url: "/_next/static/chunks/52774a7f-45c9e3e15a885749.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/52774a7f-45c9e3e15a885749.js.map",
          revision: "5d19859dc18fe42f9387eb26e7c15c38",
        },
        {
          url: "/_next/static/chunks/575-cea8577705f36fd2.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/575-cea8577705f36fd2.js.map",
          revision: "c40c560f66e44aa79473865613ff5c5e",
        },
        {
          url: "/_next/static/chunks/726.1a6c58aa83f11ca1.js",
          revision: "1a6c58aa83f11ca1",
        },
        {
          url: "/_next/static/chunks/726.1a6c58aa83f11ca1.js.map",
          revision: "b36bb34ca3e8e9d3e12ded01ba5a17b4",
        },
        {
          url: "/_next/static/chunks/822-0275c787ac19eaa0.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/822-0275c787ac19eaa0.js.map",
          revision: "ff27b22e081c0f4460ce8f81faa4521f",
        },
        {
          url: "/_next/static/chunks/86-8bb77d1f0daadedf.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/86-8bb77d1f0daadedf.js.map",
          revision: "b1746ef4dbe89413ffd9f30dc4d5df18",
        },
        {
          url: "/_next/static/chunks/app/_not-found/page-b36d50ffcdb1df49.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/_not-found/page-b36d50ffcdb1df49.js.map",
          revision: "c934b193b34f8a30156725ff3fca16a3",
        },
        {
          url: "/_next/static/chunks/app/auth/login/page-1fdeb400e7f10e51.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/auth/login/page-1fdeb400e7f10e51.js.map",
          revision: "3c88c6a38d909b0fdf1c4e95ffa5ac27",
        },
        {
          url: "/_next/static/chunks/app/error-b7fd7564a41321ca.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/error-b7fd7564a41321ca.js.map",
          revision: "143e884fccaf9cef2b147a50f86156fb",
        },
        {
          url: "/_next/static/chunks/app/global-error-2ccd0fde3ae901f7.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/global-error-2ccd0fde3ae901f7.js.map",
          revision: "d3f88b11db561875f23690101c12d1c6",
        },
        {
          url: "/_next/static/chunks/app/layout-e727d97f00a12476.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/layout-e727d97f00a12476.js.map",
          revision: "b2159a2f255944f9405a0c500777846c",
        },
        {
          url: "/_next/static/chunks/app/page-d55120832cbc901b.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/page-d55120832cbc901b.js.map",
          revision: "948b0a650049aba48fbf67393bf4ebc8",
        },
        {
          url: "/_next/static/chunks/app/principal/page-4527e4b2b02b7cbd.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/principal/page-4527e4b2b02b7cbd.js.map",
          revision: "04d69618b6222bc2c4790172b2db2121",
        },
        {
          url: "/_next/static/chunks/app/sentry-example-page/page-4bb5f6cf1c711d77.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/sentry-example-page/page-4bb5f6cf1c711d77.js.map",
          revision: "c251d0e627f60abd4b7076076482d8db",
        },
        {
          url: "/_next/static/chunks/app/users/page-fbf99690cb0fe7f6.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/app/users/page-fbf99690cb0fe7f6.js.map",
          revision: "3b55a2e77aa3ff0f128cef2d1f162e51",
        },
        {
          url: "/_next/static/chunks/fd9d1056-ef5dfb58b68a3711.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/fd9d1056-ef5dfb58b68a3711.js.map",
          revision: "6c823cc7f0cc8bda9f26a98b02f1eb85",
        },
        {
          url: "/_next/static/chunks/framework-332f134768e2321c.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/framework-332f134768e2321c.js.map",
          revision: "403c390267622bcb30fece919c746ed3",
        },
        {
          url: "/_next/static/chunks/main-app-9066cbd4e6562625.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/main-app-9066cbd4e6562625.js.map",
          revision: "17ec80f5ef6f39a2f4247407fd383399",
        },
        {
          url: "/_next/static/chunks/main-f2f219fd7292989a.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/main-f2f219fd7292989a.js.map",
          revision: "2c3f283bb630d1046b6f01f0e9bbf050",
        },
        {
          url: "/_next/static/chunks/pages/_app-f6128b810c0ff56f.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/pages/_app-f6128b810c0ff56f.js.map",
          revision: "bab66b20f2bcc498552640522fd72869",
        },
        {
          url: "/_next/static/chunks/pages/_error-7d75bff98c4f8336.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/pages/_error-7d75bff98c4f8336.js.map",
          revision: "9204fd2a233b51ad06caf65c3c5ace4b",
        },
        {
          url: "/_next/static/chunks/polyfills-42372ed130431b0a.js",
          revision: "846118c33b2c0e922d7b3a7676f81f6f",
        },
        {
          url: "/_next/static/chunks/webpack-0ac385d363636734.js",
          revision: "FPcU97zAzYj99yFn1Sw01",
        },
        {
          url: "/_next/static/chunks/webpack-0ac385d363636734.js.map",
          revision: "7f7c1486fc7af04e0744effd266a0a7e",
        },
        {
          url: "/_next/static/css/1e00bfb68f9606bb.css",
          revision: "1e00bfb68f9606bb",
        },
        {
          url: "/_next/static/css/1e00bfb68f9606bb.css.map",
          revision: "cd690037a9e4d39a87ce278443b475d1",
        },
        {
          url: "/_next/static/media/26a46d62cd723877-s.woff2",
          revision: "befd9c0fdfa3d8a645d5f95717ed6420",
        },
        {
          url: "/_next/static/media/55c55f0601d81cf3-s.woff2",
          revision: "43828e14271c77b87e3ed582dbff9f74",
        },
        {
          url: "/_next/static/media/581909926a08bbc8-s.woff2",
          revision: "f0b86e7c24f455280b8df606b89af891",
        },
        {
          url: "/_next/static/media/8e9860b6e62d6359-s.woff2",
          revision: "01ba6c2a184b8cba08b0d57167664d75",
        },
        {
          url: "/_next/static/media/97e0cb1ae144a2a9-s.woff2",
          revision: "e360c61c5bd8d90639fd4503c829c2dc",
        },
        {
          url: "/_next/static/media/df0a9ae256c0569c-s.woff2",
          revision: "d54db44de5ccb18886ece2fda72bdfe0",
        },
        {
          url: "/_next/static/media/e4af272ccee01ff0-s.p.woff2",
          revision: "65850a373e258f1c897a2b3d75eb74de",
        },
        {
          url: "/icons/Espiga.png",
          revision: "b48c2c2c0bcb7f78c0cab6123dbd3067",
        },
        {
          url: "/icons/icon-192x192.png",
          revision: "eca0606a8db04322dae597407dbaa97d",
        },
        {
          url: "/icons/icon-512x512.png",
          revision: "8fd70588a1b469ca6e265e299b84013a",
        },
        { url: "/offline.html", revision: "4924d7e98f7fb288d05a504e28d2c1b6" },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      "/",
      new e.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({
              request: e,
              response: a,
              event: s,
              state: c,
            }) =>
              a && "opaqueredirect" === a.type
                ? new Response(a.body, {
                    status: 200,
                    statusText: "OK",
                    headers: a.headers,
                  })
                : a,
          },
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e, request: a }) =>
        e.origin === self.location.origin && "document" === a.destination,
      new e.NetworkFirst({
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 604800 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) =>
        e.origin === self.location.origin &&
        ("/auth/login" === e.pathname ||
          "/principal" === e.pathname ||
          "/" === e.pathname),
      new e.NetworkFirst({
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 604800 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ request: e }) => ["style", "script", "worker"].includes(e.destination),
      new e.StaleWhileRevalidate({
        cacheName: "static-resources",
        plugins: [
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ request: e }) => "image" === e.destination,
      new e.StaleWhileRevalidate({
        cacheName: "images",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592e3 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: t }) =>
        t.origin === self.location.origin &&
        t.pathname.startsWith("/_next/data/"),
      new e.NetworkFirst({
        cacheName: "next-data",
        networkTimeoutSeconds: 3,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 604800 }),
        ],
        matchOptions: { ignoreSearch: true },
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/[^/]+\/(auth\/login|principal|)$/i,
      new e.NetworkFirst({
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 604800 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      "GET",
    ),
    // Cache GET de endpoints seguros (lista blanca)
    e.registerRoute(
      ({ url: t, request: r }) => (
        t.origin === self.location.origin &&
        r.method === "GET" &&
        (t.pathname === "/api/sentry-example-api")
      ),
      new e.NetworkFirst({
        cacheName: "api-get",
        networkTimeoutSeconds: 3,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    // Encolado de mutaciones de API con Background Sync
    (() => {
      try {
        const postMessageAll = async (payload) => {
          try {
            const cls = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
            for (const c of cls) c.postMessage(payload);
          } catch {}
        };
        const bgSync = new e.BackgroundSyncPlugin("api-queue", {
          maxRetentionTime: 24 * 60,
          onSync: async ({ queue }) => {
            try {
              await queue.replayRequests();
              await postMessageAll({ type: 'BG_SYNC_SUCCESS' });
            } catch (err) {
              await postMessageAll({ type: 'BG_SYNC_FAILURE' });
              throw err;
            }
          },
        });
        const matchApiMutation = ({ url: t, request: r }) => (
          t.origin === self.location.origin &&
          t.pathname.startsWith("/api/") &&
          (r.method === "POST" || r.method === "PUT" || r.method === "DELETE")
        );
        e.registerRoute(
          matchApiMutation,
          new e.NetworkOnly({
            plugins: [
              bgSync,
              {
                handlerDidError: async () => {
                  await postMessageAll({ type: 'BG_SYNC_QUEUED' });
                },
              },
            ],
          }),
          ["POST", "PUT", "DELETE"],
        );
      } catch (err) {
        // ignorar si no está disponible
      }
    })());
});
//# sourceMappingURL=sw.js.map
