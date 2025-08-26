import { NextResponse } from "next/server";

// Fuerza a que la ruta sea dinámica
export const dynamic = "force-dynamic";

// Error personalizado utilizado para probar la captura en Sentry
class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// Ruta defectuosa deliberadamente para probar el monitoreo de errores
export function GET() {
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
  return NextResponse.json({ data: "Testing Sentry Error..." });
}
