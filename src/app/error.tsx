// Página de error a nivel de aplicación con opción de reintento
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  // Reporta el error a Sentry cuando cambia
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="p-6">
      <h2>Algo salió mal.</h2>
      {/* Permite reintentar la acción fallida */}
      <button onClick={() => reset()}>Intentar de nuevo</button>
    </div>
  );
}
