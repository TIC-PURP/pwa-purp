/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/couchdb/:path*",
        destination: `${process.env.COUCH_HOST}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/couchdb/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};
module.exports = nextConfig;
