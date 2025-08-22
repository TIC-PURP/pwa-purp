"use client";

import type React from "react";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { LoginForm } from "@/components/auth/login-form";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: "manager" | "admin" | "user";
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
    [isAuthenticated, requiredRole, user?.role],
  );

  // Solo redirige cuando HAY red. En offline NO navegamos (renderizamos login inline).
  useEffect(() => {
    if (isLoading) return;
    if (!offline && lacksAuthOrRole) {
      router.replace(redirectTo);
    }
  }, [isLoading, offline, lacksAuthOrRole, redirectTo, router]);

  // Cargando estado auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    );
  }

  // En offline SIN sesión -> mostrar LoginForm inline (sin navegar)
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

  // En online SIN sesión -> dejamos que el useEffect redirija (y retornamos vacío)
  if (!offline && lacksAuthOrRole) {
    return null;
  }

  // Autorizado
  return <>{children}</>;
}
