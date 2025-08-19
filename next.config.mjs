// next.config.mjs
// Build CouchDB base URL and origin from NEXT_PUBLIC_COUCHDB_URL.
// IMPORTANT: NEXT_PUBLIC_COUCHDB_URL **must** include the protocol, host,
// port and database name (e.g. http://example.com:5984/pwa‑purp).  We do
// not strip the path or port here because the rewrite proxy relies on the
// full path.  If no environment variable is provided during build the
// fallback points at the old CloudFront distribution but **includes** the
// port and database name so that the generated origin preserves the port.
const COUCH_BASE = process.env.NEXT_PUBLIC_COUCHDB_URL ??
  "http://ec2-35-162-244-119.us-west-2.compute.amazonaws.com:5984/pwa-purp";

// The origin is the scheme+host+port of the CouchDB server.  Using
// `new URL().origin` on COUCH_BASE preserves the port component which is
// critical when proxying through Vercel.  Without the port the proxy
// would attempt to connect on the default port (80 or 443) and fail.
const COUCH_ORIGIN = new URL(COUCH_BASE).origin;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    /*
     * Proxy all requests under /couchdb to the configured CouchDB base.
     * The destination must include the database name so that PouchDB
     * requests like /couchdb/pwa‑purp/_all_docs resolve correctly.  We
     * deliberately avoid stripping the path (e.g. with .origin) because
     * that would drop the database portion and cause 502/504 errors.
     */
    return [
      {
        source: "/couchdb/:path*",
        destination: `${COUCH_BASE}/:path*`,
      },
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
      // Allow fetches to the CouchDB server including its port.  Without
      // specifying COUCH_ORIGIN the browser would block requests to the
      // non‑standard port defined in NEXT_PUBLIC_COUCHDB_URL.
      `connect-src 'self' ${COUCH_ORIGIN} https: ws: wss:`,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "geolocation=*" },
      ],
    }];
  },
};

export default nextConfig;
