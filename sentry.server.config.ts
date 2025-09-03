// Configuración de Sentry para el entorno de servidor (Node.js).
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || undefined;

Sentry.init({
  dsn,
  // Porcentaje de trazas de rendimiento (ajustable por variable de entorno)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.2"),
  // Enviar logs de Sentry solo fuera de producción
  enableLogs: process.env.NODE_ENV !== "production",
  // Habilitar Sentry solo en producción y cuando exista DSN
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  debug: false,
});

