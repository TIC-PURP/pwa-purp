// Configuración de Sentry para el entorno de servidor (Node.js).
// El código aquí se ejecuta cada vez que el servidor atiende una petición.
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://212a921d236eb4b36831f918e6cc7b5f@o4509788384788480.ingest.us.sentry.io/4509788385837056",

  // Porcentaje de trazas de rendimiento que se enviarán
  tracesSampleRate: 1,

  // Permite enviar logs al dashboard de Sentry
  enableLogs: true,

  // Muestra información adicional en consola durante la configuración
  debug: false,
});
