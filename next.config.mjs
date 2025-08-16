// next.config.mjs
const RAW =
  process.env.NEXT_PUBLIC_COUCHDB_URL ||
  "https://d2zfthqcwakql2.cloudfront.net/gestion_pwa";
const U = new URL(RAW);
const COUCH_ORIGIN = `${U.protocol}//${U.host}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Imprescindible para que /couchdb/* llegue a CouchDB
  async rewrites() {
    return [
      // _session existe en la RAÍZ del servidor CouchDB (no dentro de la DB)
      { source: "/couchdb/_session", destination: `${COUCH_ORIGIN}/_session` },
      // resto de rutas (ej: /couchdb/gestion_pwa/_changes, /couchdb/gestion_pwa/_all_docs, etc.)
      { source: "/couchdb/:path*", destination: `${COUCH_ORIGIN}/:path*` },
    ];
  },

  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      // permitir fetch/XHR a CouchDB y websockets si los hubiese
      `connect-src 'self' ${COUCH_ORIGIN} ws:`,
      // en dev Next puede requerir 'unsafe-eval'; si no lo necesitas en prod, quítalo
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
