import InstallButton from "../components/InstallButton"
import { Toaster } from 'sonner';
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
          <InstallButton />
        </Providers>
    <Toaster richColors position="top-center" />
</body>
    </html>
  );
}

