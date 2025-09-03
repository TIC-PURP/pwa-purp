// Configuración de Sentry para características Edge (middleware, rutas, etc.).
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || undefined;

Sentry.init({
  dsn,
  // Porcentaje de trazas desde funciones Edge (ajustable)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.2"),
  // Logs habilitados fuera de producción
  enableLogs: process.env.NODE_ENV !== "production",
  // Habilitar solo en producción y cuando exista DSN
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  debug: false,
});

