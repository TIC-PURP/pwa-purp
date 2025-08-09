// next.config.mjs
import withPWA from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const baseConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: false },       // ✅ no ignores en prod
  typescript: { ignoreBuildErrors: false },    // ✅ no ignores en prod
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              connect-src 'self' https://couchdb-purp.onrender.com https://*.ingest.sentry.io;
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              img-src * data:;
              worker-src 'self' blob:;
              object-src 'none';
            `.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

// PWA
const withPwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  disable: process.env.NODE_ENV === "development",

  runtimeCaching: [
    // Documents/pages (App Router navigations)
    {
      urlPattern: ({ url, request }) =>
        url.origin === self.location.origin && request.destination === "document",
      handler: "NetworkFirst",
      options: {
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // Force cache for key routes even if not a 'document' navigation
    {
      urlPattern: /^https:\/\/[^/]+\/(auth\/login|principal|)$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // JS/CSS/Workers
    {
      urlPattern: ({ request }) =>
        ["style", "script", "worker"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: { cacheName: "static-resources" },
    },
    // Images
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Next static assets (optional)
    {
      urlPattern: /^https:\/\/[^/]+\/_next\/static\/.*/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "next-static" },
    },
  ],

  // Fallback when there's no network and no cached document
  fallbacks: { document: "/offline.html" },
});

const nextConfig = withPwa(baseConfig);

// Sentry (unchanged)
const sentryWebpackPluginOptions = {
  org: "tic-ev",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
