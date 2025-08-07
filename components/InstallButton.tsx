"use client"

import { useEffect, useState } from "react"

let deferredPrompt: any = null

export default function InstallButton() {
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      deferredPrompt = e
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Cleanup
    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      console.log("App instalada")
    } else {
      console.log("Instalación cancelada")
    }

    deferredPrompt = null
    setIsInstallable(false)
  }

  if (!isInstallable) return null

  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-5 right-5 z-50 animate-bounce rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg hover:bg-gray-800 transition-all duration-900"
    >
      Instalar App
    </button>
  )
}
