"use client";

// Página inicial del proyecto. Su única responsabilidad es verificar el
// estado de autenticación del usuario y redirigirlo a la sección
// correspondiente. Mientras decide, muestra un simple "spinner" de carga.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { startSync, stopSync } from "@/lib/database";

export default function HomePage() {
  // Router de Next.js para navegar programáticamente
  const router = useRouter();
  // Extraemos del store si hay sesión y si todavía se está cargando
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Cada vez que cambia el estado de autenticación iniciamos o detenemos la
  // sincronización con CouchDB.
  useEffect(() => {
    if (isAuthenticated) {
      // Usuario autenticado → arrancar replicación
      startSync().catch(() => {});
    } else {
      // Usuario no autenticado → detener replicación
      stopSync().catch(() => {});
    }
  }, [isAuthenticated]);

  // Cuando ya se resolvió el estado de carga, redirigimos a la ruta adecuada
  // (panel principal o formulario de login).
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/principal");
      } else {
        router.push("/auth/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Mientras se decide, solo mostramos un indicador de carga centrado.
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900"></div>
    </div>
  );
}
