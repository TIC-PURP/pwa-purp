"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";

type Role = "user" | "admin" | "manager";

interface RouteGuardProps {
  children: React.ReactNode;
  /** Rol mínimo requerido para ver la ruta (manager > admin > user). */
  requiredRole?: Role;
}

/** Orden de jerarquía: manager (máximo) > admin > user */
function roleAllows(userRole: Role, required: Role) {
  if (userRole === "manager") return true;                // manager ve todo
  if (userRole === "admin") return required !== "manager"; // admin no puede ver rutas solo manager
  return required === "user";                               // user solo rutas de user
}

export function RouteGuard({ children, requiredRole = "user" }: RouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  React.useEffect(() => {
    // Si no está autenticado, redirige a login.
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    // Si está autenticado pero no tiene el rol suficiente, redirige a principal.
    if (user && !roleAllows(user.role as Role, requiredRole)) {
      router.replace("/principal");
    }
  }, [isAuthenticated, user, requiredRole, router]);

  // Evita parpadeo de contenido: no renderiza hasta confirmar auth/rol.
  if (!isAuthenticated) return null;
  if (user && !roleAllows(user.role as Role, requiredRole)) return null;

  return <>{children}</>;
}

export default RouteGuard;
