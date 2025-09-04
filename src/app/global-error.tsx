"use client";

// Maneja los errores globales (Client Component) y los reporta a Sentry
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    try { Sentry.captureException(error); } catch {}
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 20 }}>
          <h2>Ha ocurrido un error</h2>
          <p>Intenta recargar la página o vuelve más tarde.</p>
        </div>
      </body>
    </html>
  );
}
