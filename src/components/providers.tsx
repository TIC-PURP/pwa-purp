"use client";

import type React from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage } from "@/lib/store/authSlice";
import { initializeDefaultUsers, startSync, loginOnlineToCouchDB } from "@/lib/database";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  // Semilla + rehidratación
  useEffect(() => {
    (async () => {
      try { await initializeDefaultUsers(); } catch {}
      // @ts-ignore
      dispatch(loadUserFromStorage());
    })();
  }, [dispatch]);

  // Si ya hay sesión guardada y estamos online, renovar cookie de Couch (silencioso)
  useEffect(() => {
    (async () => {
      if (user && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const id = user.email || user.name; // la UI guarda ambos
          if (id && user.password) {
            await loginOnlineToCouchDB(id, user.password);
            await startSync();
          }
        } catch {
          // si falla, seguimos offline y la UI no se cae
        }
      }
    })();
  }, [user]);

  // Reintentar sync al volver online
  useEffect(() => {
    const onOnline = () => { if (isAuthenticated) startSync().catch(() => {}); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  );
}
