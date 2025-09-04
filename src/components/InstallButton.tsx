"use client";

// Botón flotante que permite al usuario instalar la PWA cuando el navegador
// detecta que la aplicación es "instalable". Se basa en el evento
// `beforeinstallprompt` para mostrar el botón y lanzar el cuadro de diálogo.

import { useEffect, useState } from "react";

// La variable `deferredPrompt` almacena el evento diferido que dispara el
// navegador; de esta manera podemos invocarlo manualmente cuando el usuario
// presione el botón.
let deferredPrompt: any = null;

export default function InstallButton() {
  // Indicador de si se debe mostrar o no el botón de instalación
  const [isInstallable, setIsInstallable] = useState(false);

  // Al montarse el componente, escuchamos el evento `beforeinstallprompt` que
  // nos avisa si la app puede instalarse.
  useEffect(() => {
    const handler = (e: any) => {
      // Evitar registrar múltiples veces por HMR / múltiples disparos
      if (deferredPrompt) return;
      e.preventDefault(); // evitamos que el navegador muestre el prompt por defecto
      deferredPrompt = e; // guardamos el evento para usarlo luego
      setIsInstallable(true); // mostramos el botón
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Limpieza del listener cuando el componente se desmonta
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // Lanza el prompt de instalación y maneja la respuesta del usuario
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostramos el diálogo de instalación
    deferredPrompt.prompt();

    // Esperamos la decisión del usuario
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("App instalada");
    } else {
      console.log("Instalación cancelada");
    }

    // Reseteamos el estado porque el evento solo puede usarse una vez
    deferredPrompt = null;
    setIsInstallable(false);
  };

  // Si no es instalable no renderizamos nada
  if (!isInstallable) return null;

  // Botón visible cuando la app es instalable
  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-5 right-5 z-50 animate-bounce rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg hover:bg-gray-800 transition-all duration-900"
    >
      Instalar App
    </button>
  );
}
