// next.config.mjs — Proxy y CSP para CouchDB con sesiones (/_session)

const RAW =
  process.env.NEXT_PUBLIC_COUCHDB_URL ||
  "https://admin:Purp_2023Tic@couchdb-purp.onrender.com/gestion_pwa";

const U = new URL(RAW);
const SERVER_ORIGIN = `${U.protocol}//${U.host}`;
const DB_NAME = U.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "gestion_pwa";
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      // DB endpoints
      { source: "/couchdb/:path*", destination: `${SERVER_ORIGIN}/${DB_NAME}/:path*` },
{ source: "/couch/:path*",   destination: `${SERVER_ORIGIN}/:path*` },

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
      `connect-src 'self' ${SERVER_ORIGIN} ${isProd ? "" : "ws:"}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      `script-src 'self' blob: ${isProd ? "" : "'unsafe-inline' 'unsafe-eval'"}`,
    ]
      .filter(Boolean)
      .join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
