// Configuración de Sentry para el lado del cliente.
// El código aquí se ejecuta cuando el usuario carga la aplicación en su navegador.
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://212a921d236eb4b36831f918e6cc7b5f@o4509788384788480.ingest.us.sentry.io/4509788385837056",

  // Integración opcional para grabar sesiones de usuario
  integrations: [Sentry.replayIntegration()],

  // Muestreo de trazas para rendimiento; ajustar en producción
  tracesSampleRate: 1,
  // Permite enviar logs al panel de Sentry
  enableLogs: true,

  // Porcentaje de sesiones grabadas (Replay)
  // En desarrollo puede ser 100% y reducirse en producción
  replaysSessionSampleRate: 0.1,

  // Muestreo de sesiones cuando ocurre un error
  replaysOnErrorSampleRate: 1.0,

  // Mostrar información adicional en consola durante la configuración
  debug: false,
});

// Reporta cambios de ruta en el cliente como posibles eventos de rendimiento
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
