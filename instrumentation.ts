// Archivo de instrumentación principal para Sentry en Next.js
// Se encarga de inicializar la configuración adecuada según el
// entorno de ejecución (servidor Node o funciones Edge).
import * as Sentry from "@sentry/nextjs";

// Función ejecutada por Next.js durante el arranque de la app
// para cargar la configuración de Sentry correspondiente.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Cuando corremos en el runtime tradicional de Node.js
    // cargamos la configuración del servidor.
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Si la app se ejecuta como función Edge, usamos la
    // configuración optimizada para ese entorno.
    await import("./sentry.edge.config");
  }
}

// Exponemos el manejador de errores de solicitud para que Next.js
// registre automáticamente cualquier fallo en las peticiones.
export const onRequestError = Sentry.captureRequestError;
