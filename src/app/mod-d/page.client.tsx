// Pantalla del Módulo D.
// Ofrece un panel simple que responde al nivel de permisos del usuario.
"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { moduleDMode } from "@/lib/permissions";
import BackButton from "@/components/common/back-button";
import { PolygonDrawer } from "@/components/common/polygon-drawer";

export default function ModuleDPage() {
  // Información del usuario autenticado para controlar los permisos.
  const { user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  // Determina el modo de acceso admitido en el módulo.
  const mode = moduleDMode(user); // FULL | READ | NONE

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
          <h1 className="text-xl font-semibold">Módulo D</h1>
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al módulo D</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "READ" ? (
              <p className="text-sm text-muted-foreground">
                Modo lectura: puedes consultar tus polígonos pero no crear ni eliminar.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Acceso completo: puedes crear y administrar polígonos.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Funcionalidad de dibujo de polígonos */}
        <Card>
          <CardHeader>
            <CardTitle>Dibujar y guardar polígonos</CardTitle>
          </CardHeader>
          <CardContent>
            <PolygonDrawer readOnly={mode === "READ"} />
          </CardContent>
        </Card>
      </main>
    </RouteGuard>
  );
}

