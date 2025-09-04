"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Evitar registros duplicados en desarrollo (HMR)
    if ((window as any).__swRegistered) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        (window as any).__swRegistered = true;
        // Opcional: escuchar updates del SW para futura UI
        reg.addEventListener?.("updatefound", () => {
          // placeholder para manejar nuevas versiones
        });
      } catch (e) {
        // Silencioso: la app funciona sin SW si falla el registro
        console.warn("[sw] register failed", (e as any)?.message || e);
      }
    };
    register();
  }, []);

  return null;
}
