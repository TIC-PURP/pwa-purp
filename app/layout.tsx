'use client'

import InstallButton from "../components/InstallButton"
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useEffect } from "react"
import { startSync } from "@/lib/database" // asegúrate que esta ruta esté correcta

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PWA",
  description: "PWA",
  manifest: "/manifest.json",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0f172a" }],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    console.log("Iniciando sincronización CouchDB ↔ PouchDB")
    try {
      startSync()
    } catch (error) {
      console.error("Error al iniciar la sincronización:", error)
    }
  }, [])

  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
          <InstallButton />
        </Providers>
      </body>
    </html>
  )
}
