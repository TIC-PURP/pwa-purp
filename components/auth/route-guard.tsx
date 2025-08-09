"use client";

import type React from "react";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { LoginForm } from "@/components/auth/login-form"; // If you prefer default export, change this import

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: "manager" | "administrador" | "user";
  redirectTo?: string;
}

export function RouteGuard({
  children,
  requiredRole,
  redirectTo = "/auth/login",
}: RouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((s) => s.auth);

  const offline = typeof navigator !== "undefined" ? !navigator.onLine : false;

  const lacksAuthOrRole = useMemo(
    () => !isAuthenticated || (requiredRole && user?.role !== requiredRole),
    [isAuthenticated, requiredRole, user?.role]
  );

  // Only redirect when ONLINE. Offline we render Login inline.
  useEffect(() => {
    if (isLoading) return;
    if (!offline && lacksAuthOrRole) {
      router.replace(redirectTo);
    }
  }, [isLoading, offline, lacksAuthOrRole, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    );
  }

  // OFFLINE & not authenticated/role => show Login inline (no navigation)
  if (offline && lacksAuthOrRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-3">
          <div>
            <h1 className="text-lg font-semibold">Modo sin conexión</h1>
            <p className="text-sm text-slate-600">
              Inicia sesión con tus credenciales guardadas para continuar.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    );
  }

  // ONLINE but not authorized yet -> effect will redirect; render nothing
  if (!offline && lacksAuthOrRole) return null;

  return <>{children}</>;
}
