// next.config.mjs
import withPWA from "next-pwa"
import { withSentryConfig } from "@sentry/nextjs"

const couchUrl = process.env.NEXT_PUBLIC_COUCHDB_URL || ""
let couchHost = ""
try { couchHost = couchUrl ? new URL(couchUrl).host : "" } catch { couchHost = "" }

/** @type {import('next').NextConfig} */
const baseConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    const connectHosts = ["'self'"]
    if (couchHost) connectHosts.push(`https://${couchHost}`)
    connectHosts.push("https://*.ingest.sentry.io")

    const csp = [
      "default-src 'self'",
      `connect-src ${connectHosts.join(" ")}`,
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src * data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
    ].join("; ")

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ]
  },
}

// PWA
const withPwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: ({ url, request }) => url.origin === self.location.origin && request.destination === "document",
      handler: "NetworkFirst",
      options: { cacheName: "html-pages", networkTimeoutSeconds: 3, expiration: { maxEntries: 50, maxAgeSeconds: 604800 } },
    },
    {
      urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: { cacheName: "static-resources" },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "StaleWhileRevalidate",
      options: { cacheName: "images", expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } },
    },
  ],
  fallbacks: { document: "/offline.html" },
})

const nextConfig = withPwa(baseConfig)

const sentryWebpackPluginOptions = {
  org: "tic-ev",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
}

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions)
