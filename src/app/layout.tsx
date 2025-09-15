// Layout raiz de la aplicacion. Aqui se definen los proveedores globales,
// estilos compartidos y elementos que deben estar presentes en todas las
// paginas (como el boton de instalacion PWA o el manejador de errores).

import dynamic from "next/dynamic";
import { headers } from "next/headers";
import type React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

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

  // CSP por meta (desarrollo permite HMR; produccion mas estricta)
  const isDev = process.env.NODE_ENV !== "production";
  const connectSrc = ["'self'"];
  if (process.env.SENTRY_DSN) {
    connectSrc.push("https://*.sentry.io", "https://*.ingest.sentry.io");
  }
  // En produccion permitimos 'unsafe-inline' porque Next.js inyecta pequenos
  // scripts inline necesarios para la hidratacion. Si mas adelante migramos
  // a CSP con nonce por cabecera, podemos retirar este permiso.
  const scriptSrc = isDev
    ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'"];
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data:",
    // frame-ancestors no tiene efecto en <meta>, debe ir como cabecera
  ].join('; ');

  // El layout envuelve todo el HTML de cada pagina
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script nonce={nonce} src="/theme-init.js"></script>
      </head>
      <body className={inter.className}>
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
