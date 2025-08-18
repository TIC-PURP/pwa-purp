// src/components/providers.tsx
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

/** Bootstrap de auth/sync y watcher del usuario */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatch = useRef<null | (() => void)>(null);

  // Semilla + rehidratación de sesión
  useEffect(() => {
    (async () => {
      try { await initializeDefaultUsers(); } catch {}
      // @ts-ignore
      dispatch(loadUserFromStorage());
    })();
  }, [dispatch]);

  // Si hay sesión guardada y hay red → renovar cookie y arrancar sync
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
          // si falla, seguimos offline
        }
      }
    })();
  }, [user]);

  // Watcher del documento del usuario (replicación -> actualiza Redux y storage)
  useEffect(() => {
    (async () => {
      if (cancelWatch.current) { cancelWatch.current(); cancelWatch.current = null; }
      if (isAuthenticated && user?.email) {
        const stop = await watchUserDocByEmail(user.email, async (doc) => {
          const updated = {
            _id: doc._id ?? user._id,
            id: doc.id ?? user.id,
            name: doc.name ?? user.name,
            email: doc.email ?? user.email,
            password: doc.password ?? user.password,
            role: doc.role ?? user.role,
            permissions: Array.isArray(doc.permissions) ? doc.permissions : user.permissions,
            isActive: doc.isActive !== false,
            createdAt: doc.createdAt ?? user.createdAt,
            updatedAt: doc.updatedAt ?? new Date().toISOString(),
          } as any;
          try { await guardarUsuarioOffline(updated); } catch {}
          dispatch(setUser(updated));
        });
        cancelWatch.current = stop;
      }
    })();

    return () => { try { cancelWatch.current?.(); } catch {} };
  }, [isAuthenticated, user?.email, dispatch]);

  // Reintentar sync al volver online
  useEffect(() => {
    const onOnline = () => { if (isAuthenticated) startSync().catch(() => {}); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated]);

  return <>{children}</>;
}

/** Export por defecto: envolver TODO con Redux + Bootstrap */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </ReduxProvider>
  );
}
