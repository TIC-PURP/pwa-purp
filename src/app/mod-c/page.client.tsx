// Pantalla del Módulo C.
// Determina el nivel de acceso permitiendo mostrar un modo lectura si es necesario.
"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { moduleCMode } from "@/lib/permissions";
import BackButton from "@/components/common/back-button";
import { FilesTest } from "@/components/common/files-test";

export default function ModuleCPage() {
  // Datos del usuario autenticado y utilidades de enrutamiento.
  const { user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  // Calcula los permisos efectivos para decidir qué interfaz mostrar.
  const mode = moduleCMode(user); // FULL | READ | NONE

  useEffect(() => {
    if (mode === "NONE") {
      router.replace("/principal");
    }
  }, [mode, router]);

  if (mode === "NONE") return null;

  return (
    <RouteGuard>
      <Navbar />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Módulo C</h1>
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al módulo C</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "READ" ? (
              <p className="text-sm text-muted-foreground">
                Modo lectura: si existieran formularios, estarían deshabilitados.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Acceso completo.
              </p>
            )}
          </CardContent>
        </Card>

      {/* Sección de pruebas de archivos genéricos */}
      <Card>
        <CardHeader>
          <CardTitle>Pruebas de Archivos</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Permitir cargar archivos sólo si el usuario tiene acceso completo; en modo lectura mostrar lista pero sin acciones */}
          <FilesTest readOnly={mode === "READ"} />
        </CardContent>
      </Card>
      </main>
    </RouteGuard>
  );
}

