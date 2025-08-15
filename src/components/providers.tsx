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
import { toast } from "sonner";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatchRef = useRef<null | (() => void)>(null);

  // Semilla local + rehidratación de sesión
  useEffect(() => {
    (async () => {
      try { await initializeDefaultUsers(); } catch {}
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
      if (cancelWatchRef.current) { cancelWatchRef.current(); cancelWatchRef.current = null; }

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
            permissions: Array.isArray(doc.permissions) ? doc.permissions : user.permissions,
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

    return () => { if (cancelWatchRef.current) cancelWatchRef.current(); };
  }, [isAuthenticated, user?.email, dispatch]);

  // Reintentar sync al volver online
  useEffect(() => {
    const onOnline = () => { if (isAuthenticated) startSync().catch(() => {}); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated]);

  return <>{children}</>;
}

// Toast cuando la sync envía cambios (push) o se recupera
useEffect(() => {
  const onSync = (e: any) => {
    const d = e?.detail || {};
    if (d.type === "change" && d.direction === "push") {
      toast.success("Cambios sincronizados con la nube.");
    }
    if (d.type === "error") {
      toast.error("Error de sincronización. Se reintentará automáticamente.");
    }
  };
  const onWrite = (e: any) => {
    const p = e?.detail?.path;
    if (p === "local") toast.message("Guardado local (offline): será sincronizado.");
    if (p === "remote") toast.success("Guardado directo en la nube.");
  };
  window.addEventListener("purp-sync", onSync as any);
  window.addEventListener("purp-write", onWrite as any);
  return () => {
    window.removeEventListener("purp-sync", onSync as any);
    window.removeEventListener("purp-write", onWrite as any);
  };
}, []);

// Toasts globales desde eventos de sync y write-through
useEffect(() => {
  const onSync = (e: any) => {
    const d = e?.detail || {};
    if (d.type === "change" && d.direction === "push") {
      toast.success("Cambios sincronizados con la nube.");
    }
    if (d.type === "error") {
      toast.error("Error de sincronización. Se reintentará automáticamente.");
    }
  };
  const onWrite = (e: any) => {
    const p = e?.detail?.path;
    if (p === "local") toast.message("Guardado local (offline): será sincronizado.");
    if (p === "remote") toast.success("Guardado directo en la nube.");
  };
  window.addEventListener("purp-sync", onSync as any);
  window.addEventListener("purp-write", onWrite as any);
  return () => {
    window.removeEventListener("purp-sync", onSync as any);
    window.removeEventListener("purp-write", onWrite as any);
  };
}, []);


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  );
}
