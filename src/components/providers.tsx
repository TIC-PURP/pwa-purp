"use client";

import type React from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage, setUser } from "@/lib/store/authSlice";
import {
  initializeDefaultUsers,
  startSync,
  loginOnlineToCouchDB,
  watchUserDocByEmail,
  guardarUsuarioOffline,
} from "@/lib/database";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatchRef = useRef<null | (() => void)>(null);

  // Semilla local + rehidratación de sesión
  useEffect(() => {
    (async () => {
      try {
        await initializeDefaultUsers();
      } catch {}
      // @ts-ignore
      dispatch(loadUserFromStorage());
    })();
  }, [dispatch]);

  // Si ya hay sesión guardada y estamos online, renovar cookie y arrancar sync
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

  // 🔊 Watcher: cuando el doc del usuario cambie (replicación), actualizamos Redux + storage
  useEffect(() => {
    (async () => {
      // limpia watcher anterior
      if (cancelWatchRef.current) {
        cancelWatchRef.current();
        cancelWatchRef.current = null;
      }

      if (isAuthenticated && user?.email) {
        const stop = await watchUserDocByEmail(user.email, async (doc) => {
          // mapeamos a tu tipo User
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
      if (cancelWatchRef.current) cancelWatchRef.current();
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  );
}
