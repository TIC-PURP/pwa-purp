"use client";

// Página inicial del proyecto. Su única responsabilidad es verificar el
// estado de autenticación del usuario y redirigirlo a la sección
// correspondiente. Mientras decide, muestra un simple "spinner" de carga.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { startSync, stopSync } from "@/lib/database";

export default function HomePage() {
  // Router de Next.js utilizado para mover al usuario entre pantallas.
  const router = useRouter();
  // Obtenemos del estado global si existe sesión activa y si sigue cargando.
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Cada vez que cambia el estado de autenticación iniciamos o detenemos la
  // sincronización con CouchDB para mantener los datos locales al día.
  useEffect(() => {
    if (isAuthenticated) {
      // Usuario autenticado → arrancar replicación bidireccional.
      startSync().catch(() => {});
    } else {
      // Usuario no autenticado → detener replicación y liberar recursos.
      stopSync().catch(() => {});
    }
  }, [isAuthenticated]);

  // Cuando finaliza la carga inicial, redirigimos a la ruta correspondiente
  // (panel principal o formulario de inicio de sesión).
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

