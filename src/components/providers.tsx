// src/components/providers.tsx
// Proveedores globales: Redux, autenticacion y sincronizacion
"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage, setUser } from "@/lib/store/authSlice";
import { notify } from "@/lib/notify";
import { isNavigatorOnline } from "@/lib/network";
import {
  startSync,
  loginOnlineToCouchDB,
  watchUserDocByEmail,
  guardarUsuarioOffline,
  cleanupUserDocs,
  getAllUsersAsManager,
  ensureCouchSecurity,
} from "@/lib/database";

/** Bootstrap de autenticacion/sincronizacion y observador del usuario */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const cancelWatch = useRef<null | (() => void)>(null);
  const avatarUrlRef = useRef<string | null>(null);
  const warmedRef = useRef<boolean>(false);

  // Router instance for dynamic prefetch in offline-first PWA
  const router = useRouter();

  // Rutas a precachear tras login online para navegacion offline
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
  ];

  const warmRoutes = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (warmedRef.current) return;
    const origin = window.location.origin;
    let startCache: Cache | null = null;
    let htmlCache: Cache | null = null;
    let dataCache: Cache | null = null;
    const buildId = (window as any)?.__NEXT_DATA__?.buildId || "";
    try {
      if ("caches" in window) {
        try { startCache = await caches.open("start-url"); } catch {}
        try { htmlCache = await caches.open("html-pages"); } catch {}
        try { dataCache = await caches.open("next-data"); } catch {}
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
          if (dataCache && buildId) {
            const dataPath = path === "/" ? "/index" : path;
            const dataUrl = new URL(`/_next/data/${buildId}${dataPath}.json`, origin).toString();
            try {
              const dataResponse = await fetch(dataUrl, { credentials: "same-origin" });
              if (dataResponse && dataResponse.ok) {
                const dataRequest = new Request(dataUrl, { credentials: "same-origin" });
                await dataCache.put(dataRequest, dataResponse.clone());
              }
            } catch {}
          }
        } catch {}
      }
      warmedRef.current = true;
    } catch {}
  }, []);

  // Aplicar tema guardado (por defecto claro)
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("theme");
      if (t === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch {}
  }, []);

  // Rehidratacion de sesion
  useEffect(() => {
    (async () => {
      // @ts-ignore
      dispatch(loadUserFromStorage());
      // Limpieza silenciosa al arrancar la app
      try { await cleanupUserDocs(); } catch {}
    })();
  }, [dispatch]);

  // Si hay sesion guardada y hay red  renovar cookie y arrancar sync
  useEffect(() => {
    (async () => {
      if (user && isNavigatorOnline()) {
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
            if (user.role === "admin" || user.role === "manager") {
              try { await ensureCouchSecurity(); } catch {}
            }
            await startSync();
            // Sembrar cache local de usuarios para panel offline si tiene permisos
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
  }, [user, warmRoutes]);

  // Watcher del documento del usuario (replicacion -> actualiza Redux y storage)
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
              // Si hay un avatar disponible como blob, crear un nuevo ObjectURL
              try {
                if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
                const url = URL.createObjectURL(blob);
                (updated as any).avatarUrl = url;
                avatarUrlRef.current = url;
              } catch {}
            } else {
              // Si no se obtuvo blob, conservar la URL previa del avatar, si existe
              const prev = (user as any)?.avatarUrl || (updated as any)?.avatarUrl;
              if (prev) {
                (updated as any).avatarUrl = prev;
              }
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
      if (!isAuthenticated || !user) return;
      const identifier = (user.email || user.name || "").trim();
      const password = (user.password || "").trim();
      if (!identifier || !password) {
        startSync().catch(() => {});
        warmRoutes().catch(() => {});
        return;
      }

      void (async () => {
        try {
          (window as any).__lastLoginUserId = null;
          await loginOnlineToCouchDB(identifier, password);
          (window as any).__lastLoginUserId = user.id || user.email || user.name;
        } catch (error) {
          console.warn("[providers] loginOnlineToCouchDB on reconnect failed", error);
        }

        if (user.role === "admin" || user.role === "manager") {
          try { await ensureCouchSecurity(); } catch {}
        }
        try { await startSync(); } catch {}
        try { await getAllUsersAsManager(); } catch {}
        try { await warmRoutes(); } catch {}
        try { await cleanupUserDocs(); } catch {}
      })();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isAuthenticated, user, warmRoutes]);

    // Prefetch dynamic modules when authenticated and online
  useEffect(() => {
    if (isAuthenticated && isNavigatorOnline()) {
      ROUTES_TO_WARM.forEach((route) => {
        try {
          router.prefetch(route);
        } catch (err) {}
      });
    }
  }, [isAuthenticated, router]);

// Avisos de Background Sync desde el Service Worker
  useEffect(() => {
    if (typeof navigator === "undefined" || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const type = (event && (event as any).data && (event as any).data.type) || "";
      if (type === 'BG_SYNC_QUEUED') notify.info('Accion encolada. Se enviara al recuperar internet.');
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
