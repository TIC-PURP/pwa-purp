// src/components/providers.tsx
"use client";
import React, { useEffect } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadUserFromStorage } from "@/lib/store/authSlice";
import { startSync } from "@/lib/database";

function SessionBootstrap() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    // Rehidratar estado desde localStorage
    // @ts-ignore
    dispatch(loadUserFromStorage());
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      if (user && typeof navigator !== "undefined" && navigator.onLine) {
        try { await startSync(); } catch {}
      }
    })();
  }, [user]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <SessionBootstrap />
      {children}
    </ReduxProvider>
  );
}

export default Providers;
