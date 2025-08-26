// Next.js configuration with CSP and API cache headers
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'self'"
    ].join('; ');

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/api/couch/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }]
      },
      {
        source: "/api/auth/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }]
      }
    ];
  }
};

export default nextConfig;
