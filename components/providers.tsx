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

  // Seed local DB + session rehydrate
  useEffect(() => {
    initializeDefaultUsers();
    dispatch(loadUserFromStorage());
  }, [dispatch]);

  // Warm cache for key pages once (when online)
  useEffect(() => {
    const warm = async () => {
      try {
        if (typeof window === "undefined") return;
        if (!("caches" in window)) return;
        if (!navigator.onLine) return;

        await navigator.serviceWorker?.ready;
        if (!navigator.serviceWorker?.controller) return;

        const cache = await caches.open("html-pages");
        const urls = ["/", "/auth/login", "/principal"];
        for (const u of urls) {
          try { await cache.add(u); }
          catch { try { await fetch(u, { cache: "no-store" }); } catch {} }
        }
      } catch (e) {
        console.debug("warm cache skipped:", e);
      }
    };
    warm();
  }, []);

  // On reconnect: re-auth and start sync
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
