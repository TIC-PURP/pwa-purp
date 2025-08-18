// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

/*
 * Configure Sentry for edge environments.  The DSN is read from the environment so
 * sensitive connection details aren’t hard‑coded in the repository.  You can set
 * either NEXT_PUBLIC_SENTRY_DSN (for public env exposure) or SENTRY_DSN (for server only).
 */
const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN || undefined,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
