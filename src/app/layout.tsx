// src/app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";

// ⚠️ Import dinámico SIN SSR para evitar ejecutar hooks en SSR
const ClientRoot = dynamic(() => import("@/components/ClientRoot"), {
  ssr: false,
  // loading opcional para evitar pantalla negra
  loading: () => null,
});

export const metadata: Metadata = {
  title: "PURP PWA",
  description: "PWA PURP offline/online",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Este layout es 100% server component. No hay hooks aquí.
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Todo lo que usa hooks se monta solo en el cliente */}
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
