import InstallButton from "../components/InstallButton"
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import ConnectionTest from "@/components/ConnectionTest"

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
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <ConnectionTest />
          <ErrorBoundary>{children}</ErrorBoundary>
          <InstallButton />
        </Providers>
      </body>
    </html>
  )
}
