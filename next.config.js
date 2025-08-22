/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: "/api/couch/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};
module.exports = nextConfig;
