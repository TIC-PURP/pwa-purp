// Layout raiz de la aplicacion. Aqui se definen los proveedores globales,
// estilos compartidos y elementos que deben estar presentes en todas las
// paginas (como el boton de instalacion PWA o el manejador de errores).

import dynamic from "next/dynamic";
import { headers } from "next/headers";
import type React from "react";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Providers from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const sans = GeistSans;

// Cargamos el componente de notificaciones de manera dinamica para evitar
// incluirlo en el servidor (solo se usa en el cliente).
const Toaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = headers();
  const nonce = headerList.get("x-nonce") ?? undefined;

  const connectSources = ["'self'"];
  if (process.env.SENTRY_DSN) {
    connectSources.push("https://*.sentry.io", "https://*.ingest.sentry.io");
  }
  const cspMeta = nonce
    ? [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        `connect-src ${connectSources.join(' ')}`,
        "font-src 'self' data:"
      ].join('; ')
    : null;

  // El layout envuelve todo el HTML de cada pagina
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {cspMeta ? (
          <meta httpEquiv="Content-Security-Policy" content={cspMeta} />
        ) : null}
        <script nonce={nonce} src="/theme-init.js"></script>
      </head>
      <body className={sans.className}>
        {/* Proveedores de contexto global (Redux, etc.) */}
        <Providers>
          {/* Captura errores de React y muestra una UI alternativa */}
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Registro del Service Worker para capacidades offline */}
          <ServiceWorkerRegister />
        </Providers>
        {/* Componente de notificaciones tipo toast */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

