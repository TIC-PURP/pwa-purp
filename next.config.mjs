// next.config.mjs
const COUCH_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_COUCHDB_URL ||
    "https://d2zfthqcwakql2.cloudfront.net/gestion_pwa"
).origin;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      { source: "/couchdb/_session", destination: `${COUCH_ORIGIN}/_session` },
      { source: "/couchdb/:path*",  destination: `${COUCH_ORIGIN}/:path*` },
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
