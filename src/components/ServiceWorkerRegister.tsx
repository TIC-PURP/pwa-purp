"use client";

import { useEffect } from "react";

type Props = {
  nonce?: string;
};

export default function ServiceWorkerRegister({ nonce }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Evitar registrar en desarrollo: Next.js no sirve todos los assets (dev server)
    if (process.env.NODE_ENV !== "production") {
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
