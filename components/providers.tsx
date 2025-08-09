"use client";

import type React from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage } from "@/lib/store/authSlice";
import { initializeDefaultUsers, loginOnlineToCouchDB, startSync } from "@/lib/database";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);

  // Semilla local + rehidratación de sesión
  useEffect(() => {
    initializeDefaultUsers();
    dispatch(loadUserFromStorage());
  }, [dispatch]);

  // 🔥 Precalentar caché de páginas clave cuando hay red y el SW controla la pestaña
  useEffect(() => {
    const warm = async () => {
      try {
        if (typeof window === "undefined") return;
        if (!("caches" in window)) return;
        if (!navigator.onLine) return;

        // espera a que el SW esté listo y controle la pestaña
        await navigator.serviceWorker?.ready;
        if (!navigator.serviceWorker?.controller) return;

        const cache = await caches.open("html-pages"); // debe coincidir con next.config.mjs
        const urls = ["/", "/auth/login", "/principal"];

        // addAll falla si una ruta da 404; mejor en serie con try/catch
        for (const u of urls) {
          try {
            await cache.add(u);
          } catch {
            // como plan B, intenta fetch para que pase por runtimeCaching
            try { await fetch(u, { cache: "no-store" }); } catch {}
          }
        }
      } catch (e) {
        // silencioso: no queremos romper la UI por el warmup
        console.debug("warm cache skipped:", e);
      }
    };
    warm();
  }, []);

  // ♻️ Al volver online: intenta sesión CouchDB y activa sync para subir lo offline
  useEffect(() => {
    const onOnline = async () => {
      try {
        if (isAuthenticated && user?.email && user?.password) {
          const ok = await loginOnlineToCouchDB(user.email, user.password);
          if (ok) startSync();
        }
      } catch (e) {
        console.error("Re-sync al volver online falló:", e);
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated, user]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  );
}
