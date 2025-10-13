// Next.js configuration: strict mode, security headers, and API limits
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
  async headers() {
    const securityHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/couch/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/auth/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
