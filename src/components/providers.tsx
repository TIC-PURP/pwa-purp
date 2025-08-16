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
import { toast } from "sonner";

/** Corre lógica de auth/sync ya dentro del Redux <Provider> */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatchRef = useRef<(() => void) | null>(null);

  // Semilla + rehidratación
  useEffect(() => {
    (async () => {
      try {
        await initializeDefaultUsers();
      } catch {}
      dispatch(loadUserFromStorage() as any);
    })();
  }, [dispatch]);

  // Renovar cookie y arrancar sync si ya había sesión
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
          // seguimos offline sin romper UI
        }
      }
    })();
  }, [user]);

  // Watcher de cambios del doc de usuario
  useEffect(() => {
    (async () => {
      if (cancelWatchRef.current) {
        try { cancelWatchRef.current(); } catch {}
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
          try { await guardarUsuarioOffline(updated); } catch {}
          dispatch(setUser(updated));
        });
        cancelWatchRef.current = stop;
      }
    })();

    return () => {
      if (cancelWatchRef.current) {
        try { cancelWatchRef.current(); } catch {}
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

  // AQUÍ va el useEffect del “toast de sync”, no fuera del componente
  useEffect(() => {
    const onSync = (e: any) => {
      const d = e?.detail || {};
      if (d.type === "change" && d.direction === "push") {
        toast.success("Cambios enviados al servidor");
      }
      if (d.type === "active") {
        // toast.info("Sincronización activa");
      }
      if (d.type === "error") {
        toast.error("Error de sincronización");
      }
    };
    window.addEventListener("pouch-sync", onSync as EventListener);
    return () => window.removeEventListener("pouch-sync", onSync as EventListener);
  }, []);

  return <>{children}</>;
}
function ProvidersInner({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </ReduxProvider>
  );
}

export default ProvidersInner;
// También exportado con nombre, para quien haga `import { Providers }`
export { ProvidersInner as Providers };
