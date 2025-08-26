// Configuración de Sentry para características Edge (middleware, rutas, etc.).
// Esta configuración se aplica cada vez que se carga una función Edge.
// No está relacionada con el runtime de Vercel y también se usa en local.
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://212a921d236eb4b36831f918e6cc7b5f@o4509788384788480.ingest.us.sentry.io/4509788385837056",

  // Porcentaje de trazas que se reportarán desde las funciones Edge
  tracesSampleRate: 1,

  // Permite enviar logs generados en estas funciones
  enableLogs: true,

  // Información de depuración en consola durante la configuración
  debug: false,
});
