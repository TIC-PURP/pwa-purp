"use client";

// PÃ¡gina inicial del proyecto. Su Ãºnica responsabilidad es verificar el
// estado de autenticaciÃ³n del usuario y redirigirlo a la secciÃ³n
// correspondiente. Mientras decide, muestra un simple "spinner" de carga.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { startSync, stopSync } from "@/lib/database";

export default function HomePage() {
  // Router de Next.js para navegar programÃ¡ticamente
  const router = useRouter();
  // Extraemos del store si hay sesiÃ³n y si todavÃ­a se estÃ¡ cargando
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Cada vez que cambia el estado de autenticaciÃ³n iniciamos o detenemos la
  // sincronizaciÃ³n con CouchDB.
  useEffect(() => {
    if (isAuthenticated) {
      // Usuario autenticado â†’ arrancar replicaciÃ³n
      startSync().catch(() => {});
    } else {
      // Usuario no autenticado â†’ detener replicaciÃ³n
      stopSync().catch(() => {});
    }
  }, [isAuthenticated]);

  // Cuando ya se resolviÃ³ el estado de carga, redirigimos a la ruta adecuada
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
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-foreground"></div>
    </div>
  );
}

