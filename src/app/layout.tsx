// Layout raíz de la aplicación. Aquí se definen los proveedores globales,
// estilos compartidos y elementos que deben estar presentes en todas las
// páginas (como el botón de instalación PWA o el manejador de errores).

import InstallButton from "../components/InstallButton";
import dynamic from "next/dynamic";
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

// Cargamos el componente de notificaciones de manera dinámica para evitar
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
  // CSP por meta (desarrollo permite HMR; producción más estricta)
  const isDev = process.env.NODE_ENV !== "production";
  const connectSrc = ["'self'"];
  if (process.env.SENTRY_DSN) {
    connectSrc.push("https://*.sentry.io", "https://*.ingest.sentry.io");
  }
  const scriptSrc = isDev ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"] : ["'self'"];
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data:",
    // frame-ancestors no tiene efecto en <meta>, debe ir como cabecera
  ].join('; ');

  // El layout envuelve todo el HTML de cada página
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <script src="/theme-init.js"></script>
      </head>
      <body className={inter.className}>
        {/* Proveedores de contexto global (Redux, etc.) */}
        <Providers>
          {/* Captura errores de React y muestra una UI alternativa */}
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Botón flotante para instalar la PWA */}
          
          {/* Registro del Service Worker para capacidades offline */}
          <ServiceWorkerRegister />
      </Providers>
        {/* Componente de notificaciones tipo toast */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
