// src/components/providers.tsx
// Proveedores globales: Redux, autenticación y sincronización
"use client";

import React, { useEffect, useRef } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage, setUser } from "@/lib/store/authSlice";
import { notify } from "@/lib/notify";
import {
  startSync,
  loginOnlineToCouchDB,
  watchUserDocByEmail,
  guardarUsuarioOffline,
  cleanupUserDocs,
  getAllUsersAsManager,
} from "@/lib/database";

/** Bootstrap de autenticación/sincronización y observador del usuario */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatch = useRef<null | (() => void)>(null);
  const avatarUrlRef = useRef<string | null>(null);
  const warmedRef = useRef<boolean>(false);

  // Rutas a precachear tras login online para navegación offline
  const ROUTES_TO_WARM = [
    "/",
    "/auth/login",
    "/principal",
    "/mod-a",
    "/mod-b",
    "/mod-c",
    "/mod-d",
    "/users",
    "/account",
    "/sentry-example-page",
  ];

  const warmRoutes = async () => {
    if (typeof window === "undefined") return;
    if (warmedRef.current) return;
    const origin = window.location.origin;
    let startCache: Cache | null = null;
    let htmlCache: Cache | null = null;
    try {
      if ("caches" in window) {
        try { startCache = await caches.open("start-url"); } catch {}
        try { htmlCache = await caches.open("html-pages"); } catch {}
      }
      for (const path of ROUTES_TO_WARM) {
        try {
          const target = new URL(path, origin).toString();
          const response = await fetch(target, { credentials: "same-origin" });
          if (!response || !response.ok) continue;
          if (htmlCache) {
            const htmlRequest = new Request(target, { credentials: "same-origin" });
            await htmlCache.put(htmlRequest, response.clone());
          }
          if ((path === "/" || path === "") && startCache) {
            const startRequest = new Request(target, { credentials: "same-origin" });
            await startCache.put(startRequest, response.clone());
          }
        } catch {}
      }
      warmedRef.current = true;
    } catch {}
  };

  // Aplicar tema guardado (por defecto claro)
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("theme");
      if (t === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch {}
  }, []);

  // Rehidratación de sesión
  useEffect(() => {
    (async () => {
      // @ts-ignore
      dispatch(loadUserFromStorage());
      // Limpieza silenciosa al arrancar la app
      try { await cleanupUserDocs(); } catch {}
    })();
  }, [dispatch]);

  // Si hay sesión guardada y hay red → renovar cookie y arrancar sync
  useEffect(() => {
    (async () => {
      if (user && typeof navigator !== "undefined" && navigator.onLine) {
        // Evitar reintentos duplicados en dev/HMR: usar ref por identidad de usuario
        // @ts-ignore
        if (!(window as any).__lastLoginUserId) (window as any).__lastLoginUserId = null;
        const lastId = (window as any).__lastLoginUserId as string | null;
        const currentId = user.id || user.email || user.name;
        if (lastId === currentId) return;
        (window as any).__lastLoginUserId = currentId;
        try {
          const email = user.email || user.name;
          if (email && user.password) {
            await loginOnlineToCouchDB(email, user.password);
            await startSync();
            // Sembrar caché local de usuarios para panel offline si tiene permisos
            try { await getAllUsersAsManager(); } catch {}
            // Precalentar rutas HTML para uso offline tras login online
            try { await warmRoutes(); } catch {}
            // Tras login/sync, limpiar documentos locales antiguos si los hubiera
            try { await cleanupUserDocs(); } catch {}
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
          const defaults = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
          const mpDoc =
            doc.modulePermissions && typeof doc.modulePermissions === "object" && !Array.isArray(doc.modulePermissions)
              ? doc.modulePermissions
              : (user as any).modulePermissions;
          const mergedMP = { ...defaults, ...(mpDoc || {}) } as any;
          const updated = {
            _id: doc._id ?? user._id,
            id: doc.id ?? user.id,
            name: doc.name ?? user.name,
            email: doc.email ?? user.email,
            password: doc.password ?? user.password,
            role: doc.role ?? user.role,
            permissions: Array.isArray(doc.permissions) ? doc.permissions : user.permissions,
            modulePermissions: mergedMP,
            isActive: doc.isActive !== false,
            createdAt: doc.createdAt ?? user.createdAt,
            updatedAt: doc.updatedAt ?? new Date().toISOString(),
          } as any;
          // Cargar avatar (attachment)
          try {
            const { getUserAvatarBlob } = await import("@/lib/database");
            const blob = await getUserAvatarBlob(updated.email || user.email);
            if (blob) {
              try {
                if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
                const url = URL.createObjectURL(blob);
                (updated as any).avatarUrl = url;
                avatarUrlRef.current = url;
              } catch {}
            }
          } catch {}
          // Guardar doc sin avatarUrl para no inflar el documento
          try {
            const toSave = { ...(updated as any) };
            delete (toSave as any).avatarUrl;
            await guardarUsuarioOffline(toSave);
          } catch {}
          dispatch(setUser(updated));
        });
        cancelWatch.current = stop;
      }
    })();

    return () => {
      try { cancelWatch.current?.(); } catch {}
      try { if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current); } catch {}
      avatarUrlRef.current = null;
    };
  }, [isAuthenticated, user?.email, dispatch]);

  // Reintentar sync y calentar rutas al volver online
  useEffect(() => {
    const onOnline = () => {
      if (isAuthenticated) {
        startSync().catch(() => {});
        warmRoutes().catch(() => {});
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated]);

  // Escuchar eventos del Service Worker (Background Sync)
  useEffect(() => {
    if (typeof navigator === "undefined" || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const type = (event && (event as any).data && (event as any).data.type) || "";
      if (type === 'BG_SYNC_QUEUED') notify.info('Acción encolada. Se enviará al recuperar internet.');
      else if (type === 'BG_SYNC_SUCCESS') notify.success('Acciones sincronizadas correctamente.');
      else if (type === 'BG_SYNC_FAILURE') notify.warn('No se pudieron sincronizar algunas acciones.');
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

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
