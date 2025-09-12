"use client";

import { useEffect } from "react";

type Props = {
  nonce?: string;
};

export default function ServiceWorkerRegister({ nonce }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // En desarrollo, permite activar el SW con NEXT_PUBLIC_SW_ENABLE_DEV=1
    const enableDevSW =
      process.env.NEXT_PUBLIC_SW_ENABLE_DEV === "1" ||
      process.env.NEXT_PUBLIC_SW_ENABLE_DEV === "true";

    // Evitar registrar en desarrollo salvo que se habilite explícitamente
    if (process.env.NODE_ENV !== "production" && !enableDevSW) {
      // Si hubiera uno previo, intentar desregistrarlo para evitar errores de precache en dev
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => {
          regs.forEach((r) => {
            try {
              r.unregister();
            } catch {}
          });
        })
        .catch(() => {});
      return;
    }
    // Evitar registros duplicados
    if ((window as any).__swRegistered) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        (window as any).__swRegistered = true;
        reg.addEventListener?.("updatefound", () => {
          // hook para actualizar UI si se desea
        });
      } catch (e) {
        console.warn("[sw] register failed", (e as any)?.message || e);
      }
    };
    register();
  }, []);
  return null;
}
