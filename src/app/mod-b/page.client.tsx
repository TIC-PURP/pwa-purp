// Pantalla del Modulo B
"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { moduleBMode } from "@/lib/permissions";
import BackButton from "@/components/common/back-button";
import { useEffect } from "react";
import { PhotosTest } from "@/components/mod-b/photos-test";

export default function ModuleBPage() {
  const { user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  const mode = moduleBMode(user); // FULL | READ | NONE

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
          <h1 className="text-xl font-semibold">Modulo B</h1>
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al Modulo B</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "READ" ? (
              <p className="text-sm text-muted-foreground">
                Modo lectura: si existieran formularios, estarian deshabilitados.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Acceso completo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pruebas de Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotosTest readOnly={mode === "READ"} />
          </CardContent>
        </Card>

      </main>
    </RouteGuard>
  );
}


