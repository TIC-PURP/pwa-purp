import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";        // ⬅️ sin llaves
import ErrorBoundary from "@/components/ErrorBoundary"; // ⬅️ sin llaves

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PURP PWA",
  description: "Gestión PWA con PouchDB ⇄ CouchDB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
