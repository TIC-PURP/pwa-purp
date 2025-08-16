"use client";

import React, { useEffect, useRef } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage, setUser } from "@/lib/store/authSlice";
import {
  initializeDefaultUsers,
  startSync,
  loginOnlineToCouchDB,
  watchUserDocByEmail,
  guardarUsuarioOffline,
} from "@/lib/database";

/** Envuelve la app con lógica de auth/sync ya dentro del Redux <Provider> */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  // ✅ Ref bien tipado (nada de number/null raros)
  const cancelWatchRef = useRef<(() => void) | null>(null);

  // Semilla local + rehidratación de sesión
  useEffect(() => {
    (async () => {
      try {
        await initializeDefaultUsers();
      } catch {}
      dispatch(loadUserFromStorage() as any);
    })();
  }, [dispatch]);

  // Si hay sesión guardada y estamos online, renovar cookie y arrancar sync
  useEffect(() => {
    (async () => {
      if (user && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const id = user.email || user.name;
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

  // Watcher de cambios del doc del usuario (replicación)
  useEffect(() => {
    (async () => {
      // limpia watcher anterior si existe
      if (cancelWatchRef.current) {
        try {
          cancelWatchRef.current();
        } catch {}
        cancelWatchRef.current = null;
      }

      if (isAuthenticated && user?.email) {
        const stop = await watchUserDocByEmail(user.email, async (doc) => {
          const updated = {
            _id: doc._id ?? user._id,
            id: doc.id ?? user.id,
            name: doc.name ?? user.name,
            email: doc.email ?? user.email,
            password: doc.password ?? user.password,
            role: doc.role ?? user.role,
            permissions: Array.isArray(doc.permissions)
              ? doc.permissions
              : user.permissions,
            isActive: doc.isActive !== false,
            createdAt: doc.createdAt ?? user.createdAt,
            updatedAt: doc.updatedAt ?? new Date().toISOString(),
          } as any;

          try {
            await guardarUsuarioOffline(updated);
          } catch {}
          dispatch(setUser(updated));
        });

        cancelWatchRef.current = stop;
      }
    })();

    return () => {
      if (cancelWatchRef.current) {
        try {
          cancelWatchRef.current();
        } catch {}
        cancelWatchRef.current = null;
      }
    };
  }, [isAuthenticated, user?.email, dispatch]);

  // Reintentar sync al volver online
  useEffect(() => {
    const onOnline = () => {
      if (isAuthenticated) startSync().catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated]);

  return <>{children}</>;
}

/** Export default (importa sin llaves en layout.tsx) */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </ReduxProvider>
  );
}
