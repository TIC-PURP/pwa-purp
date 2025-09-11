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
  // El nonce para las etiquetas <script> se obtiene de la variable de entorno o usa un valor por defecto
  const cspNonce = process.env.CSP_SCRIPT_NONCE || "staticNonce";

  // El layout envuelve todo el HTML de cada página
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{__html:"try{var t=localStorage.getItem('theme');var prefersDark=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(t==='dark'||(!t&&prefersDark)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}"}} />
        {/* Proveedores de contexto global (Redux, etc.) */}
        <Providers>
          {/* Captura errores de React y muestra una UI alternativa */}
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Botón flotante para instalar la PWA */}
          
          {/* Registro del Service Worker para capacidades offline */}
          <ServiceWorkerRegister nonce={cspNonce} />
        </Providers>
        {/* Componente de notificaciones tipo toast */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
